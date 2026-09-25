import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Users,
  Terminal,
  Database,
  RefreshCw,
  Plus,
  Layers,
  Calendar,
  ShieldCheck,
  Zap,
  AlertCircle,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { api } from './api';
import {
  UserProfile,
  Task,
  Group,
  Reminder,
  NotificationItem,
  SystemHealth,
} from './types';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { AiIngestCard } from './components/AiIngestCard';
import { TaskList } from './components/TaskList';
import { RemindersList } from './components/RemindersList';
import { GroupManager } from './components/GroupManager';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { DbStatusModal } from './components/DbStatusModal';
import { ApiConsole } from './components/ApiConsole';
import { NotificationChannelsModal } from './components/NotificationChannelsModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [users, setUsers] = useState<Array<{ _id: string; name: string }>>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);

  const [activeTab, setActiveTab] = useState<'tasks' | 'reminders' | 'groups' | 'api'>('tasks');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reconnectingDb, setReconnectingDb] = useState(false);
  const [reconnectResult, setReconnectResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load system health
  const loadHealth = useCallback(async () => {
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch (e) {
      console.warn('Could not load health:', e);
    }
  }, []);

  // Load user data
  const loadUserData = useCallback(async () => {
    try {
      const [tasksRes, groupsRes, remindersRes, notifsRes, usersRes] = await Promise.all([
        api.getTasks().catch(() => ({ tasks: [] })),
        api.getGroups().catch(() => ({ groups: [] })),
        api.getReminders().catch(() => ({ reminders: [] })),
        api.getNotifications().catch(() => ({ notifications: [] })),
        api.getUsers().catch(() => ({ users: [] })),
      ]);

      setTasks(tasksRes.tasks || []);
      setGroups(groupsRes.groups || []);
      setReminders(remindersRes.reminders || []);
      setNotifications(notifsRes.notifications || []);
      setUsers(usersRes.users || []);

      if (groupsRes.groups && groupsRes.groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groupsRes.groups[0]._id);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, [selectedGroupId]);

  const handleReconnectDb = async () => {
    setReconnectingDb(true);
    setReconnectResult(null);
    try {
      const res = await api.reconnectDb();
      setReconnectResult({
        success: res.connectedToMongoDB,
        message: res.message,
      });
      await loadHealth();
      await loadUserData();
    } catch (err: any) {
      setReconnectResult({
        success: false,
        message: err?.message || 'Failed to connect to MongoDB',
      });
    } finally {
      setReconnectingDb(false);
    }
  };

  // Initial bootstrap: check existing token, or auto-login with pre-seeded demo user
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadHealth();

      const existingToken = api.getToken();
      if (existingToken) {
        try {
          const res = await api.getMe();
          setCurrentUser(res.user);
          await loadUserData();
          setLoading(false);
          return;
        } catch {
          api.clearToken();
        }
      }

      // Auto-login with default seeded demo user (Alex Rivera) for zero friction preview
      try {
        const loginRes = await api.login('alex@tasklens.io', 'password123');
        api.setToken(loginRes.token);
        setCurrentUser(loginRes.user);
        await loadUserData();
      } catch (e) {
        console.log('No active session; user can sign in via modal');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [loadHealth, loadUserData]);

  const handleLogout = () => {
    api.clearToken();
    setCurrentUser(null);
    setTasks([]);
    setGroups([]);
    setReminders([]);
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        user={currentUser}
        health={health}
        unreadCount={unreadCount}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenDbStatus={() => setIsDbStatusOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenAlertSettings={() => setIsChannelsModalOpen(true)}
        refreshHealth={loadHealth}
        onTestConnect={handleReconnectDb}
        isTestingDb={reconnectingDb}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        {/* Subtle Database Notice (Only if Atlas connection needs attention, clean and compact) */}
        {!health?.database?.connectedToMongoDB && health?.database?.mongoUriProvided && (
          <div className="px-3.5 py-2 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200/90 gap-2">
            <div className="flex items-center gap-2 truncate">
              <Database className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">
                Using local storage. Connect MongoDB Atlas with whitelist (0.0.0.0/0).
              </span>
            </div>
            <button
              onClick={handleReconnectDb}
              disabled={reconnectingDb}
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] shrink-0 hover:bg-amber-400 transition-colors"
            >
              {reconnectingDb ? 'Testing...' : 'Test DB'}
            </button>
          </div>
        )}

        {/* Clean Household Welcome & Summary Header */}
        <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div>
            <h1 className="text-base sm:text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>Welcome back{currentUser ? `, ${currentUser.name.split(' ')[0]}` : ''}!</span>
              <span className="text-sm">🪄</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Dobby handles your household bills, school slips, notes, and WhatsApp reminders.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                {tasks.filter((t) => t.status !== 'completed').length} Tasks
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                {reminders.filter((r) => r.status === 'scheduled').length} Reminders
              </span>
            </div>

            <button
              onClick={() => {
                loadHealth();
                loadUserData();
              }}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* AI Task Extraction Ingestion Engine */}
        <AiIngestCard
          groups={groups}
          selectedGroupId={selectedGroupId}
          onTasksCreated={() => {
            loadUserData();
            loadHealth();
          }}
        />

        {/* Navigation Tabs (Desktop & Tablet) */}
        <div className="border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto pb-1 text-sm font-semibold">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs sm:text-sm ${
                activeTab === 'tasks'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Tasks</span>
              <span
                className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'tasks' ? 'bg-slate-950 text-cyan-400' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {tasks.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reminders')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs sm:text-sm ${
                activeTab === 'reminders'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Reminders</span>
              <span
                className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'reminders' ? 'bg-slate-950 text-cyan-400' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {reminders.filter((r) => r.status !== 'dismissed').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('groups')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs sm:text-sm ${
                activeTab === 'groups'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Family</span>
              <span
                className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'groups' ? 'bg-slate-950 text-cyan-400' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {groups.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('api')}
              className={`hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap text-xs ${
                activeTab === 'api'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>API</span>
            </button>
          </div>

          {/* Quick WhatsApp Alerts button in tabs */}
          <button
            id="tab-alert-channels-modal-btn"
            onClick={() => setIsChannelsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shrink-0 transition-all"
            title="Configure WhatsApp Alerts"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">WhatsApp Alerts</span>
            <span className="sm:hidden text-[11px]">WhatsApp</span>
          </button>
        </div>
        {/* Tab Contents */}
        {activeTab === 'tasks' && (
          <TaskList
            tasks={tasks}
            groups={groups}
            users={users}
            currentUser={currentUser}
            onRefresh={() => {
              loadUserData();
              loadHealth();
            }}
          />
        )}

        {activeTab === 'reminders' && (
          <RemindersList
            reminders={reminders}
            currentUser={currentUser}
            onOpenAlertSettings={() => setIsChannelsModalOpen(true)}
            onRefresh={() => {
              loadUserData();
              loadHealth();
            }}
          />
        )}

        {activeTab === 'groups' && (
          <GroupManager
            groups={groups}
            currentUser={currentUser}
            onRefresh={() => {
              loadUserData();
              loadHealth();
            }}
          />
        )}

        {activeTab === 'api' && <ApiConsole />}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur-lg px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'tasks'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-[10px]">Tasks</span>
        </button>

        <button
          onClick={() => setActiveTab('reminders')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'reminders'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px]">Reminders</span>
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'groups'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">Family</span>
        </button>

        <button
          onClick={() => setIsChannelsModalOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-emerald-400 hover:text-emerald-300 transition-all"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <span className="text-[10px] font-semibold">WhatsApp</span>
        </button>
      </nav>

      {/* Modals & Drawers */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          loadUserData();
          loadHealth();
        }}
      />

      <DbStatusModal
        isOpen={isDbStatusOpen}
        onClose={() => setIsDbStatusOpen(false)}
        health={health}
        onRefresh={() => {
          loadHealth();
          loadUserData();
        }}
      />

      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onRefresh={loadUserData}
        onOpenAlertSettings={() => setIsChannelsModalOpen(true)}
      />

      <NotificationChannelsModal
        isOpen={isChannelsModalOpen}
        onClose={() => setIsChannelsModalOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updated) => setCurrentUser(updated)}
      />
    </div>
  );
}
