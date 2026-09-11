import React, { useState } from 'react';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw, Server, Sparkles, ShieldAlert, ExternalLink } from 'lucide-react';
import { api } from '../api';
import { SystemHealth } from '../types';

interface DbStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: SystemHealth | null;
  onRefresh: () => void;
}

export const DbStatusModal: React.FC<DbStatusModalProps> = ({
  isOpen,
  onClose,
  health,
  onRefresh,
}) => {
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectFeedback, setReconnectFeedback] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleReseed = async () => {
    if (!confirm('This will re-initialize demo data in MongoDB with fresh tasks. Continue?')) return;
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await api.seedData();
      setSeedMsg(res.message || 'Seeding complete!');
      onRefresh();
    } catch (err: any) {
      alert('Seeding failed: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    setReconnectFeedback(null);
    try {
      const res = await api.reconnectDb();
      setReconnectFeedback({
        success: res.connectedToMongoDB,
        message: res.message,
      });
      onRefresh();
    } catch (err: any) {
      setReconnectFeedback({
        success: false,
        message: err?.message || 'Connection test failed',
      });
    } finally {
      setReconnecting(false);
    }
  };

  const isMongo = health?.database?.connectedToMongoDB;
  const mongoUriConfigured = health?.database?.mongoUriProvided;
  const counts = health?.database?.counts || {
    users: 0,
    groups: 0,
    tasks: 0,
    reminders: 0,
    notifications: 0,
    ingestions: 0,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Node.js + MongoDB Backend Architecture</h3>
              <p className="text-xs text-slate-400">Database connection diagnostics &amp; live record inventory</p>
            </div>
          </div>
          <button
            id="modal-header-test-connect"
            onClick={handleReconnect}
            disabled={reconnecting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
            <span>{reconnecting ? 'Testing...' : 'Test & Connect MongoDB'}</span>
          </button>
        </div>

        {/* Connection status banner */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Storage Engine Mode:</span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                isMongo
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>{health?.database?.mode || 'Active'}</span>
            </span>
          </div>

          <div className="text-xs text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Service:</span>
              <span className="font-mono text-slate-200">Express 4.21 + Node.js</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mongoose ODM:</span>
              <span className="font-mono text-slate-200">v8.23 Schemas active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">AI Model Gateway:</span>
              <span className="font-mono text-cyan-300">{health?.ai?.model || 'gemini-3.8-flash'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Uptime:</span>
              <span className="font-mono text-slate-400">{health?.uptimeSeconds || 0}s</span>
            </div>
          </div>
        </div>

        {/* MongoDB Atlas IP Whitelist Guidance Box if error or not yet connected */}
        {mongoUriConfigured && !isMongo && (
          <div className="mb-5 p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-200">MongoDB Atlas Connection Diagnostics</h4>
                <p className="text-[11px] text-amber-300/80 leading-relaxed mt-0.5">
                  Your <code className="text-cyan-300 font-mono">MONGODB_URI</code> is detected, but MongoDB Atlas denied connection. Atlas clusters block access by default until the IP whitelist allows cloud containers.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/90 rounded-lg text-[11px] text-slate-300 space-y-1.5 border border-slate-800">
              <span className="font-semibold text-cyan-300 block">How to enable access (Takes 30 seconds):</span>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Log in to <a href="https://cloud.mongodb.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline font-semibold inline-flex items-center gap-0.5">MongoDB Atlas <ExternalLink className="w-2.5 h-2.5" /></a> and select your cluster.</li>
                <li>In the left sidebar under <em>Security</em>, click <strong>Network Access</strong>.</li>
                <li>Click <strong>Add IP Address</strong> &gt; select <strong>ALLOW ACCESS FROM ANYWHERE</strong> (<code className="text-cyan-300 font-mono">0.0.0.0/0</code>).</li>
                <li>Click <strong>Confirm</strong>, wait 15–30 seconds for Atlas to apply changes, then click <em>Test &amp; Connect</em> below!</li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400">
                All features work normally via embedded persistent store.
              </span>
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20 disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
                <span>{reconnecting ? 'Connecting...' : 'Test & Connect MongoDB'}</span>
              </button>
            </div>

            {reconnectFeedback && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  reconnectFeedback.success
                    ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
                }`}
              >
                {reconnectFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{reconnectFeedback.message}</span>
              </div>
            )}
          </div>
        )}

        {/* Collection Counts Grid */}
        <div className="mb-5">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
            Live Database Collection Records
          </h4>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-lg font-bold text-cyan-400">{counts.users}</div>
              <div className="text-[11px] text-slate-400">Users</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-lg font-bold text-teal-400">{counts.groups}</div>
              <div className="text-[11px] text-slate-400">Groups</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-lg font-bold text-emerald-400">{counts.tasks}</div>
              <div className="text-[11px] text-slate-400">Tasks</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-lg font-bold text-amber-400">{counts.reminders}</div>
              <div className="text-[11px] text-slate-400">Reminders</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-lg font-bold text-purple-400">{counts.notifications}</div>
              <div className="text-[11px] text-slate-400">Notifications</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-lg font-bold text-pink-400">{counts.ingestions}</div>
              <div className="text-[11px] text-slate-400">AI Ingestions</div>
            </div>
          </div>
        </div>

        {seedMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{seedMsg}</span>
          </div>
        )}

        {/* Reseed & Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={handleReseed}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
            <span>{seeding ? 'Seeding...' : 'Reset & Reseed Demo Data'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
