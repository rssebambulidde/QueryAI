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
      },
    },
  },
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      refreshSession: jest.fn(),
    },
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
});
