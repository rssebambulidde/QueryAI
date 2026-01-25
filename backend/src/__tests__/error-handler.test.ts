import { describe, it, expect } from '@jest/globals';
import { ValidationError, AuthenticationError, NotFoundError, AppError } from '../types/error';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create validation error with 400 status', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.isOperational).toBe(true);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with 401 status', () => {
      const error = new AuthenticationError('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with 404 status', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('AppError', () => {
    it('should create custom app error', () => {
      const error = new AppError('Custom error', 500, 'CUSTOM_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.isOperational).toBe(true);
    });
  });
});
