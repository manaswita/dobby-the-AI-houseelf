import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Send,
  RefreshCw,
  Smartphone,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api';
import { UserProfile, ChannelsStatus, NotificationDeliveryLog } from '../types';

interface NotificationChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUserUpdated?: (user: UserProfile) => void;
}

export const NotificationChannelsModal: React.FC<NotificationChannelsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'test' | 'logs'>('settings');
  const [channelsStatus, setChannelsStatus] = useState<ChannelsStatus | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<NotificationDeliveryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [notifyOnAssigned, setNotifyOnAssigned] = useState(true);
  const [notifyOnReminder, setNotifyOnReminder] = useState(true);

  // Test states
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [whatsappTestResult, setWhatsappTestResult] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadData();
    }
  }, [isOpen, currentUser]);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [statusRes, logsRes] = await Promise.all([
        api.getChannelsStatus(),
        api.getDeliveryLogs(),
      ]);
      setChannelsStatus(statusRes);
      setDeliveryLogs(logsRes.logs || []);

      // Populate form
      const prefs = currentUser?.notificationPrefs || statusRes.userPrefs || {};
      setWhatsappEnabled(prefs.whatsapp !== false);
      setWhatsappPhone(prefs.whatsappPhone || currentUser?.phoneNumber || '');
      setNotifyOnAssigned(prefs.notifyOnAssigned !== false);
      setNotifyOnReminder(prefs.notifyOnReminder !== false);
    } catch (err: any) {
      console.error('Failed to load channel status:', err);
      setErrorMessage(err.message || 'Failed to load channel configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setErrorMessage(null);
    try {
      const res = await api.updateNotificationSettings({
        whatsapp: whatsappEnabled,
        whatsappPhone: whatsappPhone.trim(),
        phoneNumber: whatsappPhone.trim(),
        notifyOnAssigned,
        notifyOnReminder,
      });

      setSaveSuccess('WhatsApp notification preferences saved successfully!');
      if (res.user && onUserUpdated) {
        onUserUpdated(res.user);
      }
      setTimeout(() => setSaveSuccess(null), 4000);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update WhatsApp settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestWhatsApp = async () => {
    setTestingWhatsapp(true);
    setErrorMessage(null);
    setWhatsappTestResult(null);
    try {
      const res = await api.sendTestWhatsApp(whatsappPhone || currentUser?.phoneNumber);
      setWhatsappTestResult(res);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch WhatsApp test');
    } finally {
      setTestingWhatsapp(false);
    }
  };

  if (!isOpen) return null;

  const isTwilioConfigured = channelsStatus?.channels?.whatsapp?.configured;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>WhatsApp Alerts</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isTwilioConfigured
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  }`}
                >
                  {isTwilioConfigured ? 'Twilio Live API' : 'Direct Link Mode (wa.me)'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Receive instant task assignments, deadlines, and reminders on your phone via WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>WhatsApp Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'test'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Test Dispatch</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Delivery Logs ({deliveryLogs.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* WhatsApp Service Status Banner */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-200">Delivery Engine</span>
                  </div>
                  <span
                    className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${
                      isTwilioConfigured
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-cyan-500/20 text-cyan-300'
                    }`}
                  >
                    {isTwilioConfigured ? 'Twilio API Connected' : 'Direct Link Mode Enabled'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isTwilioConfigured
                    ? `Automated background dispatch is active using sender ${channelsStatus?.channels?.whatsapp?.from}.`
                    : `Direct wa.me link generation is active! You can test sending directly to WhatsApp with 1-click. For automated background delivery, add your Twilio Account SID & Auth Token in the Secrets/Environment panel.`}
                </p>
              </div>

              {/* WhatsApp Config Card */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">WhatsApp Notification Channel</h4>
                      <p className="text-[11px] text-slate-400">
                        Sends reminders and task decrements to your mobile phone
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whatsappEnabled}
                      onChange={(e) => setWhatsappEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    WhatsApp Phone Number (include country code)
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder="+14155552671 or +919876543210"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Format: +[country code][number]. E.g. +14155552671 (US) or +919876543210 (India).
                  </p>
                </div>
              </div>

              {/* Notification Events Card */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Automated Event Triggers
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-900/60 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={notifyOnAssigned}
                      onChange={(e) => setNotifyOnAssigned(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Task Assignments
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Notify me when someone in my household assigns or delegates a task to me
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-900/60 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={notifyOnReminder}
                      onChange={(e) => setNotifyOnReminder(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Scheduled Deadlines &amp; Remembralls
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Notify me when a task deadline or custom reminder trigger is due
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save WhatsApp Settings</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: TEST DISPATCH */}
          {activeTab === 'test' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-bold text-slate-200">Send Test WhatsApp Alert</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sends an instant confirmation message to verify your phone number and delivery channel.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <input
                    type="tel"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="+14155552671"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    onClick={handleSendTestWhatsApp}
                    disabled={testingWhatsapp || !whatsappPhone.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 shadow-md shadow-emerald-500/20"
                  >
                    <Send className={`w-3.5 h-3.5 ${testingWhatsapp ? 'animate-spin' : ''}`} />
                    <span>{testingWhatsapp ? 'Sending...' : 'Send WhatsApp Test'}</span>
                  </button>
                </div>
              </div>

              {/* Test Result Display */}
              {whatsappTestResult && (
                <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{whatsappTestResult.message}</span>
                  </div>

                  {whatsappTestResult.waLink && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs text-slate-300">
                        Click below to verify the test message directly in WhatsApp:
                      </div>
                      <a
                        href={whatsappTestResult.waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-500/20"
                      >
                        <span>Open in WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div className="font-mono text-slate-300">
                      Recipient: {whatsappTestResult.result?.recipient}
                    </div>
                    <div className="font-mono text-slate-300">
                      Status: {whatsappTestResult.result?.status}
                    </div>
                    {whatsappTestResult.result?.messageSid && (
                      <div className="font-mono text-slate-300">
                        Twilio Message SID: {whatsappTestResult.result.messageSid}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Production Setup Guidance */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Twilio WhatsApp Business Setup</span>
                </div>
                <div className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                  <p>To enable automated background dispatch via Twilio:</p>
                  <ol className="list-decimal pl-5 space-y-1 text-slate-300">
                    <li>Create a Twilio account or use your existing credentials.</li>
                    <li>
                      Add <code className="text-emerald-400">TWILIO_ACCOUNT_SID</code> and{' '}
                      <code className="text-emerald-400">TWILIO_AUTH_TOKEN</code> in your environment or Secrets menu.
                    </li>
                    <li>
                      Set <code className="text-emerald-400">TWILIO_WHATSAPP_NUMBER</code> (e.g. <code className="text-emerald-400">whatsapp:+14155238886</code> for Sandbox).
                    </li>
                  </ol>
                  <p className="text-slate-400 pt-1">
                    If Twilio credentials are not set, Dobby automatically creates interactive <code className="text-emerald-300">wa.me</code> links so you can send WhatsApp notifications on mobile with a single tap.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DELIVERY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Recent WhatsApp dispatch history</span>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {deliveryLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/50 rounded-2xl border border-slate-800">
                  No notifications logged yet. When tasks are assigned or reminders fire, records will appear here.
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {deliveryLogs.map((log) => {
                    const dateObj = new Date(log.createdAt);
                    return (
                      <div
                        key={log._id}
                        className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </span>
                            <span className="text-slate-300 font-mono">{log.recipient}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                log.status === 'sent'
                                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                  : log.status === 'simulated'
                                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                              }`}
                            >
                              {log.status === 'simulated' ? 'Direct wa.me' : log.status}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-300 line-clamp-2 bg-slate-900/60 p-2 rounded-lg font-mono">
                          {log.content}
                        </p>

                        {log.error && (
                          <div className="text-[10px] text-amber-400 flex items-center gap-1">
                            <Info className="w-3 h-3 shrink-0" />
                            <span>{log.error}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
