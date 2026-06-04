/**
 * RFC 5321 / RFC 5322 compliant email validation utilities.
 *
 * @see https://www.rfc-editor.org/rfc/rfc5321
 * @see https://www.rfc-editor.org/rfc/rfc5322
 */

/**
 * Maximum total length of an email address (RFC 5321 § 4.5.3.1.1).
 */
export const EMAIL_MAX_LENGTH = 254;

/**
 * Maximum length of the local-part (before @) (RFC 5321 § 4.5.3.1.1).
 */
export const EMAIL_LOCAL_PART_MAX_LENGTH = 64;

/**
 * RFC-oriented email validation regex.
 *
 * Covers the vast majority of real-world addresses while staying readable:
 * - Local part: alphanumeric, dots (not leading/trailing/consecutive), and
 *   common special characters `!#$%&'*+/=?^_`{|}~-`.
 * - Domain part: standard domain labels separated by dots, with a TLD of 2–63
 *   lowercase letters.
 *
 * This intentionally rejects quoted local parts and IP-literal domains (rare in
 * practice and a common vector for abuse) while accepting virtually every
 * address a user would legitimately type.
 */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,63}$/;

/**
 * Validates an email address against RFC length and format constraints.
 *
 * @param email - The email address to validate (should be pre-trimmed).
 * @returns `true` when the address satisfies both length and format rules.
 */
export function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH) {
    return false;
  }

  const atIndex = email.indexOf("@");
  if (atIndex === -1) {
    return false;
  }

  const localPart = email.slice(0, atIndex);

  if (localPart.length > EMAIL_LOCAL_PART_MAX_LENGTH) {
    return false;
  }

  // Local part must not start or end with a dot, or contain consecutive dots.
  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return false;
  }

  return EMAIL_RE.test(email);
}
