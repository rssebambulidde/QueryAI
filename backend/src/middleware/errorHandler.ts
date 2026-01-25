import { Request, Response, NextFunction } from 'express';
import { AppError, ApiError } from '../types/error';
import logger from '../config/logger';
import config from '../config/env';

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export const errorHandler = (
  err: Error | AppError | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error
  if (err instanceof AppError && err.isOperational) {
    logger.warn(`Operational error: ${err.message}`, {
      statusCode: err.statusCode,
      code: err.code,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Determine status code
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Determine error message
  let message = err.message || 'Internal server error';
  
  // Don't expose internal errors in production
  if (statusCode === 500 && config.NODE_ENV === 'production') {
    message = 'Internal server error';
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message,
      ...(err instanceof AppError && err.code ? { code: err.code } : {}),
      ...(config.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
    },
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};
