import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { notifier } from '../services/notifier';

const router = Router();

// GET /api/tasks
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { groupId, assignedTo, status, priority, search } = req.query;

    const queryParams: any = {
      userId: req.user._id,
    };
    if (groupId) queryParams.groupId = String(groupId);
    if (assignedTo) queryParams.assignedTo = String(assignedTo);
    if (status) queryParams.status = String(status);
    if (priority) queryParams.priority = String(priority);

    let tasks = await db.tasks.find(queryParams);

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      tasks = tasks.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q))
      );
    }

    // Hydrate tasks with user names & group names
    const allUsers = await db.users.listAll();
    const userMap = new Map(allUsers.map((u) => [String(u._id), u.name]));
    const userGroups = await db.groups.findForUser(req.user._id);
    const groupMap = new Map(userGroups.map((g) => [String(g._id), g.name]));

    const enriched = tasks.map((t) => ({
      ...t,
      creatorName: userMap.get(String(t.createdBy)) || 'Unknown',
      assigneeName: t.assignedTo ? userMap.get(String(t.assignedTo)) || 'Unassigned' : 'Unassigned',
      groupName: t.groupId ? groupMap.get(String(t.groupId)) || 'Group' : 'Personal',
    }));

    res.json({ tasks: enriched, count: enriched.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      title,
      description,
      priority,
      status,
      dueDate,
      dueTime,
      assignedTo,
      groupId,
      sourceEvidence,
      createReminders, // array of minutes, e.g. [60, 1440]
    } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Task title is required.' });
      return;
    }

    const task = await db.tasks.create({
      title: title.trim(),
      description: description?.trim() || '',
      priority: priority || 'medium',
      status: status || 'pending',
      dueDate,
      dueTime,
      timeZone: req.user.timeZone || 'UTC',
      createdBy: req.user._id,
      assignedTo: assignedTo || req.user._id,
      groupId: groupId || undefined,
      sourceEvidence,
    });

    // Create automatic reminders if requested or if due date is provided
    const createdReminders = [];
    if (dueDate) {
      const reminderOffsets = Array.isArray(createReminders) && createReminders.length > 0 ? createReminders : [60]; // default: 1 hour before

      for (const minutes of reminderOffsets) {
        try {
          const dueDateTimeStr = dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T09:00:00`;
          const dueMs = new Date(dueDateTimeStr).getTime();
          if (!isNaN(dueMs)) {
            const triggerMs = dueMs - minutes * 60 * 1000;
            const reminder = await db.reminders.create({
              taskId: task._id,
              userId: task.assignedTo || req.user._id,
              triggerTime: new Date(triggerMs).toISOString(),
              relativeMinutes: minutes,
              type: 'relative',
              status: 'scheduled',
              title: `Reminder: "${task.title}" is due in ${minutes >= 60 ? Math.round(minutes / 60) + 'h' : minutes + 'm'}`,
            });
            createdReminders.push(reminder);
          }
        } catch (e) {
          console.warn('Could not schedule reminder:', e);
        }
      }
    }

    // Send notifications if assigned to another user
    if (task.assignedTo && task.assignedTo !== req.user._id) {
      await db.notifications.create({
        userId: task.assignedTo,
        title: 'New Task Assigned',
        message: `${req.user.name} assigned you: "${task.title}"`,
        type: 'task_assigned',
        refId: task._id,
      });

      // Dispatch Email & WhatsApp notification to the assignee
      db.users.findById(task.assignedTo).then((assignee) => {
        if (assignee) {
          notifier.dispatchTaskAssignedAlert({
            task,
            assignee,
            assigner: req.user,
          }).catch((e) => console.error('Error dispatching assignment alert:', e));
        }
      }).catch((e) => console.error('Error finding assignee:', e));
    }

    res.status(201).json({ task, reminders: createdReminders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const task = await db.tasks.findById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const reminders = await db.reminders.findByTaskId(task._id);

    res.json({ task, reminders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const task = await db.tasks.findById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const updates = req.body;
    if (updates.status === 'completed' && task.status !== 'completed') {
      updates.completedAt = new Date().toISOString();
    } else if (updates.status && updates.status !== 'completed') {
      updates.completedAt = undefined;
    }

    const updated = await db.tasks.update(task._id, updates);

    // If reassigned, notify the new assignee
    if (updates.assignedTo && updates.assignedTo !== task.assignedTo && updates.assignedTo !== req.user._id) {
      await db.notifications.create({
        userId: updates.assignedTo,
        title: 'Task Reassigned',
        message: `${req.user.name} assigned you: "${updated?.title}"`,
        type: 'task_assigned',
        refId: task._id,
      });

      if (updated) {
        db.users.findById(updates.assignedTo).then((assignee) => {
          if (assignee) {
            notifier.dispatchTaskAssignedAlert({
              task: updated,
              assignee,
              assigner: req.user,
            }).catch((e) => console.error('Error dispatching reassignment alert:', e));
          }
        }).catch((e) => console.error('Error finding assignee:', e));
      }
    }

    res.json({ task: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/complete
router.post('/:id/complete', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const task = await db.tasks.findById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const isCompleted = task.status === 'completed';
    const newStatus = isCompleted ? 'pending' : 'completed';
    const completedAt = isCompleted ? undefined : new Date().toISOString();

    const updated = await db.tasks.update(task._id, {
      status: newStatus,
      completedAt,
    });

    if (newStatus === 'completed' && task.createdBy !== req.user._id) {
      await db.notifications.create({
        userId: task.createdBy,
        title: 'Task Completed',
        message: `${req.user.name} completed: "${task.title}"`,
        type: 'task_completed',
        refId: task._id,
      });
    }

    res.json({ task: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const task = await db.tasks.findById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    await db.tasks.delete(task._id);
    res.json({ message: 'Task deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
