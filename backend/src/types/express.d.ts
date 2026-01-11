import { Request } from 'express';
import { User } from './user';

// Extend Express Request to include user property
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
