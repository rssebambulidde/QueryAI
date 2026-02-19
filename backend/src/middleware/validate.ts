/**
 * Generic Zod validation middleware.
 *
 * Returns structured 400 responses with field-level error messages:
 *   { success: false, errors: [{ field: "question", message: "Required" }] }
 *
 * Applied *before* authentication so that malformed requests fail-fast
 * without incurring auth overhead.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = formatZodErrors(result.error);

      res.status(400).json({
        success: false,
        errors,
      });
      return;
    }

    // Replace req.body with the parsed (and stripped) output so downstream
    // handlers receive a clean, typed object.
    req.body = result.data;
    next();
  };
}

function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '_root',
    message: issue.message,
  }));
}
