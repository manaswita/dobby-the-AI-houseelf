import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db';
import { IUser } from '../models/types';

export interface AuthRequest extends Request {
  user?: IUser;
}

export function generateToken(user: IUser): string {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
    },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string };
    let user = await db.users.findById(decoded.id);

    // Fallback to email if database connection reconnected with different generated IDs
    if (!user && decoded.email) {
      user = await db.users.findByEmail(decoded.email);
    }

    if (!user) {
      res.status(401).json({ error: 'User not found or session expired.' });
      return;
    }

    req.user = {
      ...user,
      _id: String(user._id),
    };
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired authentication token.' });
    return;
  }
}

export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string };
    const user = await db.users.findById(decoded.id);
    if (user) {
      req.user = user;
    }
  } catch {
    // Ignore invalid token in optional auth
  }

  next();
}
