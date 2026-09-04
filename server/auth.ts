import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { dbStore, StoredUser } from './dbStore.js';
import { User, Role } from '../src/types.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'nexus_db_ai_secret_jwt_key_2026';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function sanitizeUser(user: StoredUser): User {
  const { passwordHash, ...rest } = user;
  return rest;
}

export function generateToken(user: User): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    let user = dbStore.getUserById(decoded.id) || dbStore.getUserByEmail(decoded.email);

    if (!user) {
      const fallbackUser = dbStore.users.find(
        (u) => u.id === decoded.id || u.email.toLowerCase() === (decoded.email || '').toLowerCase()
      );
      if (fallbackUser) {
        user = fallbackUser;
      } else if (decoded && decoded.id && decoded.email) {
        user = {
          id: decoded.id,
          name: decoded.name || decoded.email.split('@')[0],
          email: decoded.email,
          role: decoded.role || 'Admin',
          createdAt: new Date().toISOString(),
        } as StoredUser;
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found or session expired' });
    }

    req.user = sanitizeUser(user);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

export async function handleLogin(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const storedUser = dbStore.getUserByEmail(email);
  if (!storedUser || !storedUser.passwordHash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isMatch = await bcrypt.compare(password, storedUser.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const sanitized = sanitizeUser(storedUser);
  const token = generateToken(sanitized);

  dbStore.addLog(
    'User Login',
    sanitized.email,
    'success',
    `Authenticated successfully as ${sanitized.role}.`,
    sanitized.id
  );

  return res.json({
    token,
    user: sanitized,
    message: 'Login successful',
  });
}

export async function handleRegister(req: Request, res: Response) {
  const { name, email, password, confirmPassword, department } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }

  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const existing = dbStore.getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = 'user-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

  const newUser: StoredUser = {
    id: userId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    role: dbStore.users.length === 0 ? 'Admin' : 'Admin', // Give workspace admin rights
    department: department || 'Engineering',
    avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
    createdAt: new Date().toISOString(),
  };

  await dbStore.addUser(newUser);

  const sanitized = sanitizeUser(newUser);
  const token = generateToken(sanitized);

  dbStore.addLog(
    'User Registered',
    sanitized.email,
    'success',
    `New user account registered: ${sanitized.name}`,
    sanitized.id
  );

  return res.status(201).json({
    token,
    user: sanitized,
    message: 'Account created successfully',
  });
}

export async function handleForgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = dbStore.getUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'No registered user found with that email address.' });
  }

  // Generate secure reset token with 1 hour expiration
  const resetToken = 'rst-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
  const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await dbStore.updateUser(user.id, { resetToken, resetTokenExpiresAt });

  dbStore.addLog(
    'Password Reset Requested',
    email,
    'info',
    `Generated password reset token for ${email}`,
    user.id,
    'Auth'
  );

  dbStore.addNotification({
    id: 'notif-' + Date.now(),
    userId: user.id,
    title: 'Password Reset Token Generated',
    message: 'A password reset request was initiated for your account.',
    type: 'system',
    isRead: false,
    createdAt: new Date().toISOString(),
  });

  return res.json({
    message: `Password reset token generated successfully.`,
    resetToken,
    resetUrl: `/reset-password?token=${resetToken}`,
  });
}

export async function handleResetPassword(req: Request, res: Response) {
  const { token, newPassword, confirmPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const user = dbStore.getUserByResetToken(token);
  if (!user || !user.resetTokenExpiresAt) {
    return res.status(400).json({ error: 'Invalid or expired password reset token.' });
  }

  if (new Date(user.resetTokenExpiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Password reset token has expired. Please request a new one.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await dbStore.updateUser(user.id, {
    passwordHash,
    resetToken: undefined,
    resetTokenExpiresAt: undefined,
  });

  dbStore.addLog(
    'Password Reset Completed',
    user.email,
    'success',
    `Password reset completed successfully for ${user.email}`,
    user.id,
    'Auth'
  );

  return res.json({ message: 'Your password has been reset successfully. You can now log in.' });
}

export function handleGetCurrentUser(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: req.user });
}

export async function handleUpdateProfile(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const { name, department, avatar, themePreference, newPassword } = req.body;
  const updates: Partial<StoredUser> = {};

  if (name !== undefined) updates.name = name.trim();
  if (department !== undefined) updates.department = department.trim();
  if (avatar !== undefined) updates.avatar = avatar; // accepts base64 or url or empty string
  if (themePreference !== undefined) updates.themePreference = themePreference;

  if (newPassword) {
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const updatedUser = await dbStore.updateUser(req.user.id, updates);
  if (!updatedUser) return res.status(404).json({ error: 'User not found' });

  const sanitized = sanitizeUser(updatedUser);
  dbStore.addLog('Profile Updated', sanitized.email, 'info', 'User profile settings updated', sanitized.id, 'Account');

  return res.json({ user: sanitized, message: 'Profile updated successfully' });
}

export function handleLogout(req: AuthenticatedRequest, res: Response) {
  if (req.user) {
    dbStore.addLog(
      'User Logout',
      req.user.email,
      'info',
      `User ${req.user.name || req.user.email} signed out of session`,
      req.user.id,
      'Authentication'
    );
  }
  return res.json({ message: 'Logged out successfully' });
}

