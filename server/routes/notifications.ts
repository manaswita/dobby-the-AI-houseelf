import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { notifier } from '../services/notifier';
import { config } from '../config';

const router = Router();

// GET /api/notifications
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const notifications = await db.notifications.findForUser(req.user._id);
    const unreadCount = notifications.filter((n) => !n.read).length;

    res.json({ notifications, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/channels-status
router.get('/channels-status', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = notifier.getServiceStatus();
    res.json({
      channels: status,
      userPrefs: req.user?.notificationPrefs || {},
      userContact: {
        phoneNumber: req.user?.phoneNumber || '',
        whatsappPhone: req.user?.notificationPrefs?.whatsappPhone || req.user?.phoneNumber || '',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/delivery-logs
router.get('/delivery-logs', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const logs = await db.deliveryLogs.findForUser(req.user._id);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/settings
router.put('/settings', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      whatsapp,
      inApp,
      whatsappPhone,
      phoneNumber,
      notifyOnAssigned,
      notifyOnReminder,
      notifyOnDailyDigest,
    } = req.body;

    const currentPrefs = req.user.notificationPrefs || {};
    const updatedPrefs = {
      ...currentPrefs,
      whatsapp: whatsapp !== undefined ? Boolean(whatsapp) : currentPrefs.whatsapp !== false,
      inApp: inApp !== undefined ? Boolean(inApp) : currentPrefs.inApp !== false,
      whatsappPhone: whatsappPhone ? String(whatsappPhone).trim() : currentPrefs.whatsappPhone || req.user.phoneNumber || '',
      notifyOnAssigned: notifyOnAssigned !== undefined ? Boolean(notifyOnAssigned) : currentPrefs.notifyOnAssigned !== false,
      notifyOnReminder: notifyOnReminder !== undefined ? Boolean(notifyOnReminder) : currentPrefs.notifyOnReminder !== false,
      notifyOnDailyDigest: notifyOnDailyDigest !== undefined ? Boolean(notifyOnDailyDigest) : currentPrefs.notifyOnDailyDigest !== false,
    };

    const userUpdates: any = {
      notificationPrefs: updatedPrefs,
    };
    if (phoneNumber !== undefined) {
      userUpdates.phoneNumber = String(phoneNumber).trim();
    } else if (whatsappPhone) {
      userUpdates.phoneNumber = String(whatsappPhone).trim();
    }

    const updatedUser = await db.users.update(req.user._id, userUpdates);

    res.json({
      message: 'WhatsApp notification settings updated successfully',
      notificationPrefs: updatedPrefs,
      phoneNumber: updatedUser?.phoneNumber,
      user: updatedUser,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/test-whatsapp
router.post('/test-whatsapp', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { targetPhone } = req.body;
    const recipient = (
      targetPhone ||
      req.user.notificationPrefs?.whatsappPhone ||
      req.user.phoneNumber ||
      ''
    ).trim();

    if (!recipient) {
      res.status(400).json({ error: 'Target WhatsApp phone number is required (e.g. +14155552671 or +919876543210)' });
      return;
    }

    const testMessage =
      `✨ *Dobby — The AI Elf Assistant | WhatsApp Alerts Active!*\n\n` +
      `Hello *${req.user.name}*, your WhatsApp notification channel is connected to Dobby.\n\n` +
      `📌 You will receive real-time alerts for:\n` +
      `• Task assignments & updates\n` +
      `• Scheduled deadlines & reminders\n` +
      `• Shared family & team handoffs\n\n` +
      `Dashboard: ${config.appUrl}\n` +
      `_Dobby is ready to assist you!_`;

    const result = await notifier.sendWhatsApp({
      userId: req.user._id,
      to: recipient,
      message: testMessage,
    });

    res.json({
      message: result.status === 'sent'
        ? 'Live WhatsApp alert sent via Twilio!'
        : 'WhatsApp alert simulated! Click link to test in WhatsApp directly.',
      result,
      waLink: result.waLink,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const success = await db.notifications.markRead(req.params.id, req.user._id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const modified = await db.notifications.markAllRead(req.user._id);
    res.json({ message: 'All notifications marked as read', modifiedCount: modified });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
