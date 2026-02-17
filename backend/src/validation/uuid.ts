/**
 * UUID Validation Utilities
 *
 * Provides helpers for validating UUID parameters in routes.
 * Supabase uses UUID v4 for all primary keys — rejecting malformed
 * IDs early prevents unnecessary database round-trips and potential
 * injection vectors.
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types/error';

/**
 * UUID v4 regex (case-insensitive, with or without hyphens).
 * Accepts standard 8-4-4-4-12 format.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check whether a string is a valid UUID.
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Assert that a value is a valid UUID, throwing ValidationError if not.
 *
 * @param value  The value to check
 * @param label  Human-readable label for the error message (e.g. "document ID")
 * @returns The validated UUID string
 */
export function assertUUID(value: unknown, label: string = 'ID'): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!isValidUUID(raw)) {
    throw new ValidationError(`Invalid ${label}: must be a valid UUID`);
  }
  return raw;
}

/**
 * Express middleware factory that validates one or more route params as UUIDs.
 *
 * Usage:
 *   router.get('/:id', validateUUIDParams('id'), handler)
 *   router.delete('/:id/items/:itemId', validateUUIDParams('id', 'itemId'), handler)
 *
 * On failure, responds with 400 and a clear error message.
 */
export function validateUUIDParams(...paramNames: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const name of paramNames) {
      const raw = req.params[name];
      if (!isValidUUID(raw)) {
        return next(
          new ValidationError(
            `Invalid ${name}: "${String(raw ?? '')}" is not a valid UUID`
          )
        );
      }
    }
    next();
  };
}

/**
 * Validate an array of UUIDs (e.g. documentIds in a request body).
 * Returns the validated array, or throws if any element is invalid.
 *
 * @param values   Array of values to validate
 * @param label    Label for error messages (e.g. "documentIds")
 * @param options  Optional: { maxLength, allowEmpty }
 */
export function validateUUIDArray(
  values: unknown,
  label: string = 'IDs',
  options: { maxLength?: number; allowEmpty?: boolean } = {}
): string[] {
  const { maxLength = 100, allowEmpty = true } = options;

  if (values === undefined || values === null) {
    if (allowEmpty) return [];
    throw new ValidationError(`${label} is required`);
  }

  if (!Array.isArray(values)) {
    throw new ValidationError(`${label} must be an array`);
  }

  if (!allowEmpty && values.length === 0) {
    throw new ValidationError(`${label} must not be empty`);
  }

  if (values.length > maxLength) {
    throw new ValidationError(
      `${label} exceeds maximum of ${maxLength} items`
    );
  }

  const validated: string[] = [];
  for (let i = 0; i < values.length; i++) {
    if (!isValidUUID(values[i])) {
      throw new ValidationError(
        `Invalid UUID at ${label}[${i}]: "${String(values[i])}"`
      );
    }
    validated.push(values[i] as string);
  }

  return validated;
}
