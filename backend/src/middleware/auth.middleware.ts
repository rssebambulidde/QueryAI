import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticationError } from '../types/error';
import logger from '../config/logger';

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('Authorization header missing');
    }

    // Extract token (format: "Bearer <token>")
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AuthenticationError('Invalid authorization header format. Use: Bearer <token>');
    }

    const token = parts[1];

    if (!token) {
      throw new AuthenticationError('Token missing');
    }

    // Verify token
    const userData = await AuthService.verifyToken(token);

    if (!userData) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Attach user to request
    req.user = {
      id: userData.userId,
      email: userData.email,
    };

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      next(error);
    } else {
      logger.error('Authentication middleware error:', error);
      next(new AuthenticationError('Authentication failed'));
    }
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(); // No auth header, continue without user
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next(); // Invalid format, continue without user
    }

    const token = parts[1];
    if (!token) {
      return next(); // No token, continue without user
    }

    // Try to verify token
    const userData = await AuthService.verifyToken(token);

    if (userData) {
      req.user = {
        id: userData.userId,
        email: userData.email,
      };
    }

    next();
  } catch (error) {
    // On error, just continue without user (optional auth)
    logger.warn('Optional authentication error:', error);
    next();
  }
};
