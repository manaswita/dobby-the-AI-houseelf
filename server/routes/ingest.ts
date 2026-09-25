import { Router, Response } from 'express';
import multer from 'multer';
import { db } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { extractTasksFromContent } from '../services/gemini';
import { ITaskSuggestion } from '../models/types';

const router = Router();

// Configure multer memory storage for documents, pdfs, images, and chat logs up to 30MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB
  },
});

// POST /api/ingest/analyze
// Supports both multipart/form-data (single or multiple file uploads) and application/json (pasted text / base64 image / SMS / WhatsApp)
router.post('/analyze', upload.any() as any, authenticateToken as any, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const rawInputType = req.body.inputType;
    const groupId = req.body.groupId;

    // Gather all uploaded files (supports single or multiple file uploads via 'files' or 'file')
    const rawFiles: Express.Multer.File[] = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[])
      : req.file
      ? [req.file]
      : [];

    const filesToProcess: Array<{ buffer: Buffer; mimeType: string; fileName: string }> = rawFiles.map((f) => ({
      buffer: f.buffer,
      mimeType: f.mimetype,
      fileName: f.originalname,
    }));

    // Check for base64 payload(s) via JSON if provided
    if (req.body.fileBase64) {
      try {
        filesToProcess.push({
          buffer: Buffer.from(req.body.fileBase64, 'base64'),
          mimeType: req.body.fileMimeType || 'image/png',
          fileName: req.body.fileName || 'pasted_image.png',
        });
      } catch (e: any) {
        console.warn('Could not decode fileBase64:', e?.message || e);
      }
    }

    if (Array.isArray(req.body.filesBase64)) {
      for (const fb of req.body.filesBase64) {
        try {
          if (fb && fb.base64) {
            filesToProcess.push({
              buffer: Buffer.from(fb.base64, 'base64'),
              mimeType: fb.mimeType || 'application/octet-stream',
              fileName: fb.fileName || 'attachment',
            });
          }
        } catch (e: any) {
          console.warn('Could not decode filesBase64 item:', e?.message || e);
        }
      }
    }

    if (!text && filesToProcess.length === 0) {
      res.status(400).json({
        error:
          'Please provide content: paste a message or text, or upload one or more documents (.docx/.doc), PDFs, images/screenshots, SMS logs, or WhatsApp chats.',
      });
      return;
    }

    // Determine canonical inputType across provided files and payload
    let detectedInputType: 'text' | 'image' | 'document' | 'message' = 'text';

    if (rawInputType === 'message' || rawInputType === 'sms' || rawInputType === 'whatsapp') {
      detectedInputType = 'message';
    } else if (
      filesToProcess.some(
        (f) =>
          f.mimeType.toLowerCase() === 'application/pdf' ||
          f.mimeType.toLowerCase().includes('word') ||
          f.fileName.match(/\.(pdf|docx?|rtf|odt)$/i)
      )
    ) {
      detectedInputType = 'document';
    } else if (
      filesToProcess.some(
        (f) =>
          f.mimeType.toLowerCase().startsWith('image/') ||
          f.fileName.match(/\.(png|jpe?g|webp|gif|bmp|heic)$/i)
      )
    ) {
      detectedInputType = 'image';
    } else if (filesToProcess.some((f) => f.fileName.match(/(chat|whatsapp|sms|_chat)\.txt$/i))) {
      detectedInputType = 'message';
    } else if (rawInputType && ['text', 'image', 'document', 'message'].includes(rawInputType)) {
      detectedInputType = rawInputType;
    }

    // Fetch members of target group for intelligent assignee suggestion
    let groupMembers: Array<{ id: string; name: string }> = [];
    if (groupId) {
      const group = await db.groups.findById(groupId);
      if (group) {
        const allUsers = await db.users.listAll();
        const userMap = new Map(allUsers.map((u) => [u._id, u.name]));
        groupMembers = group.members.map((m) => ({
          id: m.userId,
          name: userMap.get(m.userId) || 'Member',
        }));
      }
    } else {
      // Include user and all members in their default group
      const userGroups = await db.groups.findForUser(req.user._id);
      const allUsers = await db.users.listAll();
      const userMap = new Map(allUsers.map((u) => [u._id, u.name]));
      const memberIds = new Set<string>();
      memberIds.add(req.user._id);
      for (const g of userGroups) {
        for (const m of g.members) memberIds.add(m.userId);
      }
      groupMembers = Array.from(memberIds).map((id) => ({
        id,
        name: userMap.get(id) || 'Member',
      }));
    }

    // Run AI extraction pipeline across all files and text
    const result = await extractTasksFromContent({
      text,
      files: filesToProcess,
      inputType: detectedInputType,
      userTimeZone: req.user.timeZone,
      userLocale: req.user.locale,
      groupMembers,
      currentDateTime: new Date().toISOString(),
    });

    const fileNames = filesToProcess.map((f) => f.fileName);
    const primaryFileName = fileNames.join(', ');
    const recordedRawText = text
      ? `${text}${fileNames.length > 0 ? `\n[Attachments: ${primaryFileName}]` : ''}`
      : fileNames.length > 0
      ? `Attached files (${filesToProcess.length}): ${primaryFileName}`
      : 'Uploaded Content';

    // Save IngestionRun record in MongoDB
    const ingestion = await db.ingestions.create({
      userId: req.user._id,
      rawText: recordedRawText,
      inputType: detectedInputType,
      extractedSuggestions: result.suggestions,
      status: 'analyzed',
    });

    res.json({
      ingestionId: ingestion._id,
      status: 'needs_review',
      suggestionsCount: result.suggestions.length,
      suggestions: result.suggestions,
      availableMembers: groupMembers,
      engine: result.engine,
      notice: result.notice,
      detectedInputType,
      fileName: primaryFileName || undefined,
      fileNames,
      filesCount: filesToProcess.length,
      extractedTextPreview: result.extractedTextPreview,
    });
  } catch (err: any) {
    console.error('Ingest analyze error:', err?.message || err);
    res.status(500).json({ error: 'Task extraction failed: ' + (err?.message || 'Unknown error') });
  }
});

