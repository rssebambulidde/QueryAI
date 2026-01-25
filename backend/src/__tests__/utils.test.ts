import { describe, it, expect } from '@jest/globals';

describe('Utility Functions', () => {
  describe('Basic Math', () => {
    it('should add two numbers correctly', () => {
      expect(1 + 1).toBe(2);
    });

    it('should multiply numbers correctly', () => {
      expect(2 * 3).toBe(6);
    });
  });

  describe('String Operations', () => {
    it('should trim strings correctly', () => {
      expect('  hello  '.trim()).toBe('hello');
    });

    it('should validate email format', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test('test@example.com')).toBe(true);
      expect(emailRegex.test('invalid-email')).toBe(false);
    });
  });
});
