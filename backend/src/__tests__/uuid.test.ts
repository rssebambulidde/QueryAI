import {
  isValidUUID,
  assertUUID,
  validateUUIDArray,
  validateUUIDParams,
} from '../validation/uuid';
import { ValidationError } from '../types/error';

describe('isValidUUID', () => {
  it('accepts a valid UUID v4', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts uppercase UUIDs', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rejects strings without hyphens', () => {
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
  });

  it('rejects too-short strings', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
  });

  it('rejects null / undefined / number', () => {
    expect(isValidUUID(null)).toBe(false);
    expect(isValidUUID(undefined)).toBe(false);
    expect(isValidUUID(12345)).toBe(false);
  });

  it('rejects SQL injection attempts', () => {
    expect(isValidUUID("'; DROP TABLE users;--")).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000; DROP')).toBe(false);
  });
});

describe('assertUUID', () => {
  it('returns the UUID for valid input', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(assertUUID(id)).toBe(id);
  });

  it('handles array input (Express params quirk)', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(assertUUID([id])).toBe(id);
  });

  it('throws ValidationError for invalid UUID', () => {
    expect(() => assertUUID('not-a-uuid')).toThrow(ValidationError);
  });

  it('includes the label in the error message', () => {
    expect(() => assertUUID('bad', 'document ID')).toThrow(
      /Invalid document ID/
    );
  });

  it('throws for undefined', () => {
    expect(() => assertUUID(undefined, 'test')).toThrow(ValidationError);
  });
});

describe('validateUUIDArray', () => {
  const valid1 = '550e8400-e29b-41d4-a716-446655440000';
  const valid2 = '660e8400-e29b-41d4-a716-446655440000';

  it('returns validated array for valid UUIDs', () => {
    expect(validateUUIDArray([valid1, valid2], 'docIds')).toEqual([valid1, valid2]);
  });

  it('returns empty array for undefined when allowEmpty is true', () => {
    expect(validateUUIDArray(undefined, 'ids')).toEqual([]);
  });

  it('throws for undefined when allowEmpty is false', () => {
    expect(() => validateUUIDArray(undefined, 'ids', { allowEmpty: false })).toThrow(
      /ids is required/
    );
  });

  it('throws for empty array when allowEmpty is false', () => {
    expect(() => validateUUIDArray([], 'ids', { allowEmpty: false })).toThrow(
      /ids must not be empty/
    );
  });

  it('throws for non-array input', () => {
    expect(() => validateUUIDArray('not-array', 'ids')).toThrow(
      /ids must be an array/
    );
  });

  it('throws for array exceeding maxLength', () => {
    const big = Array(101).fill(valid1);
    expect(() => validateUUIDArray(big, 'ids')).toThrow(/exceeds maximum/);
  });

  it('throws for invalid UUID in array with index', () => {
    expect(() => validateUUIDArray([valid1, 'bad'], 'ids')).toThrow(
      /ids\[1\]/
    );
  });

  it('respects custom maxLength', () => {
    expect(() =>
      validateUUIDArray([valid1, valid2, valid1], 'ids', { maxLength: 2 })
    ).toThrow(/exceeds maximum of 2/);
  });
});

describe('validateUUIDParams', () => {
  const mockNext = jest.fn();

  beforeEach(() => {
    mockNext.mockClear();
  });

  it('calls next() for valid UUID param', () => {
    const req = { params: { id: '550e8400-e29b-41d4-a716-446655440000' } } as any;
    const res = {} as any;
    validateUUIDParams('id')(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('calls next(ValidationError) for invalid UUID param', () => {
    const req = { params: { id: 'not-valid' } } as any;
    const res = {} as any;
    validateUUIDParams('id')(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('validates multiple params', () => {
    const req = {
      params: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '660e8400-e29b-41d4-a716-446655440000',
      },
    } as any;
    const res = {} as any;
    validateUUIDParams('id', 'conversationId')(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('fails on first invalid param of multiple', () => {
    const req = {
      params: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: 'bad',
      },
    } as any;
    const res = {} as any;
    validateUUIDParams('id', 'conversationId')(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('includes param name in error message', () => {
    const req = { params: { id: 'bad' } } as any;
    const res = {} as any;
    validateUUIDParams('id')(req, res, mockNext);
    const error = mockNext.mock.calls[0][0];
    expect(error.message).toMatch(/id/);
  });
});
