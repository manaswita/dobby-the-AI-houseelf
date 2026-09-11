import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { notifier } from '../services/notifier';
import { checkDueRemindersNow } from '../services/reminderScheduler';

const router = Router();

// GET /api/reminders
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const reminders = await db.reminders.findForUser(req.user._id);

    // Enrich with task information
    const enriched = await Promise.all(
      reminders.map(async (r) => {
        const task = await db.tasks.findById(r.taskId);
        return {
          ...r,
          taskTitle: task?.title || 'Unknown Task',
          taskDueDate: task?.dueDate,
          taskPriority: task?.priority || 'medium',
          taskStatus: task?.status || 'pending',
        };
      })
    );

    res.json({ reminders: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders/:id/snooze
router.post('/:id/snooze', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { minutes = 15 } = req.body;
    const now = new Date();
    const newTriggerTime = new Date(now.getTime() + Number(minutes) * 60 * 1000).toISOString();

    const updated = await db.reminders.update(req.params.id, {
      status: 'snoozed',
      triggerTime: newTriggerTime,
    });

    if (!updated) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    res.json({ message: `Snoozed for ${minutes} minutes`, reminder: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders/:id/dismiss
router.post('/:id/dismiss', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const updated = await db.reminders.update(req.params.id, {
      status: 'dismissed',
    });

    if (!updated) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    res.json({ message: 'Reminder dismissed', reminder: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { taskId, triggerTime, relativeMinutes, type, title } = req.body;

    if (!taskId || !triggerTime) {
      res.status(400).json({ error: 'taskId and triggerTime are required' });
      return;
    }

    const task = await db.tasks.findById(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const reminder = await db.reminders.create({
      taskId,
      userId: req.user._id,
      triggerTime,
      relativeMinutes,
      type: type || 'custom',
      status: 'scheduled',
      title: title || `Reminder for "${task.title}"`,
    });

    res.status(201).json({ reminder });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders/check-due (trigger worker check manually)
router.post('/check-due', authenticateToken, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await checkDueRemindersNow();
    res.json({ message: 'Reminders checked', ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders/:id/trigger-now (instantly fire Email and WhatsApp alerts)
router.post('/:id/trigger-now', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const reminders = await db.reminders.findForUser(req.user._id);
    const reminder = reminders.find((r) => r._id === req.params.id);
    if (!reminder) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    const task = reminder.taskId ? await db.tasks.findById(reminder.taskId) : null;
    const taskTitle = task?.title || reminder.title;

    // 1. Create in-app notification
    await db.notifications.create({
      userId: req.user._id,
      title: `⏰ Reminder: ${taskTitle}`,
      message: task?.description || `Your reminder for "${taskTitle}" has been triggered.`,
      type: 'reminder',
      refId: task?._id || reminder._id,
      read: false,
    });

    // 2. Mark reminder as fired
    await db.reminders.update(reminder._id, { status: 'fired' });

    // 3. Dispatch Email and WhatsApp
    const dispatchResults = await notifier.dispatchReminderAlert({
      reminder,
      task,
      user: req.user,
    });

    res.json({
      message: `Alert triggered successfully for "${taskTitle}"`,
      dispatch: dispatchResults,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await db.reminders.delete(req.params.id);
    res.json({ message: 'Reminder deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