// POST /api/ingest/confirm
// Atomic confirmation transaction: converts human-reviewed suggestions into authoritative tasks & reminders
router.post('/confirm', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { ingestionId, groupId, confirmedTasks } = req.body;

    if (!Array.isArray(confirmedTasks) || confirmedTasks.length === 0) {
      res.status(400).json({ error: 'At least one confirmed task is required.' });
      return;
    }

    const createdTasks = [];
    const createdReminders = [];

    for (const item of confirmedTasks) {
      if (!item.title || !item.title.trim()) continue;

      // Create authoritative task in MongoDB
      const task = await db.tasks.create({
        title: item.title.trim(),
        description: item.description?.trim() || '',
        priority: ['low', 'medium', 'high'].includes(item.priority) ? item.priority : 'medium',
        status: 'pending',
        dueDate: item.dueDate,
        dueTime: item.dueTime,
        timeZone: req.user.timeZone || 'UTC',
        createdBy: req.user._id,
        assignedTo: item.assignedTo || req.user._id,
        groupId: groupId || undefined,
        sourceEvidence: {
          excerpt: item.sourceExcerpt,
          confidence: item.confidence,
          originalExpression: item.originalExpression,
        },
      });

      createdTasks.push(task);

      // Create default reminders if due date exists
      if (item.dueDate) {
        try {
          const dueDateTimeStr = item.dueTime ? `${item.dueDate}T${item.dueTime}:00` : `${item.dueDate}T09:00:00`;
          const dueMs = new Date(dueDateTimeStr).getTime();
          if (!isNaN(dueMs)) {
            // Schedule 1 hour before
            const oneHourBefore = new Date(dueMs - 60 * 60 * 1000).toISOString();
            const reminder = await db.reminders.create({
              taskId: task._id,
              userId: task.assignedTo || req.user._id,
              triggerTime: oneHourBefore,
              relativeMinutes: 60,
              type: 'relative',
              status: 'scheduled',
              title: `Reminder: "${task.title}" is due soon`,
            });
            createdReminders.push(reminder);
          }
        } catch (e) {
          console.warn('Could not schedule reminder for task:', e);
        }
      }

      // Notify assignee if not the creator
      if (task.assignedTo && task.assignedTo !== req.user._id) {
        await db.notifications.create({
          userId: task.assignedTo,
          title: 'New AI-Extracted Task Assigned',
          message: `${req.user.name} confirmed and assigned you: "${task.title}"`,
          type: 'task_assigned',
          refId: task._id,
        });
      }
    }

    // Mark ingestion run as confirmed if ingestionId provided
    if (ingestionId) {
      await db.ingestions.update(ingestionId, {
        status: 'confirmed',
        confirmedTaskIds: createdTasks.map((t) => t._id),
      });
    }

    res.status(201).json({
      message: `Successfully confirmed and stored ${createdTasks.length} tasks and ${createdReminders.length} reminders.`,
      tasks: createdTasks,
      reminders: createdReminders,
    });
  } catch (err: any) {
    console.error('Ingest confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm tasks: ' + err.message });
  }
});

// GET /api/ingest/runs
router.get('/runs', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const runs = await db.ingestions.findForUser(req.user._id);
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
