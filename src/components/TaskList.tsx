import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  User,
  Plus,
  Trash2,
  Tag,
  AlertTriangle,
  Search,
  Filter,
  Check,
  Bell,
  X,
  Send,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { api } from '../api';
import { Task, Group, UserProfile, Reminder } from '../types';

interface TaskListProps {
  tasks: Task[];
  reminders?: Reminder[];
  groups: Group[];
  users: Array<{ _id: string; name: string }>;
  currentUser: UserProfile | null;
  onRefresh: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  reminders = [],
  groups,
  users,
  currentUser,
  onRefresh,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('17:00');
  const [newReminderOffset, setNewReminderOffset] = useState<number | 'none'>(60);
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [creating, setCreating] = useState(false);

  // Set Reminder Modal state
  const [selectedTaskForReminder, setSelectedTaskForReminder] = useState<Task | null>(null);
  const [reminderAmount, setReminderAmount] = useState<number>(1);
  const [reminderUnit, setReminderUnit] = useState<'hours' | 'days'>('hours');
  const [reminderRefMode, setReminderRefMode] = useState<'before_due' | 'from_now'>('before_due');
  const [reminderDueDate, setReminderDueDate] = useState<string>('');
  const [reminderDueTime, setReminderDueTime] = useState<string>('17:00');
  const [savingReminder, setSavingReminder] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleToggleComplete = async (taskId: string) => {
    try {
      await api.toggleCompleteTask(taskId);
      onRefresh();
    } catch (err: any) {
      alert('Failed to update task: ' + err.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(taskId);
      onRefresh();
    } catch (err: any) {
      alert('Failed to delete task: ' + err.message);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);

    try {
      const reminderOffsets =
        newDueDate && newReminderOffset !== 'none' ? [Number(newReminderOffset)] : [];

      await api.createTask({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        dueDate: newDueDate || undefined,
        dueTime: newDueTime || undefined,
        priority: newPriority,
        assignedTo: newAssignedTo || currentUser?._id,
        groupId: newGroupId || undefined,
        createReminders: reminderOffsets,
      });

      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
      setNewReminderOffset(60);
      setShowCreateModal(false);
      onRefresh();
    } catch (err: any) {
      alert('Failed to create task: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  // Open the "Set Reminder" modal for a specific task
  const openReminderModal = (task: Task) => {
    setSelectedTaskForReminder(task);
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    setReminderDueDate(task.dueDate || tomorrowStr);
    setReminderDueTime(task.dueTime || '17:00');
    setReminderAmount(task.dueDate ? 1 : 2);
    setReminderUnit('hours');
    setReminderRefMode(task.dueDate ? 'before_due' : 'from_now');
    setFeedbackMessage(null);
  };

  // Calculate the projected trigger date and time for live display
  const getCalculatedTrigger = () => {
    if (!selectedTaskForReminder) return null;

    const num = Math.max(0.1, Number(reminderAmount) || 1);
    const offsetMinutes = reminderUnit === 'days' ? num * 1440 : num * 60;

    let targetMs: number | null = null;
    if (reminderRefMode === 'before_due' && reminderDueDate) {
      const dueDateTimeStr = reminderDueTime
        ? `${reminderDueDate}T${reminderDueTime}:00`
        : `${reminderDueDate}T09:00:00`;
      const dueMs = new Date(dueDateTimeStr).getTime();
      if (!isNaN(dueMs)) {
        targetMs = dueMs - offsetMinutes * 60 * 1000;
      }
    } else {
      // From current time
      targetMs = Date.now() + offsetMinutes * 60 * 1000;
    }

    if (!targetMs || isNaN(targetMs)) {
      return { formatted: 'Invalid date or time', isPast: false, dateStr: '' };
    }

    const triggerDate = new Date(targetMs);
    const isPast = targetMs <= Date.now();

    const formatted = triggerDate.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    return { formatted, isPast, dateStr: triggerDate.toISOString() };
  };

  // Submit new reminder
  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForReminder) return;

    setSavingReminder(true);
    setFeedbackMessage(null);

    try {
      const trigger = getCalculatedTrigger();
      if (!trigger || !trigger.dateStr) {
        throw new Error('Unable to calculate valid trigger date');
      }

      await api.createTaskReminder(selectedTaskForReminder._id, {
        amount: Number(reminderAmount),
        unit: reminderUnit,
        triggerTime: trigger.dateStr,
        targetDueDate: reminderDueDate || undefined,
        targetDueTime: reminderDueTime || undefined,
      });

      setFeedbackMessage({
        type: 'success',
        text: `Reminder scheduled! Dobby will send alerts ${reminderAmount} ${reminderUnit === 'days' ? (reminderAmount === 1 ? 'day' : 'days') : (reminderAmount === 1 ? 'hour' : 'hours')} before (${trigger.formatted}).`,
      });

      onRefresh();

      setTimeout(() => {
        setSelectedTaskForReminder(null);
        setFeedbackMessage(null);
      }, 1500);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to schedule reminder',
      });
    } finally {
      setSavingReminder(false);
    }
  };

