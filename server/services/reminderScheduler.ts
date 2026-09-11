import { db } from '../db';
import { notifier } from './notifier';

let intervalTimer: NodeJS.Timeout | null = null;
let isChecking = false;

export async function checkDueRemindersNow(): Promise<{
  checkedCount: number;
  firedCount: number;
  results: any[];
}> {
  if (isChecking) {
    return { checkedCount: 0, firedCount: 0, results: [] };
  }
  isChecking = true;
  const results: any[] = [];

  try {
    const nowIso = new Date().toISOString();
    const dueReminders = await db.reminders.findDueReminders(nowIso);

    for (const reminder of dueReminders) {
      // Mark as fired to prevent double processing
      await db.reminders.update(reminder._id, { status: 'fired' });

      // Fetch user and task
      const user = await db.users.findById(reminder.userId);
      const task = reminder.taskId ? await db.tasks.findById(reminder.taskId) : null;

      if (!user) {
        console.warn(`User ${reminder.userId} not found for reminder ${reminder._id}`);
        continue;
      }

      // 1. Create In-App Notification
      const taskTitle = task?.title || reminder.title || 'Scheduled Task';
      await db.notifications.create({
        userId: user._id,
        title: `⏰ Reminder: ${taskTitle}`,
        message: task?.description || `Your scheduled commitment "${taskTitle}" is due.`,
        type: 'reminder',
        refId: task?._id || reminder._id,
        read: false,
      });

      // 2. Dispatch WhatsApp via Notifier Service
      const dispatchResults = await notifier.dispatchReminderAlert({
        reminder,
        task,
        user,
      });

      results.push({
        reminderId: reminder._id,
        taskTitle,
        userEmail: user.email,
        dispatch: dispatchResults,
      });

      console.info(
        `[REMINDER FIRED] ID: ${reminder._id} for ${user.name} | WhatsApp: ${
          dispatchResults.whatsapp?.status || 'skipped'
        }`
      );
    }

    return {
      checkedCount: dueReminders.length,
      firedCount: results.length,
      results,
    };
  } catch (err) {
    console.error('Error during reminder check:', err);
    return { checkedCount: 0, firedCount: 0, results: [] };
  } finally {
    isChecking = false;
  }
}

export function startReminderScheduler(intervalMs = 30000): void {
  if (intervalTimer) return;
  console.info(`Starting Dobby reminder background worker (tick: ${intervalMs}ms)...`);

  // Run first check after a brief 5s warmup
  setTimeout(() => {
    checkDueRemindersNow().catch((e) => console.error('Initial reminder check error:', e));
  }, 5000);

  intervalTimer = setInterval(() => {
    checkDueRemindersNow().catch((e) => console.error('Reminder tick error:', e));
  }, intervalMs);
}

export function stopReminderScheduler(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
