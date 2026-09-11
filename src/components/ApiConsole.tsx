import React, { useState } from 'react';
import { Terminal, Play, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { api } from '../api';

interface Endpoint {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
}

const ENDPOINTS: Endpoint[] = [
  { name: 'System Health & DB Mode', method: 'GET', path: '/api/system/health' },
  { name: 'Test & Reconnect MongoDB', method: 'POST', path: '/api/system/reconnect-db' },
  { name: 'Get Current Authenticated User', method: 'GET', path: '/api/auth/me' },
  { name: 'List MongoDB Tasks', method: 'GET', path: '/api/tasks' },
  { name: 'List Collaboration Groups', method: 'GET', path: '/api/groups' },
  { name: 'List Scheduled Reminders', method: 'GET', path: '/api/reminders' },
  { name: 'Notification Inbox', method: 'GET', path: '/api/notifications' },
  { name: 'List AI Ingestion Runs', method: 'GET', path: '/api/ingest/runs' },
  { name: 'All Users in DB', method: 'GET', path: '/api/auth/users' },
];

export const ApiConsole: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(ENDPOINTS[0]);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseData, setResponseData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setResponseData(null);
    setResponseStatus(null);
    const start = performance.now();

    try {
      const token = api.getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(selectedEndpoint.path, {
        method: selectedEndpoint.method,
        headers,
        body: selectedEndpoint.body ? JSON.stringify(selectedEndpoint.body) : undefined,
      });

      const time = Math.round(performance.now() - start);
      setResponseTime(time);
      setResponseStatus(res.status);

      const json = await res.json().catch(() => ({ status: 'No JSON body' }));
      setResponseData(json);
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100">Live Backend API Console</h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">Node.js + Express + MongoDB</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Endpoint Selector */}
        <div className="lg:col-span-5 space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Select API Endpoint:
          </label>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {ENDPOINTS.map((ep) => {
              const isSelected = selectedEndpoint.path === ep.path;
              return (
                <button
                  key={ep.path}
                  onClick={() => setSelectedEndpoint(ep)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-cyan-500/10 border border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-semibold block truncate">{ep.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">{ep.path}</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-cyan-400 shrink-0 ml-2">
                    {ep.method}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleExecute}
            disabled={loading}
            className="w-full mt-3 py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Play className="w-3.5 h-3.5 fill-slate-950" />
            )}
            <span>Execute Request</span>
          </button>
        </div>

        {/* Live Response Viewer */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col min-h-60">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
            <span className="text-[11px] font-mono text-slate-400">Response Payload</span>
            {responseStatus && (
              <div className="flex items-center gap-3 text-[11px]">
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    responseStatus >= 200 && responseStatus < 300
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  HTTP {responseStatus}
                </span>
                {responseTime !== null && (
                  <span className="text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {responseTime}ms
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto max-h-72">
            {error && (
              <div className="text-rose-400 text-xs font-mono p-2">Error: {error}</div>
            )}
            {responseData ? (
              <pre className="text-[11px] font-mono text-cyan-300/90 whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(responseData, null, 2)}
              </pre>
            ) : !loading && !error ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                Click &ldquo;Execute Request&rdquo; to test live Node.js + MongoDB API
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
