import { config } from '../config';
import { db } from '../db';
import { IUser, ITask, IReminder } from '../models/types';

export interface SendWhatsAppOptions {
  userId: string;
  to: string; // phone number with country code, e.g. +14155552671
  message: string;
  taskId?: string;
  reminderId?: string;
}

export interface DeliveryResult {
  success: boolean;
  channel: 'whatsapp';
  recipient: string;
  status: 'sent' | 'simulated' | 'failed';
  error?: string;
  messageSid?: string;
  waLink?: string;
}

function formatWhatsAppAddress(raw: string, defaultFallback: string = '+14155238886'): string {
  let cleaned = (raw || defaultFallback).trim().replace(/^["']|["']$/g, '');
  if (cleaned.startsWith('whatsapp:')) {
    cleaned = cleaned.replace(/^whatsapp:/, '').trim();
  }
  const digits = cleaned.replace(/[^0-9+]/g, '');
  const e164 = digits.startsWith('+') ? digits : `+${digits}`;
  return `whatsapp:${e164}`;
}

export const notifier = {
  // Check if live WhatsApp service is configured
  getServiceStatus() {
    const isWhatsAppConfigured = Boolean(
      config.whatsapp.accountSid && config.whatsapp.authToken
    );
    const formattedFrom = formatWhatsAppAddress(config.whatsapp.fromNumber);
    return {
      whatsapp: {
        configured: isWhatsAppConfigured,
        provider: isWhatsAppConfigured
          ? `Twilio WhatsApp (${formattedFrom})`
          : 'Interactive Direct wa.me Link & Simulation (Twilio credentials pending)',
        from: formattedFrom,
      },
    };
  },

  /**
   * Send a WhatsApp Notification (Supports Twilio WhatsApp API or direct wa.me link generation)
   */
  async sendWhatsApp(opts: SendWhatsAppOptions): Promise<DeliveryResult> {
    const { userId, to, message, taskId, reminderId } = opts;
    const cleanPhone = (to || '').replace(/[^0-9+]/g, '');

    if (!cleanPhone) {
      return {
        success: false,
        channel: 'whatsapp',
        recipient: to,
        status: 'failed',
        error: 'Recipient phone number is missing or invalid',
      };
    }

    // Direct wa.me action URL for instant test or mobile click
    const waDigits = cleanPhone.replace(/^\+/, '');
    const waLink = `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`;

    // 1. If Twilio WhatsApp credentials are configured
    if (config.whatsapp.accountSid && config.whatsapp.authToken) {
      try {
        const formattedFrom = formatWhatsAppAddress(config.whatsapp.fromNumber, '+14155238886');
        const formattedTo = formatWhatsAppAddress(cleanPhone);

        const url = `https://api.twilio.com/2010-04-01/Accounts/${config.whatsapp.accountSid.trim()}/Messages.json`;
        const bodyParams = new URLSearchParams({
          From: formattedFrom,
          To: formattedTo,
          Body: message,
        });

        const authHeader = `Basic ${Buffer.from(
          `${config.whatsapp.accountSid.trim()}:${config.whatsapp.authToken.trim()}`
        ).toString('base64')}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: bodyParams.toString(),
        });

        const data: any = await res.json();

        if (res.ok) {
          await db.deliveryLogs.create({
            userId,
            taskId,
            reminderId,
            channel: 'whatsapp',
            recipient: cleanPhone,
            status: 'sent',
            content: message,
            messageSid: data?.sid,
          });
          return {
            success: true,
            channel: 'whatsapp',
            recipient: cleanPhone,
            status: 'sent',
            messageSid: data?.sid,
            waLink,
          };
        } else {
          let errMsg = data?.message || `Twilio error: ${data?.code || res.status}`;
          if (data?.code === 63015 || errMsg.toLowerCase().includes('sandbox')) {
            errMsg = `${errMsg} (Tip: For Twilio Sandbox, send your sandbox 'join <word>' message to ${formattedFrom} from your WhatsApp first!)`;
          }
          await db.deliveryLogs.create({
            userId,
            taskId,
            reminderId,
            channel: 'whatsapp',
            recipient: cleanPhone,
            status: 'failed',
            content: message,
            error: errMsg,
          });
          return {
            success: false,
            channel: 'whatsapp',
            recipient: cleanPhone,
            status: 'failed',
            error: errMsg,
            waLink,
          };
        }
      } catch (err: any) {
        console.error('Twilio WhatsApp error:', err);
      }
    }

    // 2. Simulated WhatsApp Notification (Produces interactive wa.me link for direct mobile trigger)
    console.info(`[WHATSAPP DISPATCH] To: ${cleanPhone} | Message: "${message.slice(0, 80)}..."`);
    await db.deliveryLogs.create({
      userId,
      taskId,
      reminderId,
      channel: 'whatsapp',
      recipient: cleanPhone,
      status: 'simulated',
      content: message,
      error: 'Simulated dispatch (Twilio credentials pending; direct wa.me link generated)',
    });

    return {
      success: true,
      channel: 'whatsapp',
      recipient: cleanPhone,
      status: 'simulated',
      waLink,
    };
  },

  /**
   * Helper to format and dispatch reminder alert via WhatsApp
   */
  async dispatchReminderAlert(params: {
    reminder: IReminder;
    task: ITask | null;
    user: IUser;
  }): Promise<{ whatsapp?: DeliveryResult }> {
    const { reminder, task, user } = params;
    const taskTitle = task?.title || reminder.title || 'Upcoming Task';
    const dueDateStr = task?.dueDate
      ? `${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ''}`
      : 'Soon';
    const priority = (task?.priority || 'medium').toUpperCase();

    const results: { whatsapp?: DeliveryResult } = {};

    const shouldWhatsApp = user.notificationPrefs?.whatsapp !== false;
    const phoneTo = user.notificationPrefs?.whatsappPhone || user.phoneNumber;

    if (shouldWhatsApp && phoneTo) {
      const waMessage =
        `🧹 *Dobby House Help — Reminder*\n\n` +
        `📌 *Task:* ${taskTitle}\n` +
        `⏰ *Due:* ${dueDateStr}\n` +
        `⚡ *Priority:* ${priority}\n` +
        (task?.description ? `📝 *Notes:* ${task.description}\n` : '') +
        `\n💬 _Dobby has scheduled this commitment for you. Click below to view in your dashboard:_ \n${config.appUrl}`;

      results.whatsapp = await this.sendWhatsApp({
        userId: user._id,
        to: phoneTo,
        message: waMessage,
        taskId: task?._id,
        reminderId: reminder._id,
      });
    }

    return results;
  },

  /**
   * Helper to dispatch task assignment alert via WhatsApp
   */
  async dispatchTaskAssignedAlert(params: {
    task: ITask;
    assignee: IUser;
    assigner?: IUser | null;
  }): Promise<{ whatsapp?: DeliveryResult }> {
    const { task, assignee, assigner } = params;
    const assignerName = assigner?.name || 'Someone in your household';
    const dueDateStr = task.dueDate
      ? `${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ''}`
      : 'Not set';

    const results: { whatsapp?: DeliveryResult } = {};

    if (assignee.notificationPrefs?.whatsapp !== false) {
      const phoneTo = assignee.notificationPrefs?.whatsappPhone || assignee.phoneNumber;
      if (phoneTo) {
        const waMessage =
          `🧹 *Dobby House Help — New Task Assigned*\n\n` +
          `👤 *Assigned By:* ${assignerName}\n` +
          `📌 *Task:* ${task.title}\n` +
          `⏰ *Due Date:* ${dueDateStr}\n` +
          `⚡ *Priority:* ${(task.priority || 'medium').toUpperCase()}\n` +
          (task.description ? `📝 *Details:* ${task.description}\n` : '') +
          `\nOpen Dobby to manage this commitment:\n${config.appUrl}`;

        results.whatsapp = await this.sendWhatsApp({
          userId: assignee._id,
          to: phoneTo,
          message: waMessage,
          taskId: task._id,
        });
      }
    }

    return results;
  },
};
