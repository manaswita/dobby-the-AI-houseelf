import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Users,
  UserPlus,
  RefreshCw,
  Trash2,
  Bot,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { api } from '../api';
import { Group, ChatMessage, UserProfile } from '../types';

interface FamilyChatProps {
  group: Group;
  allGroups: Group[];
  currentUser: UserProfile | null;
  onBack: () => void;
  onSelectGroup: (group: Group) => void;
  onOpenAddMember: (group: Group) => void;
  onOpenEditGroup?: (group: Group) => void;
}

export const FamilyChat: React.FC<FamilyChatProps> = ({
  group,
  allGroups,
  currentUser,
  onBack,
  onSelectGroup,
  onOpenAddMember,
  onOpenEditGroup,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [askElf, setAskElf] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await api.getMessages(group._id);
      setMessages(res.messages || []);
    } catch (err: any) {
      console.warn('Failed to load messages for family:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll every 4 seconds for fresh messages from family members
    const interval = setInterval(() => {
      fetchMessages(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [group._id]);

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string, forceElf?: boolean) => {
    if (e) e.preventDefault();
    const textToSend = (customText !== undefined ? customText : inputText).trim();
    if (!textToSend || sending) return;

    setSending(true);
    const shouldAskElf = forceElf !== undefined ? forceElf : askElf;

    try {
      const res = await api.sendMessage(group._id, textToSend, shouldAskElf);
      if (res.messages) {
        setMessages(res.messages);
      }
      setInputText('');
      setAskElf(false);
      setAutoScroll(true);
    } catch (err: any) {
      alert('Failed to send message: ' + (err.message || err));
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await api.deleteMessage(group._id, messageId);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } catch (err: any) {
      alert('Could not delete message: ' + (err.message || err));
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const otherFamilies = allGroups.filter((g) => g._id !== group._id);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col h-[680px] overflow-hidden">
      {/* Top Navigation & Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Back to all families"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>{group.name}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  Family Chat
                </span>
              </h3>
              {onOpenEditGroup && (
                <button
                  onClick={() => onOpenEditGroup(group)}
                  className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
                  title="Edit family name & details"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
              <span className="flex items-center gap-1 text-slate-400">
                <Users className="w-3 h-3 text-cyan-400" />
                {group.members.length} members
              </span>
              <span className="text-slate-600">•</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <Sparkles className="w-3 h-3" />
                Dobby AI Elf active
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Family Switcher if user belongs to multiple families */}
          {allGroups.length > 1 && (
            <div className="relative">
              <select
                value={group._id}
                onChange={(e) => {
                  const target = allGroups.find((g) => g._id === e.target.value);
                  if (target) onSelectGroup(target);
                }}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
                title="Switch family chat"
              >
                {allGroups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name} ({g.members.length} members)
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => onOpenAddMember(group)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
            title="Add an existing registered user to this family"
          >
            <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Add Member</span>
          </button>

          <button
            onClick={() => fetchMessages(false)}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh chat"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Members Bar */}
      <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between text-xs overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5 flex-nowrap">
          <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Members:</span>
          {group.members.map((m) => (
            <span
              key={m.userId}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap border ${
                m.userId === currentUser?._id
                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  : 'bg-slate-900 text-slate-300 border-slate-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{m.name || 'Member'}</span>
              {m.userId === currentUser?._id && <span className="text-slate-500 text-[9px]">(You)</span>}
              {m.role === 'admin' && <span className="text-amber-400 text-[9px] font-bold">Admin</span>}
            </span>
          ))}
        </div>

        <span className="text-[10px] text-slate-500 whitespace-nowrap hidden md:block">
          One user can belong to multiple families
        </span>
      </div>

      {/* Chat Messages Feed */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/20"
      >
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <p className="text-xs">Connecting to {group.name} chat...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-10 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200">Welcome to {group.name}'s Family Chat</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Share messages, coordinate grocery lists, ask about schedules, or tag{' '}
                <span className="text-cyan-400 font-semibold">@Dobby</span> for AI Elf assistance!
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md pt-2">
              <button
                onClick={() =>
                  handleSendMessage(undefined, "Hi everyone! Let's use this chat for our family plans.", false)
                }
                className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
              >
                👋 Say Hello to the Family
              </button>
              <button
                onClick={() =>
                  handleSendMessage(
                    undefined,
                    "@Dobby What are quick and healthy dinner ideas for our family tonight?",
                    true
                  )
                }
                className="px-3 py-1 rounded-full bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-xs border border-cyan-700/50 transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Ask Dobby for Dinner Ideas
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?._id;
            const isElf = Boolean(msg.isAiElf);

            return (
              <div
                key={msg._id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
              >
                {/* Sender Tag & Time */}
                <div
                  className={`flex items-center gap-1.5 mb-1 px-1 text-[11px] ${
                    isMe ? 'flex-row-reverse text-slate-400' : 'text-slate-400'
                  }`}
                >
                  {isElf ? (
                    <span className="inline-flex items-center gap-1 font-bold text-cyan-300">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>{msg.senderName}</span>
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-300">
                      {isMe ? 'You' : msg.senderName}
                    </span>
                  )}
                  <span className="text-slate-600">•</span>
                  <span className="text-[10px] text-slate-500">{formatTimestamp(msg.createdAt)}</span>
                </div>

                {/* Message Bubble */}
                <div className="relative max-w-[85%] sm:max-w-[75%]">
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                      isElf
                        ? 'bg-gradient-to-br from-cyan-950/80 via-slate-900 to-slate-950 border border-cyan-500/40 text-cyan-50 shadow-cyan-950/30'
                        : isMe
                        ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 font-medium rounded-tr-sm'
                        : 'bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-tl-sm'
                    }`}
                  >
                    {isElf && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
                        <Bot className="w-3 h-3" />
                        <span>Dobby — The AI Elf Assistant</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>

                  {/* Delete button (visible on hover for sender or admin) */}
                  {(isMe || currentUser?.email) && (
                    <button
                      onClick={() => handleDeleteMessage(msg._id)}
                      className={`absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-rose-400 ${
                        isMe ? '-left-6' : '-right-6'
                      }`}
                      title="Delete message"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Suggestions */}
      <div className="px-4 py-1.5 bg-slate-950/60 border-t border-slate-800/70 flex items-center gap-2 overflow-x-auto text-[11px]">
        <span className="text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          Ask Dobby:
        </span>
        <button
          onClick={() =>
            handleSendMessage(
              undefined,
              "@Dobby Can you suggest a fun family movie or game night plan for this weekend?",
              true
            )
          }
          className="px-2.5 py-0.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 whitespace-nowrap transition-colors"
        >
          🎬 Movie / Game Night
        </button>
        <button
          onClick={() =>
            handleSendMessage(
              undefined,
              "@Dobby What is an efficient chore division for 3 family members?",
              true
            )
          }
          className="px-2.5 py-0.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 whitespace-nowrap transition-colors"
        >
          🧹 Weekend Chores Plan
        </button>
        <button
          onClick={() =>
            handleSendMessage(
              undefined,
              "@Dobby Please summarize 3 healthy grocery essentials for our household.",
              true
            )
          }
          className="px-2.5 py-0.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 whitespace-nowrap transition-colors"
        >
          🛒 Grocery List Ideas
        </button>
      </div>

      {/* Input Composer */}
      <form
        onSubmit={(e) => handleSendMessage(e)}
        className="p-3 bg-slate-950/90 border-t border-slate-800/80 flex items-center gap-2"
      >
        {/* Toggle Ask Dobby button */}
        <button
          type="button"
          onClick={() => setAskElf(!askElf)}
          className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap border ${
            askElf
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
          }`}
          title="Include Dobby AI Elf response"
        >
          <Sparkles className={`w-3.5 h-3.5 ${askElf ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
          <span className="hidden sm:inline">Ask Dobby</span>
        </button>

        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              askElf
                ? "Ask Dobby anything for the family (e.g. dinner ideas, chores, advice)..."
                : `Message ${group.name}... (type @Dobby to ask the AI Elf)`
            }
            className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
              askElf ? 'border-cyan-500/50 focus:border-cyan-400' : 'border-slate-800 focus:border-cyan-500'
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
        >
          {sending ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
