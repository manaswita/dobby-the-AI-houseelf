import React from 'react';
import { Bell, X, CheckCheck, Clock, Check, MessageSquare, Settings } from 'lucide-react';
import { api } from '../api';
import { NotificationItem } from '../types';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onRefresh: () => void;
  onOpenAlertSettings?: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onRefresh,
  onOpenAlertSettings,
}) => {
  if (!isOpen) return null;

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      onRefresh();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      onRefresh();
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-slate-900 border-l border-slate-800 h-full p-5 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100">Notifications Inbox</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WhatsApp Alerts Info */}
        {onOpenAlertSettings && (
          <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <MessageSquare className="w-3.5 h-3.5" />
              </span>
              <div>
                <div className="text-[11px] font-bold text-slate-200">WhatsApp Alerts</div>
                <div className="text-[10px] text-emerald-400">Mobile reminders enabled</div>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenAlertSettings();
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
              <span>Configure</span>
            </button>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="pt-3 pb-2 flex justify-end">
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all as read</span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No notifications yet. Notifications will appear when tasks are assigned or reminders trigger.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                onClick={() => !n.read && handleMarkRead(n._id)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  n.read
                    ? 'bg-slate-950/50 border-slate-900 text-slate-400'
                    : 'bg-slate-950 border-cyan-500/30 text-slate-200 shadow-md shadow-cyan-950/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-bold text-slate-100">{n.title}</span>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-1" />
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-1.5">{n.message}</p>
                <span className="text-[10px] text-slate-500 block">
                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