  // Delete an existing reminder from the task
  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await api.deleteReminder(reminderId);
      onRefresh();
    } catch (err: any) {
      alert('Failed to remove reminder: ' + err.message);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'pending' && t.status === 'completed') return false;
    if (filterStatus === 'completed' && t.status !== 'completed') return false;
    if (filterGroup !== 'all' && t.groupId !== filterGroup) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const inTitle = t.title.toLowerCase().includes(term);
      const inDesc = t.description?.toLowerCase().includes(term);
      const inAssignee = t.assigneeName?.toLowerCase().includes(term);
      if (!inTitle && !inDesc && !inAssignee) return false;
    }
    return true;
  });

  const priorityColors = {
    high: 'text-rose-400 bg-rose-950/30 border-rose-800/40',
    medium: 'text-amber-400 bg-amber-950/30 border-amber-800/40',
    low: 'text-sky-400 bg-sky-950/30 border-sky-800/40',
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Action bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 bg-[#0a1529]/90 border border-sky-900/40 p-2.5 sm:p-3 rounded-2xl shadow-sm backdrop-blur-md">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-sky-400/60 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks or assignees..."
            className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          {/* Status filter */}
          <div className="flex rounded-xl bg-[#060e1d] p-1 border border-sky-900/40 text-xs">
            {(['all', 'pending', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg capitalize font-medium transition-colors text-[11px] sm:text-xs ${
                  filterStatus === s
                    ? 'bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 font-bold shadow-sm'
                    : 'text-sky-200/70 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Group filter */}
          {groups.length > 0 && (
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="bg-[#060e1d] border border-sky-900/40 rounded-xl px-2.5 py-1.5 text-xs text-sky-200 focus:outline-none focus:border-sky-400"
            >
              <option value="all">All Groups</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}

          {/* Add Task Button */}
          <button
            id="btn-add-task"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 whitespace-nowrap transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Task Cards */}
      {filteredTasks.length === 0 ? (
        <div className="p-6 sm:p-8 text-center bg-[#0a1529]/60 border border-sky-900/40 rounded-2xl">
          <Circle className="w-8 h-8 mx-auto mb-2 text-sky-500/40" />
          <p className="text-sm font-semibold text-slate-200">No tasks found</p>
          <p className="text-xs text-sky-200/60 mt-1">
            Create a manual task or capture commitments using the AI Ingest desk above.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const isDone = task.status === 'completed';
            const priorityColors = {
              high: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
              medium: 'text-sky-300 bg-sky-500/15 border-sky-500/30',
              low: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
            };

            const taskActiveReminders = (reminders || []).filter(
              (r) => r.taskId === task._id && r.status !== 'dismissed'
            );

            return (
              <div
                key={task._id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isDone
                    ? 'bg-[#060e1d]/50 border-sky-950/40 opacity-60'
                    : 'bg-[#0a1529]/90 border-sky-900/40 hover:border-sky-700/60 shadow-sm backdrop-blur-md'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Complete Checkbox */}
                  <button
                    onClick={() => handleToggleComplete(task._id)}
                    className="mt-0.5 text-sky-400/50 hover:text-sky-400 transition-colors shrink-0 p-0.5"
                    title={isDone ? 'Mark Pending' : 'Mark Completed'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  {/* Task Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <h4
                        className={`text-sm font-semibold text-slate-100 break-words ${
                          isDone ? 'line-through text-sky-300/50' : ''
                        }`}
                      >
                        {task.title}
                      </h4>

                      {/* Priority Badge */}
                      <span
                        className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                          priorityColors[task.priority] || priorityColors.medium
                        }`}
                      >
                        {task.priority}
                      </span>

                      {/* Group Tag */}
                      {task.groupName && (
                        <span className="text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#0e1d38] text-sky-200 border border-sky-800/50">
                          {task.groupName}
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-sky-200/60 mt-1 leading-relaxed break-words">
                        {task.description}
                      </p>
                    )}

                    {/* Meta Row: Due date, assignee, reminders, evidence */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs text-sky-200/60">
                      {task.dueDate && (
                        <div className="flex items-center gap-1.5 text-sky-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>
                            {task.dueDate} {task.dueTime ? `@ ${task.dueTime}` : ''}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{task.assigneeName || 'Unassigned'}</span>
                      </div>

                      {/* Active Reminder Pill */}
                      {taskActiveReminders.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openReminderModal(task)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-md hover:bg-emerald-900/40 transition-colors"
                          title="Click to view or adjust reminder timing"
                        >
                          <Bell className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>
                            {taskActiveReminders.length === 1
                              ? taskActiveReminders[0].status === 'fired'
                                ? 'Alert Fired'
                                : 'Reminder Active'
                              : `${taskActiveReminders.length} Reminders`}
                          </span>
                        </button>
                      )}

                      {task.sourceEvidence?.excerpt && (
                        <div
                          className="flex items-center gap-1 text-[11px] text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md truncate max-w-[200px] sm:max-w-xs"
                          title={task.sourceEvidence.excerpt}
                        >
                          <Tag className="w-3 h-3 shrink-0" />
                          <span className="truncate">&ldquo;{task.sourceEvidence.excerpt}&rdquo;</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openReminderModal(task)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        taskActiveReminders.length > 0
                          ? 'bg-emerald-950/30 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
                          : 'bg-[#0e1d38] text-sky-300 border-sky-800/50 hover:bg-sky-900/50 hover:border-sky-600'
                      }`}
                      title="Set a new reminder time in hours or days before"
                    >
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="hidden sm:inline">
                        {taskActiveReminders.length > 0 ? 'Reminder Set' : 'Set Reminder'}
                      </span>
                      <span className="sm:hidden text-[11px]">Reminder</span>
                    </button>

                    <button
                      onClick={() => handleDeleteTask(task._id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Task Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-[#0a1529] border border-sky-900/50 rounded-2xl p-6 shadow-2xl shadow-sky-950/40">
            <h3 className="text-base font-bold text-slate-100 mb-4">Create Authoritative Task</h3>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-sky-200/80 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Schedule Jordan Dental Appointment"
                  className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-sky-200/80 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Additional context, phone numbers, reference IDs..."
                  className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-sky-200/80 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sky-200/80 mb-1">Due Time</label>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              {newDueDate && (
                <div>
                  <label className="block text-xs font-semibold text-sky-200/80 mb-1">
                    ⏰ WhatsApp &amp; In-App Reminder Timing
                  </label>
                  <select
                    value={newReminderOffset}
                    onChange={(e) =>
                      setNewReminderOffset(e.target.value === 'none' ? 'none' : Number(e.target.value))
                    }
                    className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                  >
                    <option value={15}>15 minutes before due</option>
                    <option value={30}>30 minutes before due</option>
                    <option value={60}>1 hour before due (Default)</option>
                    <option value={120}>2 hours before due</option>
                    <option value={240}>4 hours before due</option>
                    <option value={1440}>1 day before due (24 hours)</option>
                    <option value={2880}>2 days before due (48 hours)</option>
                    <option value={4320}>3 days before due (72 hours)</option>
                    <option value={10080}>1 week before due (7 days)</option>
                    <option value={0}>At exact due time</option>
                    <option value="none">No automated reminder</option>
                  </select>
                  <p className="text-[10px] text-sky-200/50 mt-1">
                    Dobby schedules a reminder and notifies the assignee via WhatsApp when due.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-sky-200/80 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sky-200/80 mb-1">Group</label>
                  <select
                    value={newGroupId}
                    onChange={(e) => setNewGroupId(e.target.value)}
                    className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                  >
                    <option value="">Personal</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sky-200/80 mb-1">Assign Owner</label>
                <select
                  value={newAssignedTo}
                  onChange={(e) => setNewAssignedTo(e.target.value)}
                  className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                >
                  <option value={currentUser?._id || ''}>Me ({currentUser?.name})</option>
                  {users
                    .filter((u) => u._id !== currentUser?._id)
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-sky-900/40">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-sky-200/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-xs transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  {creating ? 'Saving...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Reminder Modal (Set new reminder in hours or days before) */}
      {selectedTaskForReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-[#0a1529] border border-sky-900/50 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-sky-950/60 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-sky-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Set Reminder Timing</h3>
                  <p className="text-xs text-sky-200/60">
                    Schedule automated WhatsApp &amp; In-App alert notifications
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTaskForReminder(null);
                  setFeedbackMessage(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Info Summary */}
            <div className="p-3 rounded-xl bg-[#060e1d] border border-sky-900/40 mb-4">
              <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider mb-1">Target Task</div>
              <div className="text-sm font-bold text-slate-100 break-words">{selectedTaskForReminder.title}</div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-sky-200/70 flex-wrap">
                <span>Assignee: <strong className="text-sky-100">{selectedTaskForReminder.assigneeName || 'You'}</strong></span>
                {selectedTaskForReminder.dueDate && (
                  <>
                    <span>•</span>
                    <span>Due: <strong className="text-cyan-300">{selectedTaskForReminder.dueDate} {selectedTaskForReminder.dueTime ? `@ ${selectedTaskForReminder.dueTime}` : ''}</strong></span>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveReminder} className="space-y-4">
              {/* Reference Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-sky-200/80 mb-1.5">
                  Calculate Reminder Relative To
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReminderRefMode('before_due')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      reminderRefMode === 'before_due'
                        ? 'bg-sky-500/20 text-sky-200 border-sky-400 shadow-sm'
                        : 'bg-[#060e1d] text-sky-300/60 border-sky-900/40 hover:text-white'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Before Due Date</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderRefMode('from_now')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      reminderRefMode === 'from_now'
                        ? 'bg-sky-500/20 text-sky-200 border-sky-400 shadow-sm'
                        : 'bg-[#060e1d] text-sky-300/60 border-sky-900/40 hover:text-white'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>From Right Now</span>
                  </button>
                </div>
              </div>

              {/* If relative to due date, show or allow setting due date & time */}
              {reminderRefMode === 'before_due' && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#060e1d]/80 border border-sky-900/40">
                  <div>
                    <label className="block text-xs font-semibold text-sky-200/80 mb-1">Task Due Date</label>
                    <input
                      type="date"
                      required
                      value={reminderDueDate}
                      onChange={(e) => setReminderDueDate(e.target.value)}
                      className="w-full bg-[#0a1529] border border-sky-900/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-200/80 mb-1">Due Time</label>
                    <input
                      type="time"
                      value={reminderDueTime}
                      onChange={(e) => setReminderDueTime(e.target.value)}
                      className="w-full bg-[#0a1529] border border-sky-900/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>
              )}

              {/* Presets for Hours and Days Before */}
              <div>
                <label className="block text-xs font-semibold text-sky-200/80 mb-1.5">
                  Quick Presets (Hours / Days {reminderRefMode === 'before_due' ? 'Before' : 'From Now'})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { amount: 1, unit: 'hours' as const, label: '1h Before' },
                    { amount: 2, unit: 'hours' as const, label: '2h Before' },
                    { amount: 4, unit: 'hours' as const, label: '4h Before' },
                    { amount: 1, unit: 'days' as const, label: '1 Day Before' },
                    { amount: 2, unit: 'days' as const, label: '2 Days Before' },
                    { amount: 3, unit: 'days' as const, label: '3 Days Before' },
                    { amount: 7, unit: 'days' as const, label: '1 Week (7d)' },
                  ].map((preset) => {
                    const isSelected =
                      reminderAmount === preset.amount && reminderUnit === preset.unit;
                    return (
                      <button
                        key={`${preset.amount}-${preset.unit}`}
                        type="button"
                        onClick={() => {
                          setReminderAmount(preset.amount);
                          setReminderUnit(preset.unit);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 font-bold border-cyan-400 shadow-sm'
                            : 'bg-[#060e1d] text-sky-200/70 border-sky-900/40 hover:border-sky-700 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Value & Unit Selector (Hours / Days) */}
              <div>
                <label className="block text-xs font-semibold text-sky-200/80 mb-1.5">
                  Custom Timing (Set in Hours or Days)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] text-sky-200/60 mb-1">Amount</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      required
                      value={reminderAmount}
                      onChange={(e) => setReminderAmount(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-sky-200/60 mb-1">Unit</span>
                    <select
                      value={reminderUnit}
                      onChange={(e) => setReminderUnit(e.target.value as 'hours' | 'days')}
                      className="w-full bg-[#060e1d] border border-sky-900/40 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="hours">Hours {reminderRefMode === 'before_due' ? 'Before Due' : 'From Now'}</option>
                      <option value="days">Days {reminderRefMode === 'before_due' ? 'Before Due' : 'From Now'}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Dynamic Live Preview Box */}
              {(() => {
                const trigger = getCalculatedTrigger();
                if (!trigger) return null;

                return (
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${
                      trigger.isPast
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                        : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>
                        {trigger.isPast
                          ? 'Calculated time is in the past'
                          : 'Calculated Dispatch Time'}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-200">
                      {trigger.isPast ? (
                        <span>
                          The calculated time ({trigger.formatted}) has already elapsed. Dobby will trigger the alert immediately from now.
                        </span>
                      ) : (
                        <span>
                          Dobby will send automated WhatsApp alerts &amp; in-app notifications on{' '}
                          <strong className="text-emerald-300 font-bold">{trigger.formatted}</strong> ({reminderAmount}{' '}
                          {reminderUnit === 'days'
                            ? reminderAmount === 1 ? 'day' : 'days'
                            : reminderAmount === 1 ? 'hour' : 'hours'}{' '}
                          {reminderRefMode === 'before_due' ? 'before due' : 'from now'}).
                        </span>
                      )}
                    </p>
                  </div>
                );
              })()}

              {feedbackMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    feedbackMessage.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{feedbackMessage.text}</span>
                </div>
              )}

              {/* Existing Reminders for this task */}
              {(() => {
                const taskReminders = reminders.filter(
                  (r) => r.taskId === selectedTaskForReminder._id && r.status !== 'dismissed'
                );
                if (taskReminders.length === 0) return null;

                return (
                  <div className="pt-2 border-t border-sky-900/40">
                    <span className="block text-[11px] font-semibold text-sky-200/80 mb-2">
                      Active Scheduled Reminders on this Task ({taskReminders.length})
                    </span>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {taskReminders.map((rem) => (
                        <div
                          key={rem._id}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#060e1d] border border-sky-900/30 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate text-slate-200">{rem.title}</span>
                            <span className="text-[10px] text-sky-400/80 shrink-0">
                              {new Date(rem.triggerTime).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteReminder(rem._id)}
                            className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                            title="Delete this reminder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-sky-900/40">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskForReminder(null);
                    setFeedbackMessage(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-sky-200/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReminder}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-xs transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{savingReminder ? 'Scheduling...' : 'Save & Schedule Reminder'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
