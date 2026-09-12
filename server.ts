import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { config } from './server/config';
import { initDatabase } from './server/db';
import authRoutes from './server/routes/auth';
import groupRoutes from './server/routes/groups';
import taskRoutes from './server/routes/tasks';
import reminderRoutes from './server/routes/reminders';
import notificationRoutes from './server/routes/notifications';
import ingestRoutes from './server/routes/ingest';
import systemRoutes from './server/routes/system';
import { startReminderScheduler } from './server/services/reminderScheduler';

async function startServer() {
  const app = express();
  const PORT = config.port;

  // Global Middlewares
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Initialize Database (MongoDB / Local Store) & seed initial data
  await initDatabase();

  // Start background reminder worker (checks for due reminders and fires Email/WhatsApp alerts)
  startReminderScheduler(20000);

  // API Routes MUST be mounted before Vite middleware
  app.use('/api/auth', authRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/reminders', reminderRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/ingest', ingestRoutes);
  app.use('/api/system', systemRoutes);

  // Health alias
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Direct project ZIP download route for instant migration between accounts
  app.get('/api/download-project-zip', (req, res) => {
    const zipPath = path.join(process.cwd(), 'public', 'dobby-project.zip');
    res.download(zipPath, 'dobby-ai-elf-assistant.zip', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Failed to download zip' });
      }
    });
  });

  // Vite middleware for development vs Static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TaskLens Node.js backend running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error during server startup:', err);
  process.exit(1);
});
