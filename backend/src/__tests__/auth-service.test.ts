import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthService } from '../services/auth.service';
import { ValidationError } from '../types/error';

// Mock Supabase
jest.mock('../config/database', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn(),
      admin: {
        updateUserById: jest.fn(),
        inviteUserByEmail: jest.fn(),
      },
    },
  },
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithOtp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

jest.mock('../config/env', () => ({
  __esModule: true,
  default: {
    CORS_ORIGIN: 'http://localhost:3000',
    API_BASE_URL: 'http://localhost:3001',
  },
}));

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(function () {
      return { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    }),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should validate email format', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test('valid@email.com')).toBe(true);
      expect(emailRegex.test('invalid-email')).toBe(false);
      expect(emailRegex.test('missing@domain')).toBe(false);
    });

    it('should validate password length', () => {
      const minLength = 8;
      expect('short'.length >= minLength).toBe(false);
      expect('longenough'.length >= minLength).toBe(true);
    });
  });

  describe('Token Verification', () => {
    it('should extract token from Authorization header', () => {
      const authHeader = 'Bearer test-token-123';
      const parts = authHeader.split(' ');
      expect(parts.length).toBe(2);
      expect(parts[0]).toBe('Bearer');
      expect(parts[1]).toBe('test-token-123');
    });

    it('should handle invalid Authorization header format', () => {
      const invalidHeaders = [
        'InvalidFormat',
        'Bearer',
        '',
        'Bearer token1 token2',
      ];

      invalidHeaders.forEach((header) => {
        const parts = header.split(' ');
        expect(parts.length === 2 && parts[0] === 'Bearer').toBe(false);
      });
    });
  });

  describe('inviteUserByEmail', () => {
    beforeEach(async () => {
      const { supabaseAdmin } = await import('../config/database');
      (supabaseAdmin.auth.admin.inviteUserByEmail as jest.Mock).mockResolvedValue(
        { data: { user: { id: 'user-1' } }, error: null } as never
      );
    });

    it('should return invited: true when Supabase invite succeeds', async () => {
      const { supabaseAdmin } = await import('../config/database');
      (supabaseAdmin.auth.admin.inviteUserByEmail as jest.Mock).mockResolvedValue(
        { data: { user: { id: 'user-1' } }, error: null } as never
      );

      const result = await AuthService.inviteUserByEmail('friend@example.com');

      expect(result.invited).toBe(true);
      expect(result.error).toBeUndefined();
      expect(supabaseAdmin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
        'friend@example.com',
        expect.objectContaining({ redirectTo: expect.stringMatching(/\/accept-invite$/) })
      );
    });

    it('should trim and lowercase email', async () => {
      const { supabaseAdmin } = await import('../config/database');
      (supabaseAdmin.auth.admin.inviteUserByEmail as jest.Mock).mockResolvedValue(
        { data: { user: { id: 'user-1' } }, error: null } as never
      );

      await AuthService.inviteUserByEmail('  Friend@Example.COM  ');

      expect(supabaseAdmin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
        'friend@example.com',
        expect.any(Object)
      );
    });

    it('should return invited: true when user already invited (treat as success)', async () => {
      const { supabaseAdmin } = await import('../config/database');
      (supabaseAdmin.auth.admin.inviteUserByEmail as jest.Mock).mockResolvedValue(
        { data: null, error: { message: 'User has already been invited', code: 'user_exists' } } as never
      );

      const result = await AuthService.inviteUserByEmail('friend@example.com');

      expect(result.invited).toBe(true);
    });

    it('should return invited: false with error when Supabase returns other error', async () => {
      const { supabaseAdmin } = await import('../config/database');
      (supabaseAdmin.auth.admin.inviteUserByEmail as jest.Mock).mockResolvedValue(
        { data: null, error: { message: 'SMTP error', code: 'smtp_error' } } as never
      );

      const result = await AuthService.inviteUserByEmail('friend@example.com');

      expect(result.invited).toBe(false);
      expect(result.error).toBe('SMTP error');
    });

    it('should throw ValidationError when email is missing', async () => {
      await expect(AuthService.inviteUserByEmail('')).rejects.toThrow(ValidationError);
      await expect(AuthService.inviteUserByEmail((null as unknown) as string)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when email format is invalid', async () => {
      await expect(AuthService.inviteUserByEmail('invalid')).rejects.toThrow(ValidationError);
      await expect(AuthService.inviteUserByEmail('missing@domain')).rejects.toThrow(ValidationError);
    });
  });

  describe('requestMagicLink', () => {
    it('should call signInWithOtp with email and redirectTo /auth/callback', async () => {
      const { supabase } = await import('../config/database');
      (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ data: {}, error: null } as never);

      await AuthService.requestMagicLink('user@example.com');

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        options: { emailRedirectTo: expect.stringMatching(/\/auth\/callback$/) },
      });
    });

    it('should trim and lowercase email', async () => {
      const { supabase } = await import('../config/database');
      (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ data: {}, error: null } as never);

      await AuthService.requestMagicLink('  User@Example.COM  ');

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com' })
      );
    });

    it('should not throw when Supabase returns error (email enumeration protection)', async () => {
      const { supabase } = await import('../config/database');
      (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded', code: 'rate_limit' },
      } as never);

      await expect(AuthService.requestMagicLink('user@example.com')).resolves.not.toThrow();
    });

    it('should throw ValidationError when email is missing', async () => {
      await expect(AuthService.requestMagicLink('')).rejects.toThrow(ValidationError);
      await expect(AuthService.requestMagicLink((null as unknown) as string)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when email format is invalid', async () => {
      await expect(AuthService.requestMagicLink('invalid')).rejects.toThrow(ValidationError);
    });
  });
});
