import React, { useState } from 'react';
import {
  Sparkles,
  UploadCloud,
  CheckCircle2,
  Clock,
  MessageSquare,
  Users,
  Smartphone,
  Calendar,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  FileText,
  FileSpreadsheet,
  Check,
  ChevronRight,
  Bot,
  Zap,
} from 'lucide-react';

interface CapabilitiesGuideProps {
  onNavigateTab: (tab: 'tasks' | 'reminders' | 'groups') => void;
  onOpenWhatsAppModal: () => void;
  onScrollToIngest?: () => void;
}

export const CapabilitiesGuide: React.FC<CapabilitiesGuideProps> = ({
  onNavigateTab,
  onOpenWhatsAppModal,
  onScrollToIngest,
}) => {
  const [activeFeature, setActiveFeature] = useState<number>(0);

  const capabilities = [
    {
      id: 'multimodal-ingest',
      title: '1. AI Task & Reminder Extraction',
      badge: 'Cognitive Engine',
      icon: Sparkles,
      color: 'from-sky-500 to-cyan-400',
      tagline: 'Transform chaotic texts, photos, invoices, and chats into structured calendar tasks.',
      whatItDoes: [
        'Reads messy WhatsApp group chat exports with promises and deadlines.',
        'Extracts utility bill due dates, amounts, and account numbers from PDF/Images.',
        'Parses school circulars, doctor prescription slips, and permission forms.',
        'Understands relative time expressions like "tomorrow at 3 PM", "next Friday", "in 2 hours", and converts them to precise dates/times in your timezone.',
        'Automatically attributes commitments to family members (e.g. assigning "pick up dry cleaning" to Sarah).',
      ],
      howToUse: [
        'Go to the top "AI Ingest Engine" card.',
        'Type or paste a message into the text box, or drag & drop files (PNG, JPG, PDF, Word .docx, CSV, TXT) or paste a screenshot using Ctrl+V.',
        'Or click any of the 4 ready-to-test sample presets (WhatsApp Chat, SMS Alert, Utility Bill, School Circular).',
        'Click "Extract Tasks with Dobby".',
        'Review the AI-extracted suggestions, adjust any titles, dates, or assignees if needed, and click "Commit All Tasks" to save them to the database.',
      ],
      actionLabel: 'Try AI Ingestion',
      actionType: 'ingest',
    },
    {
      id: 'task-management',
      title: '2. Family Task Organization & Tracking',
      badge: 'Household Workflow',
      icon: CheckCircle2,
      color: 'from-cyan-500 to-teal-400',
      tagline: 'Keep track of all pending, overdue, and completed household commitments.',
      whatItDoes: [
        'Sorts tasks into Today, Upcoming, Overdue, and Completed views.',
        'Supports priorities: Urgent, High, Medium, Low.',
        'Allows manual task creation with due date, time, and family member assignment.',
        'Displays AI extraction confidence and the original excerpt text where the task was discovered.',
      ],
      howToUse: [
        'Click the "Tasks" tab in the top navigation bar.',
        'Filter by status (All, Pending, Completed, Today) or group by assigned family member.',
        'Click "+ New Task" to manually create a quick task with due date, time, and priority.',
        'Click the checkbox on any task item to instantly mark it as completed or reopen it.',
      ],
      actionLabel: 'View Tasks Tab',
      actionType: 'tasks',
    },
    {
      id: 'reminders-daemon',
      title: '3. Timed Reminders & Snooze Scheduling',
      badge: 'Automated Daemon',
      icon: Clock,
      color: 'from-amber-400 to-orange-400',
      tagline: 'Precision 60-second background reminder engine that alerts you right when tasks are due.',
      whatItDoes: [
        'A background scanner runs every 60 seconds on the server, checking for scheduled alerts whose time has arrived.',
        'Provides quick presets: 1 Hour Before, 2 Hours Before, 1 Day Before, or exact due time.',
        'Supports instant 10-minute snooze, 1-hour snooze, or custom reschedule when alerts arrive.',
        'Automatically writes in-app notifications and queues WhatsApp/webhook dispatch.',
      ],
      howToUse: [
        'From any task card, click the "Set Reminder" / Clock button to attach a reminder.',
        'Choose a timing preset (e.g. At Due Time, 1 Hour Before, Tomorrow 9 AM) or set an exact date & time.',
        'Switch to the "Reminders" tab in the top navigation to view all scheduled, triggered, and snoozed alerts.',
        'Click "Trigger Test Now" on any reminder to verify the notification pipeline immediately.',
      ],
      actionLabel: 'View Reminders Tab',
      actionType: 'reminders',
    },
    {
      id: 'whatsapp-alerts',
      title: '4. WhatsApp & Mobile Notification Alerts',
      badge: 'Direct Messaging',
      icon: Smartphone,
      color: 'from-emerald-400 to-teal-400',
      tagline: 'Receive proactive alerts on your phone through WhatsApp or custom webhooks.',
      whatItDoes: [
        'Sends reminder notifications directly to your phone number via WhatsApp.',
        'Supports custom HTTP Webhook URLs (compatible with Twilio, Make.com, Zapier, n8n).',
        'Keeps an audit trail of sent and delivered alerts.',
      ],
      howToUse: [
        'Click the "WhatsApp Alerts" button in the navigation bar or top header.',
        'Enter your WhatsApp phone number with international country code (e.g. +91 9876543210 or +1 4155552671).',
        'Toggle WhatsApp and Push notifications ON, then click "Save Preferences".',
        'Click "Send Test Alert" to verify your device receives the ping.',
      ],
      actionLabel: 'Configure WhatsApp Alerts',
      actionType: 'whatsapp',
    },
    {
      id: 'family-groups',
      title: '5. Household Circles & Family Collaboration',
      badge: 'Collaboration',
      icon: Users,
      color: 'from-indigo-400 to-sky-400',
      tagline: 'Share responsibilities across family members, roommates, or household helpers.',
      whatItDoes: [
        'Organizes tasks by family group or project circle.',
        'Assigns specific tasks to different family members (Mom, Dad, Kids, Co-workers).',
        'Provides a Family Chat Board where notes and promises can be posted and auto-converted into tasks.',
      ],
      howToUse: [
        'Click the "Family & Chat" tab in the navigation bar.',
        'Create a new group (e.g. "Rivera Household", "Summer Vacation 2026").',
        'Add members or share the unique invite code.',
        'Post notes or promises on the group message board.',
      ],
      actionLabel: 'View Family Circles',
      actionType: 'groups',
    },
  ];

  const current = capabilities[activeFeature];

  const handleAction = (type: string) => {
    if (type === 'ingest') {
      if (onScrollToIngest) {
        onScrollToIngest();
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (type === 'tasks') {
      onNavigateTab('tasks');
    } else if (type === 'reminders') {
      onNavigateTab('reminders');
    } else if (type === 'groups') {
      onNavigateTab('groups');
    } else if (type === 'whatsapp') {
      onOpenWhatsAppModal();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Overview Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#09152a] via-[#0d1d3a] to-[#071020] border border-sky-800/40 shadow-xl shadow-sky-950/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Guide &amp; Playbook
              </span>
              <span className="text-xs text-sky-200/60 font-mono">Dobby v1.2</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-cinzel text-white flex items-center gap-2">
              <span>What Dobby Can Do &amp; How to Use It</span>
              <span className="text-lg">🧙‍♂️</span>
            </h2>
            <p className="text-xs sm:text-sm text-sky-200/70 leading-relaxed">
              Dobby is your dedicated AI Elf assistant for family life. It eliminates household mental load by
              extracting deadlines from messy real-world messages and keeping everyone on schedule via timed WhatsApp alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleAction('ingest')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 hover:from-sky-300 hover:to-cyan-300 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Try AI Ingestion</span>
            </button>
            <button
              onClick={onOpenWhatsAppModal}
              className="px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/40 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>WhatsApp Alerts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feature Selector + Interactive Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Capability List / Navigation */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-sky-300/70 px-1 mb-2 flex items-center justify-between">
            <span>Capabilities Index</span>
            <span className="text-[10px] text-sky-200/50">{capabilities.length} Features</span>
          </div>

          {capabilities.map((cap, idx) => {
            const Icon = cap.icon;
            const isSelected = activeFeature === idx;

            return (
              <button
                key={cap.id}
                onClick={() => setActiveFeature(idx)}
                className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#0f2244] border-sky-500/50 text-white shadow-md shadow-sky-950/40'
                    : 'bg-[#0a1529]/80 border-sky-900/40 text-sky-200/70 hover:bg-[#0d1d38] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-gradient-to-tr ' + cap.color + ' text-slate-950 font-bold shadow-sm'
                        : 'bg-[#0e1d38] text-sky-400 border border-sky-800/40'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold truncate text-slate-100">{cap.title}</div>
                    <div className="text-[10px] text-sky-200/60 truncate">{cap.badge}</div>
                  </div>
                </div>

                <ChevronRight
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-sky-400/40'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right Side: Deep Dive Details for Selected Capability */}
        <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-[#0a1529]/90 border border-sky-900/50 shadow-xl shadow-sky-950/20 backdrop-blur-md space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sky-900/40">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  {current.badge}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>{current.title}</span>
              </h3>
              <p className="text-xs text-sky-200/70 mt-1">{current.tagline}</p>
            </div>

            <button
              onClick={() => handleAction(current.actionType)}
              className="self-start sm:self-auto px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 hover:from-sky-300 hover:to-cyan-300 shadow-md shadow-cyan-500/20 transition-all shrink-0"
            >
              <span>{current.actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Section: What Dobby Does */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>What Dobby Does</span>
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {current.whatItDoes.map((item, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-[#070e1c] border border-sky-950 flex items-start gap-2.5 text-xs text-slate-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                  <span className="leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section: How to Perform Each Task */}
          <div className="space-y-2 pt-2 border-t border-sky-900/30">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Step-by-Step Instructions</span>
            </h4>
            <div className="space-y-2">
              {current.howToUse.map((step, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[#0e1d38]/50 border border-sky-800/40 flex items-start gap-3"
                >
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs text-sky-100/90 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
