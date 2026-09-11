import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { authenticateToken, generateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, timeZone, locale, phoneNumber } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const existing = await db.users.findByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'A user with this email address already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.users.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phoneNumber: phoneNumber?.trim() || '',
      passwordHash,
      timeZone: timeZone || 'UTC',
      locale: locale || 'en-US',
      notificationPrefs: {
        email: true,
        whatsapp: true,
        inApp: true,
        push: true,
        alertEmail: email.trim().toLowerCase(),
        whatsappPhone: phoneNumber?.trim() || '',
      },
    });

    const token = generateToken(user);

    // Create a personal default group
    await db.groups.create({
      name: `${user.name}'s Family`,
      description: 'Default personal and household tasks',
      type: 'family',
      createdBy: user._id,
      members: [{ userId: user._id, role: 'admin', joinedAt: new Date().toISOString() }],
    });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        timeZone: user.timeZone,
        locale: user.locale,
        notificationPrefs: user.notificationPrefs,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to complete registration: ' + err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await db.users.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        timeZone: user.timeZone,
        locale: user.locale,
        notificationPrefs: user.notificationPrefs,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failure: ' + err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json({
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phoneNumber: req.user.phoneNumber,
      timeZone: req.user.timeZone,
      locale: req.user.locale,
      notificationPrefs: req.user.notificationPrefs,
      createdAt: req.user.createdAt,
    },
  });
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, timeZone, locale, phoneNumber, notificationPrefs } = req.body;
    const updates: any = {};
    if (name) updates.name = name.trim();
    if (timeZone) updates.timeZone = timeZone;
    if (locale) updates.locale = locale;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber.trim();
    if (notificationPrefs) updates.notificationPrefs = notificationPrefs;

    const updated = await db.users.update(req.user._id, updates);

    res.json({
      message: 'Profile updated',
      user: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update profile: ' + err.message });
  }
});

// POST /api/auth/device-token
router.post('/device-token', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Device token required' });
      return;
    }

    const currentTokens = req.user.deviceTokens || [];
    if (!currentTokens.includes(token)) {
      currentTokens.push(token);
      await db.users.update(req.user._id, { deviceTokens: currentTokens });
    }

    res.json({ message: 'Device token registered', tokenCount: currentTokens.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users
router.get('/users', authenticateToken, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const all = await db.users.listAll();
    const sanitized = all.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      timeZone: u.timeZone,
    }));
    res.json({ users: sanitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
