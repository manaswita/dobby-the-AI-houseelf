import { Router, Request, Response } from 'express';
import { db, seedInitialData, tryConnectMongoDB } from '../db';
import { config } from '../config';

const router = Router();

// GET /api/system/health
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const dbStatus = await db.getConnectionStatusAsync();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Dobby - The AI Elf Assistant Backend API',
    database: dbStatus,
    ai: {
      provider: 'Google Gemini AI',
      model: 'gemini-3.8-flash',
      configured: Boolean(config.geminiApiKey),
    },
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// POST /api/system/reconnect-db
router.post('/reconnect-db', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await tryConnectMongoDB();
    const dbStatus = await db.getConnectionStatusAsync();
    res.json({
      ...result,
      database: dbStatus,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      connectedToMongoDB: false,
      message: 'Failed to reconnect: ' + (err?.message || 'Unknown error'),
      error: err?.message,
    });
  }
});

// POST /api/system/seed
router.post('/seed', async (_req: Request, res: Response): Promise<void> => {
  try {
    await seedInitialData(true);
    res.json({
      message: 'Demo dataset successfully seeded!',
      users: [
        { email: 'alex@tasklens.io', password: 'password123', role: 'admin' },
        { email: 'sarah@tasklens.io', password: 'password123', role: 'admin' },
        { email: 'jordan@tasklens.io', password: 'password123', role: 'member' },
      ],
      db: db.getConnectionStatus(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Seeding failed: ' + err.message });
  }
});

// GET /api/system/endpoints
router.get('/endpoints', (_req: Request, res: Response): void => {
  res.json({
    title: 'TaskLens Node.js + MongoDB API Endpoints',
    endpoints: [
      { method: 'POST', path: '/api/auth/register', description: 'Register a new user' },
      { method: 'POST', path: '/api/auth/login', description: 'Login with email & password, returns JWT' },
      { method: 'GET', path: '/api/auth/me', description: 'Get current user profile' },
      { method: 'PUT', path: '/api/auth/profile', description: 'Update profile and notification preferences' },
      { method: 'POST', path: '/api/auth/device-token', description: 'Register push device token' },
      { method: 'GET', path: '/api/auth/users', description: 'List users' },
      { method: 'GET', path: '/api/groups', description: 'List groups user belongs to' },
      { method: 'POST', path: '/api/groups', description: 'Create group (family/team)' },
      { method: 'POST', path: '/api/groups/join', description: 'Join group via invite code' },
      { method: 'GET', path: '/api/tasks', description: 'List tasks with filtering' },
      { method: 'POST', path: '/api/tasks', description: 'Create task with automatic reminders' },
      { method: 'PUT', path: '/api/tasks/:id', description: 'Update task' },
      { method: 'POST', path: '/api/tasks/:id/complete', description: 'Toggle task completion' },
      { method: 'DELETE', path: '/api/tasks/:id', description: 'Delete task and reminders' },
      { method: 'GET', path: '/api/reminders', description: 'List active reminders for user' },
      { method: 'POST', path: '/api/reminders/:id/snooze', description: 'Snooze reminder' },
      { method: 'POST', path: '/api/reminders/:id/dismiss', description: 'Dismiss reminder' },
      { method: 'GET', path: '/api/notifications', description: 'Get in-app notification inbox' },
      { method: 'PUT', path: '/api/notifications/:id/read', description: 'Mark notification read' },
      { method: 'POST', path: '/api/ingest/analyze', description: 'AI task extraction with Gemini from raw text or messages' },
      { method: 'POST', path: '/api/ingest/confirm', description: 'Atomic confirmation transaction into MongoDB' },
      { method: 'GET', path: '/api/system/health', description: 'System health & MongoDB connection status' },
      { method: 'POST', path: '/api/system/seed', description: 'Reset & reseed demo database' },
    ],
  });
});

export default router;
