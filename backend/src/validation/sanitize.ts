/**
 * Sanitization utilities for user input used in Supabase PostgREST queries.
 *
 * PostgREST filter strings (used in .or(), .filter(), .ilike(), etc.) are
 * parsed with a specific syntax where commas, periods, parentheses, and
 * percent signs have structural meaning. Unsanitized user input injected
 * into these filter strings can alter query logic.
 */

/**
 * Characters that carry structural meaning in PostgREST filter expressions.
 *
 * - `,` separates filter conditions inside .or()
 * - `.` separates column name, operator, and value
 * - `(` `)` group sub-expressions
 * - `%` and `_` are SQL LIKE wildcards
 * - `*` is a PostgREST wildcard in full-text search
 * - `\` could be used for escape sequences
 */
const POSTGREST_SPECIAL_CHARS: Record<string, string> = {
  '%': '\\%',
  '_': '\\_',
  ',': '\\,',
  '.': '\\.',
  '(': '\\(',
  ')': '\\)',
  '*': '\\*',
  '\\': '\\\\',
};

/**
 * Escapes special PostgREST filter characters in user-supplied values
 * that will be interpolated into .or() or .filter() strings.
 *
 * Use this when building filter strings like:
 *   query.or(`email.ilike.%${sanitized}%,name.ilike.%${sanitized}%`)
 *
 * This prevents a crafted input from breaking out of the intended
 * filter value and injecting additional filter conditions.
 *
 * @example
 *   sanitizePostgrestValue('test')          // 'test'
 *   sanitizePostgrestValue('a%b')           // 'a\\%b'
 *   sanitizePostgrestValue('%,role.eq.admin')// '\\%\\,role\\.eq\\.admin'
 */
export function sanitizePostgrestValue(input: string): string {
  let sanitized = '';
  for (const char of input) {
    sanitized += POSTGREST_SPECIAL_CHARS[char] ?? char;
  }
  return sanitized;
}

/**
 * Escapes SQL LIKE wildcards (% and _) in user-supplied values
 * used with Supabase .ilike() or .like() column methods.
 *
 * Use this when the value goes directly into .ilike(column, value)
 * rather than a .or() filter string. In this case only the SQL LIKE
 * wildcards need escaping, not the PostgREST syntax characters.
 *
 * @example
 *   sanitizeLikeValue('hello%world')  // 'hello\\%world'
 *   sanitizeLikeValue('test_name')    // 'test\\_name'
 */
export function sanitizeLikeValue(input: string): string {
  return input.replace(/[%_\\]/g, (char) => `\\${char}`);
}

/**
 * Validates and cleans a search query string before use in database queries.
 *
 * - Trims whitespace
 * - Enforces maximum length
 * - Returns null if the result is empty (caller should skip the filter)
 *
 * @param input  Raw user input
 * @param maxLength  Maximum allowed length (default: 200)
 * @returns  Cleaned string or null if empty/invalid
 */
export function validateSearchInput(
  input: unknown,
  maxLength: number = 200
): string | null {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) return trimmed.slice(0, maxLength);

  return trimmed;
}
