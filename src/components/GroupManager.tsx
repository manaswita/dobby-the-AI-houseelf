import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Key,
  Shield,
  UserPlus,
  Check,
  Copy,
  MessageSquare,
  Search,
  Mail,
  UserCheck,
  X,
  Trash2,
  Home,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { api } from '../api';
import { Group, UserProfile, RegisteredUser } from '../types';
import { FamilyChat } from './FamilyChat';

interface GroupManagerProps {
  groups: Group[];
  currentUser: UserProfile | null;
  onRefresh: () => void;
}

export const GroupManager: React.FC<GroupManagerProps> = ({
  groups,
  currentUser,
  onRefresh,
}) => {
  // Navigation: null = list overview, string = groupId for active chat
  const [activeChatGroupId, setActiveChatGroupId] = useState<string | null>(null);

  // Modals state
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [targetAddMemberGroup, setTargetAddMemberGroup] = useState<Group | null>(null);
  const [targetEditGroup, setTargetEditGroup] = useState<Group | null>(null);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('family');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState('family');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Join form state
  const [inviteCode, setInviteCode] = useState('');

  // Add Member state
  const [availableUsers, setAvailableUsers] = useState<RegisteredUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [manualEmail, setManualEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'member' | 'admin'>('member');
  const [addMode, setAddMode] = useState<'select' | 'manual'>('select');
  const [addMemberStatus, setAddMemberStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // General state
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch available registered users on mount and when add member modal opens
  useEffect(() => {
    loadAvailableUsers();
  }, []);

  useEffect(() => {
    if (targetAddMemberGroup) {
      loadAvailableUsers();
      setSelectedUserId('');
      setManualEmail('');
      setAddMemberStatus(null);
      setUserSearchQuery('');
    }
  }, [targetAddMemberGroup]);

  const loadAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.getAvailableUsers();
      setAvailableUsers(res.users || []);
    } catch (err) {
      console.warn('Could not load available users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const resolveMemberName = (m: { userId: string; name?: string }) => {
    if (m.name && m.name !== 'Unknown Member' && m.name !== 'Member') {
      return m.name;
    }
    if (currentUser && String(currentUser._id) === String(m.userId)) {
      return currentUser.name || 'You';
    }
    const matched = availableUsers.find((u) => String(u._id) === String(m.userId));
    if (matched && matched.name) {
      return matched.name;
    }
    return m.name || 'Member';
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    try {
      const res = await api.createGroup(name.trim(), description.trim(), type);
      setName('');
      setDescription('');
      setShowCreate(false);
      onRefresh();
      // Optionally jump straight to chat for newly created family
      if (res.group?._id) {
        setActiveChatGroupId(res.group._id);
      }
    } catch (err: any) {
      alert('Failed to create group: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);

    try {
      const res = await api.joinGroup(inviteCode.trim().toUpperCase());
      setInviteCode('');
      setShowJoin(false);
      onRefresh();
      if (res.group?._id) {
        setActiveChatGroupId(res.group._id);
      }
    } catch (err: any) {
      alert('Failed to join group: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAddMemberGroup) return;

    if (addMode === 'select' && !selectedUserId) {
      setAddMemberStatus({ type: 'error', message: 'Please select an existing user from the list.' });
      return;
    }
    if (addMode === 'manual' && !manualEmail.trim()) {
      setAddMemberStatus({ type: 'error', message: 'Please enter an existing user email address.' });
      return;
    }

    setLoading(true);
    setAddMemberStatus(null);

    try {
      const payload =
        addMode === 'select'
          ? { userId: selectedUserId, role: memberRole }
          : { email: manualEmail.trim(), role: memberRole };

      const res = await api.addMember(targetAddMemberGroup._id, payload);
      setAddMemberStatus({ type: 'success', message: res.message || 'Member added successfully!' });
      setSelectedUserId('');
      setManualEmail('');
      onRefresh();

      // Close modal after brief delay so user sees confirmation
      setTimeout(() => {
        setTargetAddMemberGroup(null);
        setAddMemberStatus(null);
      }, 1400);
    } catch (err: any) {
      setAddMemberStatus({ type: 'error', message: err.message || 'Failed to add member' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (groupId: string, memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this group?`)) return;

    try {
      await api.removeMember(groupId, memberId);
      onRefresh();
    } catch (err: any) {
      alert('Failed to remove member: ' + (err.message || err));
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenEditGroup = (group: Group) => {
    setTargetEditGroup(group);
    setEditName(group.name);
    setEditDescription(group.description || '');
    setEditType(group.type || 'family');
    setEditError(null);
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEditGroup) return;
    if (!editName.trim()) {
      setEditError('Family name cannot be empty');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      await api.updateGroup(targetEditGroup._id, {
        name: editName.trim(),
        description: editDescription.trim(),
        type: editType,
      });
      setTargetEditGroup(null);
      onRefresh();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update family name');
    } finally {
      setEditLoading(false);
    }
  };

  // Find active group for chat view
  const activeChatGroup = groups.find((g) => g._id === activeChatGroupId);

  // Filter available users by search query
  const filteredUsers = availableUsers.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const renderEditGroupModal = () => {
    if (!targetEditGroup) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-cyan-400" />
              <span>Edit Family Name &amp; Details</span>
            </h3>
            <button
              type="button"
              onClick={() => setTargetEditGroup(null)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleUpdateGroup} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Family Name *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Miller Family or Smith Household"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="e.g. Household chores, schedules, and groceries"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Type
              </label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="family">Family</option>
                <option value="household">Household</option>
                <option value="caregivers">Caregivers &amp; Elders</option>
                <option value="relatives">Extended Relatives</option>
                <option value="project">Project / Roommates</option>
              </select>
            </div>

            {editError && (
              <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-rose-500/10 text-rose-300 border border-rose-500/30">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTargetEditGroup(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading || !editName.trim()}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {editLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderAddMemberModal = () => {
    if (!targetAddMemberGroup) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-cyan-400" />
                <span>Add Member to {targetAddMemberGroup.name}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Select any existing registered user to add them as a member to this family.
              </p>
            </div>
            <button
              onClick={() => setTargetAddMemberGroup(null)}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode selection toggle */}
          <div className="flex p-1 bg-slate-950 rounded-xl mb-4 border border-slate-800">
            <button
              type="button"
              onClick={() => setAddMode('select')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                addMode === 'select'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Select from Registered Users</span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode('manual')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                addMode === 'manual'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enter Email Address</span>
            </button>
          </div>

          <form onSubmit={handleAddMember} className="space-y-4 flex-1 flex flex-col overflow-hidden">
            {addMode === 'select' ? (
              <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
                {/* Search input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search existing users by name or email..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
                  />
                </div>

                {/* Users list */}
                <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-800/60 max-h-56 p-1">
                  {loadingUsers ? (
                    <div className="p-6 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Loading registered users...</span>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      No registered users matching "{userSearchQuery}".
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isAlreadyMember = targetAddMemberGroup.members.some(
                        (m) => m.userId === u._id
                      );
                      const isSelected = selectedUserId === u._id;

                      return (
                        <div
                          key={u._id}
                          onClick={() => {
                            if (!isAlreadyMember) {
                              setSelectedUserId(u._id);
                            }
                          }}
                          className={`p-2.5 rounded-lg flex items-center justify-between text-xs transition-colors ${
                            isAlreadyMember
                              ? 'opacity-50 cursor-not-allowed bg-slate-950'
                              : isSelected
                              ? 'bg-cyan-500/10 border border-cyan-500/40 cursor-pointer'
                              : 'hover:bg-slate-900 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-cyan-300">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <div className="font-semibold text-slate-200 truncate">{u.name}</div>
                              <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                            </div>
                          </div>

                          <div>
                            {isAlreadyMember ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap">
                                <UserCheck className="w-3 h-3" />
                                Already In Family
                              </span>
                            ) : isSelected ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/40 whitespace-nowrap">
                                <Check className="w-3 h-3" />
                                Selected
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 hover:text-cyan-300 font-medium">
                                Click to select
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Existing User's Registered Email *
                </label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="e.g. maria@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The user must have an existing TaskLens account with this email.
                </p>
              </div>
            )}

            {/* Role selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Family Role in {targetAddMemberGroup.name}
              </label>
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as 'member' | 'admin')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="member">Family Member (can view, chat, and complete chores)</option>
                <option value="admin">Family Admin (can invite/remove members and manage family)</option>
              </select>
            </div>

            {/* Status banner */}
            {addMemberStatus && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  addMemberStatus.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                }`}
              >
                {addMemberStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{addMemberStatus.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTargetAddMemberGroup(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (addMode === 'select' && !selectedUserId) || (addMode === 'manual' && !manualEmail.trim())}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add to Family</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // If user selected a family to chat with, render FamilyChat with modal overlays
  if (activeChatGroup) {
    return (
      <div className="space-y-4">
        <FamilyChat
          group={activeChatGroup}
          allGroups={groups}
          currentUser={currentUser}
          onBack={() => setActiveChatGroupId(null)}
          onSelectGroup={(newGroup) => setActiveChatGroupId(newGroup._id)}
          onOpenAddMember={(grp) => setTargetAddMemberGroup(grp)}
          onOpenEditGroup={(grp) => handleOpenEditGroup(grp)}
        />
        {/* Render edit & member modals if opened from chat view */}
        {targetEditGroup && renderEditGroupModal()}
        {targetAddMemberGroup && renderAddMemberModal()}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-slate-100">
                Family &amp; Collaboration Hub
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              You are currently a member of{' '}
              <span className="text-cyan-300 font-semibold">{groups.length}</span>{' '}
              {groups.length === 1 ? 'family' : 'families'}. Add existing users to collaborate and chat in real-time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJoin(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
            >
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Join Family with Code</span>
            </button>

            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Family</span>
            </button>
          </div>
        </div>

        {/* Quick Family Navigation Pills */}
        {groups.length > 0 && (
          <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs pb-1">
            <span className="text-slate-500 text-[11px] font-medium whitespace-nowrap">
              Your Families:
            </span>
            {groups.map((group) => (
              <button
                key={group._id}
                onClick={() => setActiveChatGroupId(group._id)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 whitespace-nowrap text-xs font-medium transition-all group"
              >
                <Home className="w-3 h-3 text-cyan-400" />
                <span>{group.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300">
                  {group.members.length}
                </span>
                <MessageSquare className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 ml-0.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Families Grid */}
      {groups.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">No Families Found Yet</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Create a new family to coordinate tasks, assign chores, and chat with members, or join an existing family using their 6-character invite code.
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20"
            >
              Create First Family
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700"
            >
              Join Existing Family
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group) => {
            const isCallerAdmin = group.members.some(
              (m) => m.userId === currentUser?._id && m.role === 'admin'
            ) || group.createdBy === currentUser?._id;

            return (
              <div
                key={group._id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
              >
                <div>
                  {/* Title and Type */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                          <span>{group.name}</span>
                          {isCallerAdmin && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              <Shield className="w-2.5 h-2.5" />
                              Admin
                            </span>
                          )}
                        </h4>
                        <button
                          onClick={() => handleOpenEditGroup(group)}
                          className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
                          title="Edit family name & details"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {group.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{group.description}</p>
                      )}
                    </div>

                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                      {group.type}
                    </span>
                  </div>

                  {/* Members list */}
                  <div className="space-y-2 my-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3 text-cyan-400" />
                        Family Members ({group.members.length}):
                      </span>
                      <button
                        onClick={() => setTargetAddMemberGroup(group)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Add Existing User</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                      {group.members.map((m) => {
                        const isMe = String(m.userId) === String(currentUser?._id);
                        const memberDisplayName = resolveMemberName(m);
                        return (
                          <div
                            key={m.userId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 group/member"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{memberDisplayName}</span>
                            {isMe && <span className="text-slate-500 text-[9px]">(You)</span>}
                            {m.role === 'admin' && (
                              <Shield className="w-2.5 h-2.5 text-amber-400" title="Admin" />
                            )}
                            {isCallerAdmin && !isMe && (
                              <button
                                onClick={() => handleRemoveMember(group._id, m.userId, memberDisplayName)}
                                className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors ml-0.5 opacity-0 group-hover/member:opacity-100"
                                title="Remove member"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Invite Code */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-[11px]">Code:</span>
                    <button
                      onClick={() => handleCopyCode(group.inviteCode)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 hover:bg-slate-850 text-cyan-300 font-mono font-bold text-xs border border-slate-800 hover:border-slate-700 transition-colors"
                      title="Copy invite code"
                    >
                      <span>{group.inviteCode}</span>
                      {copiedCode === group.inviteCode ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-500" />
                      )}
                    </button>
                  </div>

                  {/* Action Buttons: Chat, Edit & Add Member */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditGroup(group)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                      title="Edit family name & details"
                    >
                      <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setTargetAddMemberGroup(group)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                      title="Add an existing user to this family"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Add</span>
                    </button>

                    <button
                      onClick={() => setActiveChatGroupId(group._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20"
                      title="Open Family Chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Family Chat</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Family Modal */}
      {renderEditGroupModal()}

      {/* Add Existing User Modal */}
      {renderAddMemberModal()}

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-1">Create New Family</h3>
            <p className="text-xs text-slate-400 mb-4">
              You can create as many families as you like. One user can belong to multiple families simultaneously.
            </p>
            <form onSubmit={handleCreateGroup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Family Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Miller Family or Lakehouse Crew"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Household chores, schedules, and groceries"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="family">Family</option>
                  <option value="household">Household</option>
                  <option value="caregivers">Caregivers &amp; Elders</option>
                  <option value="relatives">Extended Relatives</option>
                  <option value="project">Project / Roommates</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create & Open Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-1">Join Family via Invite Code</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the 6-character code shared by any family admin. Joining will add this family alongside your existing families.
            </p>
            <form onSubmit={handleJoinGroup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Invite Code *</label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 7E2B01"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono tracking-widest text-cyan-300 focus:outline-none focus:border-cyan-500 text-center uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowJoin(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Join Family'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
