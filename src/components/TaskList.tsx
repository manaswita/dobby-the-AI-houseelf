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
} from 'lucide-react';
import { api } from '../api';
import { Task, Group, UserProfile } from '../types';

interface TaskListProps {
  tasks: Task[];
  groups: Group[];
  users: Array<{ _id: string; name: string }>;
  currentUser: UserProfile | null;
  onRefresh: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
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
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [creating, setCreating] = useState(false);

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
      await api.createTask({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        dueDate: newDueDate || undefined,
        dueTime: newDueTime || undefined,
        priority: newPriority,
        assignedTo: newAssignedTo || currentUser?._id,
        groupId: newGroupId || undefined,
        createReminders: [60], // 1 hour before
      });

      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
      setShowCreateModal(false);
      onRefresh();
    } catch (err: any) {
      alert('Failed to create task: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'pending' && t.status === 'completed') return false;
    if (filterStatus === 'completed' && t.status !== 'completed') return false;
    if (filterGroup !== 'all' && t.groupId !== filterGroup) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.assigneeName && t.assigneeName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Action bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 bg-slate-900/90 border border-slate-800 p-2.5 sm:p-3 rounded-2xl">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks or assignees..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          {/* Status filter */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
            {(['all', 'pending', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg capitalize font-medium transition-colors text-[11px] sm:text-xs ${
                  filterStatus === s
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
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
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-sm shadow-cyan-500/20 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Task Cards */}
      {filteredTasks.length === 0 ? (
        <div className="p-6 sm:p-8 text-center bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <Circle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">No tasks found</p>
          <p className="text-xs text-slate-500 mt-1">
            Create a manual task or capture commitments using the AI Ingest desk above.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const isDone = task.status === 'completed';
            const priorityColors = {
              high: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
              medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              low: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
            };

            return (
              <div
                key={task._id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isDone
                    ? 'bg-slate-950/40 border-slate-900 opacity-65'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Complete Checkbox */}
                  <button
                    onClick={() => handleToggleComplete(task._id)}
                    className="mt-0.5 text-slate-500 hover:text-cyan-400 transition-colors shrink-0 p-0.5"
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
                          isDone ? 'line-through text-slate-400' : ''
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
                        <span className="text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {task.groupName}
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed break-words">
                        {task.description}
                      </p>
                    )}

                    {/* Meta Row: Due date, assignee, evidence */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs text-slate-400">
                      {task.dueDate && (
                        <div className="flex items-center gap-1.5 text-cyan-300/90 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>
                            {task.dueDate} {task.dueTime ? `@ ${task.dueTime}` : ''}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{task.assigneeName || 'Unassigned'}</span>
                      </div>

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
                  <div className="flex items-center gap-1 shrink-0">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-4">Create Authoritative Task</h3>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Schedule Jordan Dental Appointment"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Additional context, phone numbers, reference IDs..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Due Time</label>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Group</label>
                  <select
                    value={newGroupId}
                    onChange={(e) => setNewGroupId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Owner</label>
                <select
                  value={newAssignedTo}
                  onChange={(e) => setNewAssignedTo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  {creating ? 'Saving...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
