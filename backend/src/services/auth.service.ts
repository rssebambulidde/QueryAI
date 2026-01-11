import { supabaseAdmin, supabase } from '../config/database';
import { DatabaseService } from './database.service';
import logger from '../config/logger';
import { AuthenticationError, ValidationError, ConflictError } from '../types/error';

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
    fullName?: string;
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

      if (data.password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new ValidationError('Invalid email format');
      }

      // Sign up user with Supabase Auth (use regular client for user operations)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName || '',
          },
        },
      });

      if (authError) {
        logger.error('Signup error:', authError);
        
        // Handle specific Supabase errors
        if (authError.message.includes('already registered')) {
          throw new ConflictError('User with this email already exists');
        }
        
        throw new AuthenticationError(`Signup failed: ${authError.message}`);
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
      await DatabaseService.createDefaultSubscription(authData.user.id);

      // Log signup
      await DatabaseService.logUsage(authData.user.id, 'query', {
        action: 'signup',
        timestamp: new Date().toISOString(),
      });

      logger.info(`New user signed up: ${data.email} (${authData.user.id})`);

      // Return auth response
      if (!authData.session) {
        // Email confirmation required
        return {
          user: {
            id: authData.user.id,
            email: authData.user.email!,
            fullName: data.fullName,
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
          fullName: profile?.full_name || data.fullName,
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
        
        if (authError.message.includes('Invalid login credentials')) {
          throw new AuthenticationError('Invalid email or password');
        }
        
        throw new AuthenticationError(`Login failed: ${authError.message}`);
      }

      if (!authData.user || !authData.session) {
        throw new AuthenticationError('Login failed: Invalid response from auth service');
      }

      // Get user profile
      const profile = await DatabaseService.getUserProfile(authData.user.id);

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
          fullName: profile?.full_name,
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.API_BASE_URL || 'http://localhost:3000'}/reset-password`,
      });

      if (error) {
        logger.error('Password reset request error:', error);
        // Don't reveal if email exists or not (security best practice)
        // Always return success
        return;
      }

      logger.info(`Password reset requested for email: ${email}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Password reset request error:', error);
      // Don't reveal errors to prevent email enumeration
    }
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
   * Logout user
   */
  static async logout(token: string): Promise<void> {
    try {
      // Verify token first to get user
      const userData = await AuthService.verifyToken(token);
      
      if (userData) {
        // Sign out the user
        const { error } = await supabaseAdmin.auth.admin.signOut(userData.userId);

        if (error) {
          logger.error('Logout error:', error);
        } else {
          logger.info('User logged out successfully');
        }
      }
    } catch (error) {
      logger.error('Logout error:', error);
    }
  }
}
