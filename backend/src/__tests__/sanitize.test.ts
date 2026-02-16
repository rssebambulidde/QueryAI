import {
  sanitizePostgrestValue,
  sanitizeLikeValue,
  validateSearchInput,
} from '../validation/sanitize';

describe('sanitizePostgrestValue', () => {
  it('returns plain text unchanged', () => {
    expect(sanitizePostgrestValue('hello world')).toBe('hello world');
  });

  it('escapes percent signs', () => {
    expect(sanitizePostgrestValue('100%')).toBe('100\\%');
  });

  it('escapes underscores', () => {
    expect(sanitizePostgrestValue('test_name')).toBe('test\\_name');
  });

  it('escapes commas that could inject new filter conditions', () => {
    expect(sanitizePostgrestValue('a,b')).toBe('a\\,b');
  });

  it('escapes dots that could inject new operators', () => {
    expect(sanitizePostgrestValue('role.eq.admin')).toBe('role\\.eq\\.admin');
  });

  it('escapes parentheses', () => {
    expect(sanitizePostgrestValue('(test)')).toBe('\\(test\\)');
  });

  it('escapes backslashes', () => {
    expect(sanitizePostgrestValue('a\\b')).toBe('a\\\\b');
  });

  it('escapes asterisks', () => {
    expect(sanitizePostgrestValue('test*')).toBe('test\\*');
  });

  it('handles empty string', () => {
    expect(sanitizePostgrestValue('')).toBe('');
  });

  it('neutralizes a realistic SQL injection attempt via .or() breakout', () => {
    const malicious = '%,full_name.eq.admin)--';
    const sanitized = sanitizePostgrestValue(malicious);
    expect(sanitized).toBe('\\%\\,full\\_name\\.eq\\.admin\\)--');
    expect(sanitized).not.toContain(',full_name.eq');
  });

  it('neutralizes role escalation attempt', () => {
    const malicious = '%,role.eq.super_admin';
    const sanitized = sanitizePostgrestValue(malicious);
    expect(sanitized).toBe('\\%\\,role\\.eq\\.super\\_admin');
    expect(sanitized).not.toContain(',role.eq');
  });

  it('handles combined special characters', () => {
    const input = 'user@test.com (admin), 50%';
    const sanitized = sanitizePostgrestValue(input);
    expect(sanitized).toBe('user@test\\.com \\(admin\\)\\, 50\\%');
  });
});

describe('sanitizeLikeValue', () => {
  it('returns plain text unchanged', () => {
    expect(sanitizeLikeValue('hello')).toBe('hello');
  });

  it('escapes percent signs', () => {
    expect(sanitizeLikeValue('100%')).toBe('100\\%');
  });

  it('escapes underscores', () => {
    expect(sanitizeLikeValue('test_name')).toBe('test\\_name');
  });

  it('escapes backslashes', () => {
    expect(sanitizeLikeValue('a\\b')).toBe('a\\\\b');
  });

  it('does not escape commas or dots (safe in .ilike() values)', () => {
    expect(sanitizeLikeValue('a,b.c')).toBe('a,b.c');
  });

  it('handles empty string', () => {
    expect(sanitizeLikeValue('')).toBe('');
  });
});

describe('validateSearchInput', () => {
  it('returns trimmed string for valid input', () => {
    expect(validateSearchInput('  hello  ')).toBe('hello');
  });

  it('returns null for empty string', () => {
    expect(validateSearchInput('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(validateSearchInput('   ')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(validateSearchInput(123)).toBeNull();
    expect(validateSearchInput(undefined)).toBeNull();
    expect(validateSearchInput(null)).toBeNull();
    expect(validateSearchInput({})).toBeNull();
  });

  it('truncates input exceeding max length', () => {
    const longInput = 'a'.repeat(300);
    const result = validateSearchInput(longInput);
    expect(result).toHaveLength(200);
  });

  it('respects custom max length', () => {
    const input = 'a'.repeat(50);
    const result = validateSearchInput(input, 30);
    expect(result).toHaveLength(30);
  });

  it('returns full string when under max length', () => {
    expect(validateSearchInput('short', 200)).toBe('short');
  });
});
