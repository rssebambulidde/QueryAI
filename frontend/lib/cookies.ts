/**
 * Cookie names and helpers used by QueryAI.
 * Keeps cookie policy and code in sync.
 */

/** Cookie used to store user's consent (accepted/rejected). */
export const CONSENT_COOKIE_NAME = 'queryai_cookie_consent';

/** Max age for consent cookie in days. */
export const CONSENT_MAX_AGE_DAYS = 365;

export type ConsentValue = 'accepted' | 'rejected';

/** Get current consent value from cookie, or null if not set. */
export function getConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)`)
  );
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  return value === 'accepted' || value === 'rejected' ? value : null;
}

/** Set consent cookie. */
export function setConsent(value: ConsentValue): void {
  if (typeof document === 'undefined') return;
  const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** Clear consent cookie (e.g. for testing or "change mind"). */
export function clearConsent(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${CONSENT_COOKIE_NAME}=; path=/; max-age=0`;
}
