import React, { useState } from 'react';
import {
  Clock,
  Bell,
  CheckCircle2,
  Moon,
  Calendar,
  AlertCircle,
  MessageSquare,
  Send,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { api } from '../api';
import { Reminder, UserProfile } from '../types';

interface RemindersListProps {
  reminders: Reminder[];
  onRefresh: () => void;
  currentUser?: UserProfile | null;
  onOpenAlertSettings?: () => void;
}

export const RemindersList: React.FC<RemindersListProps> = ({
  reminders,
  onRefresh,
  currentUser,
  onOpenAlertSettings,
}) => {
  const [snoozingId, setSnoozingId] = useState<string | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [checkingWorker, setCheckingWorker] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);

  const handleSnooze = async (id: string, minutes: number) => {
    setSnoozingId(id);
    try {
      await api.snoozeReminder(id, minutes);
      onRefresh();
    } catch (err: any) {
      alert('Failed to snooze: ' + err.message);
    } finally {
      setSnoozingId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.dismissReminder(id);
      onRefresh();
    } catch (err: any) {
      alert('Failed to dismiss: ' + err.message);
    }
  };

  const handleTriggerNow = async (id: string, title: string) => {
    setTriggeringId(id);
    setAlertFeedback(null);
    try {
      const res = await api.triggerReminderNow(id);
      setAlertFeedback(`✅ WhatsApp alert dispatched for "${title}"!`);
      setTimeout(() => setAlertFeedback(null), 5000);
      onRefresh();
    } catch (err: any) {
      setAlertFeedback(`❌ Trigger error: ${err.message}`);
    } finally {
      setTriggeringId(null);
    }
  };

  const handleCheckDueNow = async () => {
    setCheckingWorker(true);
    setAlertFeedback(null);
    try {
      const res = await api.checkDueReminders();
      setAlertFeedback(
        `Checked due reminders: ${res.firedCount} alert(s) dispatched to WhatsApp.`
      );
      setTimeout(() => setAlertFeedback(null), 4000);
      onRefresh();
    } catch (err: any) {
      setAlertFeedback(`Worker check error: ${err.message}`);
    } finally {
      setCheckingWorker(false);
    }
  };

  const activeReminders = reminders.filter((r) => r.status !== 'dismissed');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header with Title & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Scheduled Reminders &amp; Delivery Triggers
            </h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {activeReminders.length} Active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Auto-dispatched via WhatsApp Notifications to your mobile phone when due.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCheckDueNow}
            disabled={checkingWorker}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Force reminder worker check now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingWorker ? 'animate-spin' : ''}`} />
            <span>{checkingWorker ? 'Checking...' : 'Check Due Alerts'}</span>
          </button>

          {onOpenAlertSettings && (
            <button
              onClick={onOpenAlertSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>WhatsApp Setup</span>
            </button>
          )}
        </div>
      </div>

      {alertFeedback && (
        <div className="p-3 rounded-xl bg-slate-950/90 border border-cyan-500/40 text-xs text-cyan-300 flex items-center justify-between animate-fade-in">
          <span>{alertFeedback}</span>
          {onOpenAlertSettings && (
            <button
              onClick={onOpenAlertSettings}
              className="underline text-[11px] hover:text-cyan-200"
            >
              View Delivery Logs
            </button>
          )}
        </div>
      )}

      {/* Reminders List */}
      {activeReminders.length === 0 ? (
        <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/60 rounded-xl border border-slate-800/80">
          No pending reminders scheduled. Reminders are created automatically when tasks with due dates are confirmed or assigned.
        </div>
      ) : (
        <div className="space-y-2.5">
          {activeReminders.map((reminder) => {
            const dateObj = new Date(reminder.triggerTime);
            const isPast = dateObj.getTime() <= Date.now();

            return (
              <div
                key={reminder._id}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-200">{reminder.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isPast
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : reminder.status === 'snoozed'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : reminder.status === 'fired'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                      }`}
                    >
                      {reminder.status === 'fired'
                        ? 'Fired / Alert Dispatched'
                        : isPast
                        ? 'Due / Triggering'
                        : reminder.status}
                    </span>

                    {/* WhatsApp Channel Indicator */}
                    <span
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 font-semibold"
                      title="Dispatches WhatsApp Notification"
                    >
                      <MessageSquare className="w-2.5 h-2.5 text-emerald-400" />
                      <span>WhatsApp</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 mt-1.5 text-[11px] flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      Trigger: {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {reminder.relativeMinutes && (
                      <span className="text-slate-500">({reminder.relativeMinutes}m relative offset)</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {/* Trigger Now Button */}
                  <button
                    onClick={() => handleTriggerNow(reminder._id, reminder.title)}
                    disabled={triggeringId === reminder._id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all disabled:opacity-50 shadow-sm"
                    title="Send WhatsApp alert right now"
                  >
                    <Send className={`w-3 h-3 ${triggeringId === reminder._id ? 'animate-spin' : ''}`} />
                    <span>{triggeringId === reminder._id ? 'Sending...' : 'Send WhatsApp'}</span>
                  </button>

                  <button
                    onClick={() => handleSnooze(reminder._id, 15)}
                    disabled={snoozingId === reminder._id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                    title="Snooze for 15 minutes"
                  >
                    <Moon className="w-3 h-3 text-amber-400" />
                    <span>+15m</span>
                  </button>

                  <button
                    onClick={() => handleSnooze(reminder._id, 60)}
                    disabled={snoozingId === reminder._id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                    title="Snooze for 1 hour"
                  >
                    <Moon className="w-3 h-3 text-amber-400" />
                    <span>+1h</span>
                  </button>

                  <button
                    onClick={() => handleDismiss(reminder._id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-500/20 text-xs transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Dismiss</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
