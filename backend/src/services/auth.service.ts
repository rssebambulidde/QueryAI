import { supabaseAdmin, supabase } from '../config/database';
import { DatabaseService } from './database.service';
import logger from '../config/logger';
import config from '../config/env';
import { AuthenticationError, ValidationError, ConflictError } from '../types/error';
import { validatePasswordStrength } from '../utils/password-validation';

export interface SignupData {
  email: string;
  password: string;
  fullName?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    full_name?: string;
    role?: 'user' | 'super_admin';
    subscriptionTier?: 'free' | 'pro' | 'enterprise';
  };
  session: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

/**
 * Authentication Service
 * Handles user authentication using Supabase Auth
 */
export class AuthService {
  /**
   * Sign up a new user
   */
  static async signup(data: SignupData): Promise<AuthResponse> {
    try {
      // Validate input
      if (!data.email || !data.password) {
        throw new ValidationError('Email and password are required');
      }

      const pwStrength = validatePasswordStrength(data.password);
      if (!pwStrength.isValid) {
        throw new ValidationError(`Password too weak: ${pwStrength.errors.join(', ')}`);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new ValidationError('Invalid email format');
      }

      // Sign up user with Supabase Auth (use regular client for user operations)
      // Use frontend URL so Supabase confirmation email redirects to /auth/confirm
      const frontendUrl = config.CORS_ORIGIN || config.FRONTEND_URL || config.API_BASE_URL;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName || '',
          },
          emailRedirectTo: `${frontendUrl}/auth/confirm`,
        },
      });

      if (authError) {
        logger.error('Signup error:', authError);

        // Handle specific Supabase errors
        // Check both error code and message for better reliability
        if (authError.status === 422 ||
          authError.message?.toLowerCase().includes('already registered') ||
          authError.message?.toLowerCase().includes('user already registered')) {
          throw new ConflictError('User with this email already exists');
        }

        // Handle email sending errors - provide helpful message
        if (authError.message?.toLowerCase().includes('error sending confirmation email') ||
          authError.message?.toLowerCase().includes('sending email') ||
          authError.code === 'unexpected_failure') {
          logger.warn('Email sending failed. This usually means email confirmations are enabled but SMTP is not configured.');
          throw new AuthenticationError(
            'Signup failed: Email confirmation could not be sent. ' +
            'Please disable email confirmations in Supabase (Authentication → Settings → Enable Email Confirmations: OFF) ' +
            'or configure SMTP email provider.'
          );
        }

        throw new AuthenticationError(`Signup failed: ${authError.message || 'Unknown error'}`);
      }

      if (!authData.user) {
        throw new AuthenticationError('Failed to create user account');
      }

      // Create user profile in database
      const profile = await DatabaseService.createUserProfile(
        authData.user.id,
        data.email,
        data.fullName
      );

      if (!profile) {
        logger.warn(`User profile creation failed for user: ${authData.user.id}`);
        // Don't fail signup if profile creation fails - it can be created later
      }

      // Create default subscription
      const subscription = await DatabaseService.createDefaultSubscription(authData.user.id);

      // Log signup
      await DatabaseService.logUsage(authData.user.id, 'query', {
        action: 'signup',
        timestamp: new Date().toISOString(),
      });

      logger.info(`New user signed up: ${data.email} (${authData.user.id})`);

      // Return auth response
      if (!authData.session) {
        // Email confirmation might be required
        // Check if it's an email sending error or actual confirmation requirement
        logger.warn(`User created but no session. Email confirmation might be required.`);

        // Return user info but no session
        return {
          user: {
            id: authData.user.id,
            email: authData.user.email!,
            full_name: data.fullName,
            role: profile?.role || 'user',
            subscriptionTier: subscription?.tier || 'free',
          },
          session: {
            accessToken: '',
            refreshToken: '',
            expiresIn: 0,
          },
        };
      }

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          full_name: profile?.full_name || data.fullName,
          role: profile?.role || 'user',
          subscriptionTier: subscription?.tier || 'free',
        },
        session: {
          accessToken: authData.session.access_token,
          refreshToken: authData.session.refresh_token,
          expiresIn: authData.session.expires_in || 3600,
        },
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      logger.error('Signup error:', error);
      throw new AuthenticationError('Failed to create user account');
    }
  }

  /**
   * Login user
   */
  static async login(data: LoginData): Promise<AuthResponse> {
    try {
      // Validate input
      if (!data.email || !data.password) {
        throw new ValidationError('Email and password are required');
      }

      // Sign in user with Supabase Auth (use regular client for user operations)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        logger.warn(`Login failed for email: ${data.email}`, authError);

        // Check error status code for invalid credentials (400 is common for invalid credentials)
        if (authError.status === 400 ||
          authError.message?.toLowerCase().includes('invalid login credentials') ||
          authError.message?.toLowerCase().includes('invalid password')) {
          throw new AuthenticationError('Invalid email or password');
        }

        throw new AuthenticationError(`Login failed: ${authError.message || 'Unknown error'}`);
      }

      if (!authData.user || !authData.session) {
        throw new AuthenticationError('Login failed: Invalid response from auth service');
      }

      // Get user profile and subscription in parallel for better performance
      const [profile, subscription] = await Promise.all([
        DatabaseService.getUserProfile(authData.user.id),
        DatabaseService.getUserSubscription(authData.user.id),
      ]);

      // Log login
      await DatabaseService.logUsage(authData.user.id, 'query', {
        action: 'login',
        timestamp: new Date().toISOString(),
      });

      logger.info(`User logged in: ${data.email} (${authData.user.id})`);

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          full_name: profile?.full_name,
          role: profile?.role || 'user',
          subscriptionTier: subscription?.tier || 'free',
        },
        session: {
          accessToken: authData.session.access_token,
          refreshToken: authData.session.refresh_token,
          expiresIn: authData.session.expires_in || 3600,
        },
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error;
      }
      logger.error('Login error:', error);
      throw new AuthenticationError('Failed to login');
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      if (!email) {
        throw new ValidationError('Email is required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format');
      }

      // Request password reset (use regular client)
      // Use frontend URL for redirect (Supabase will redirect there with tokens)
      const frontendUrl = config.CORS_ORIGIN || config.API_BASE_URL;
      if (!frontendUrl || frontendUrl.includes('undefined')) {
        logger.error('Password reset: CORS_ORIGIN and API_BASE_URL are not set. Set one in Railway/env so the reset link points to your app.');
      }
      const redirectUrl = `${frontendUrl}/reset-password`;

      logger.info(`Requesting password reset for: ${email}`, {
        redirectUrl,
        apiBaseUrl: config.API_BASE_URL,
      });

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        logger.error('Password reset request error:', {
          error: error.message,
          code: error.code,
          status: error.status,
          details: 'This usually means SMTP is not configured in Supabase. See BREVO_SMTP_SETUP.md',
        });
        // Still don't reveal if email exists (security), but log the error for debugging
        // If it's an email sending error, we should still return success to prevent enumeration
        return;
      }

      logger.info(`Password reset email sent successfully for: ${email}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Password reset request error:', error);
      // Don't reveal errors to prevent email enumeration
    }
  }



  /**
   * Resend confirmation email for an unverified user.
   */
  static async resendConfirmationEmail(email: string): Promise<void> {
    const frontendUrl = config.CORS_ORIGIN || config.FRONTEND_URL || config.API_BASE_URL;

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${frontendUrl}/auth/confirm`,
      },
    });

    if (error) {
      logger.warn('Resend confirmation email failed', { email, error: error.message });
      // Don't reveal if user exists — always return silently
    } else {
      logger.info('Resend confirmation email sent', { email });
    }
  }

  /**
   * Change email — Supabase sends confirmation to the new address.
   */
  static async changeEmail(userId: string, newEmail: string): Promise<void> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new ValidationError('Invalid email format');
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: newEmail,
    });

    if (error) {
      logger.error('Email change error:', { userId, error: error.message });
      // Silent — don't reveal if email is already taken
    }

    logger.info(`Email change requested for user: ${userId}`);
  }

  /**
   * Change password — verifies current password first.
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const profile = await DatabaseService.getUserProfile(userId);
    if (!profile) throw new AuthenticationError('User not found');

    // Verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });
    if (signInError) throw new AuthenticationError('Current password is incorrect');

    // Validate new password strength
    const pwStrength = validatePasswordStrength(newPassword);
    if (!pwStrength.isValid) {
      throw new ValidationError(`Password too weak: ${pwStrength.errors.join(', ')}`);
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) throw new AuthenticationError('Failed to change password');

    logger.info(`Password changed for user: ${userId}`);
  }

  /**
   * Delete account — full cascade cleanup of all user data.
   */
  static async deleteAccount(userId: string, password: string): Promise<void> {
    const profile = await DatabaseService.getUserProfile(userId);
    if (!profile) throw new AuthenticationError('User not found');

    // Verify password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    });
    if (signInError) throw new AuthenticationError('Invalid password');

    // 1. Delete all conversations + attachments
    const { data: conversations } = await supabaseAdmin
      .from('conversations' as any)
      .select('id, metadata')
      .eq('user_id', userId);

    if (conversations?.length) {
      try {
        const { ChatAttachmentService } = await import('./chat-attachment.service');
        for (const conv of conversations) {
          const savedAttachments = (conv as any).metadata?.savedAttachments || [];
          const metadataFileIds = savedAttachments.map((a: any) => a.fileId).filter(Boolean);
          try {
            await ChatAttachmentService.deleteByConversation(conv.id, userId, metadataFileIds);
          } catch (e: any) {
            logger.warn('Failed to cleanup conversation attachments', { convId: conv.id, error: e.message });
          }
        }
      } catch (e: any) {
        logger.warn('Failed to import ChatAttachmentService', { error: e.message });
      }
      await supabaseAdmin.from('conversations' as any).delete().eq('user_id', userId);
    }

    // 2. Delete orphaned chat_attachments + storage files
    const { data: orphanedAttachments } = await supabaseAdmin
      .from('chat_attachments' as any)
      .select('id, storage_path')
      .eq('user_id', userId);
    if (orphanedAttachments?.length) {
      const paths = orphanedAttachments.map((a: any) => a.storage_path).filter(Boolean);
      if (paths.length) {
        await supabaseAdmin.storage.from('chat-attachments').remove(paths);
      }
      await supabaseAdmin.from('chat_attachments' as any).delete().eq('user_id', userId);
    }

    // 3. Delete avatar files
    try {
      const bucket = config.SUPABASE_STORAGE_BUCKET || 'avatars';
      const { data: avatarFiles } = await supabaseAdmin.storage.from(bucket).list(`avatars/${userId}`);
      if (avatarFiles?.length) {
        const avatarPaths = avatarFiles.map((f) => `avatars/${userId}/${f.name}`);
        await supabaseAdmin.storage.from(bucket).remove(avatarPaths);
      }
    } catch (e: any) {
      logger.warn('Failed to cleanup avatars', { userId, error: e.message });
    }

    // 4. Delete usage_logs, subscriptions, user_profiles (keep payments for audit)
    await supabaseAdmin.from('usage_logs' as any).delete().eq('user_id', userId);
    await supabaseAdmin.from('subscriptions' as any).delete().eq('user_id', userId);
    await supabaseAdmin.from('user_profiles' as any).delete().eq('id', userId);

    // 5. Delete from Supabase Auth (last step)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      logger.error('Failed to delete auth user:', { userId, error: deleteError.message });
      throw new AuthenticationError('Failed to delete account');
    }

    logger.info(`Account deleted: ${userId} (${profile.email})`);
  }

  /**
   * Get login activity from Supabase audit log.
   */
  static async getLoginActivity(userId: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await supabaseAdmin.rpc('get_user_audit_logs' as any, {
      target_user_id: userId,
      limit_count: limit,
    });

    if (error) {
      logger.error('Failed to fetch login activity:', { userId, error: error.message });
      return [];
    }

    return (data || []).map((entry: any) => ({
      id: entry.id,
      action: entry.action,
      timestamp: entry.created_at,
      ipAddress: entry.ip_address || 'Unknown',
    }));
  }

  /**
   * Verify JWT token and get user
   */
  static async verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      // Use admin client for token verification (server-side operation)
      const { data, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !data.user) {
        return null;
      }

      return {
        userId: data.user.id,
        email: data.user.email!,
      };
    } catch (error) {
      logger.error('Token verification error:', error);
      return null;
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } | null> {
    try {
      // Use regular client for token refresh
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        return null;
      }

      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in || 3600,
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      return null;
    }
  }

  /**
   * Reset password using access token from password reset email
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      if (!token) {
        throw new ValidationError('Access token is required');
      }

      if (!newPassword) {
        throw new ValidationError('New password is required');
      }

      const pwStrength = validatePasswordStrength(newPassword);
      if (!pwStrength.isValid) {
        throw new ValidationError(`Password too weak: ${pwStrength.errors.join(', ')}`);
      }

      // Verify token and get user
      const userData = await AuthService.verifyToken(token);
      if (!userData) {
        throw new AuthenticationError('Invalid or expired reset token');
      }

      // Use admin client to update password
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        userData.userId,
        { password: newPassword }
      );

      if (error) {
        logger.error('Password reset error:', error);
        throw new AuthenticationError(`Failed to reset password: ${error.message}`);
      }

      logger.info(`Password reset successful for user: ${userData.email} (${userData.userId})`);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error;
      }
      logger.error('Password reset error:', error);
      throw new AuthenticationError('Failed to reset password');
    }
  }

  /**
   * Logout user
   * Note: Supabase doesn't provide server-side session invalidation.
   * This method verifies the token and logs the logout action.
   * The client should clear the token from storage.
   */
  static async logout(token: string): Promise<void> {
    try {
      // Verify token first to get user
      const userData = await AuthService.verifyToken(token);

      if (userData) {
        // Log the logout action
        // Note: Supabase handles session management client-side
        // The client should clear tokens from storage after calling this endpoint
        logger.info(`User logged out: ${userData.email} (${userData.userId})`);

        // Optionally log usage
        await DatabaseService.logUsage(userData.userId, 'query', {
          action: 'logout',
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.warn('Logout attempted with invalid token');
      }
    } catch (error) {
      logger.error('Logout error:', error);
      // Don't throw - logout should always succeed to prevent token enumeration
    }
  }
}
