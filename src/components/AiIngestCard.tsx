import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Check,
  AlertCircle,
  FileText,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  UploadCloud,
  Image as ImageIcon,
  MessageSquare,
  Smartphone,
  Paperclip,
  Trash2,
  Camera,
  Eye,
  FileCheck,
  Files,
  Plus,
  X,
} from 'lucide-react';
import { api } from '../api';
import { Group, TaskSuggestion } from '../types';

interface AiIngestCardProps {
  groups: Group[];
  selectedGroupId: string;
  onTasksCreated: () => void;
}

interface SamplePreset {
  label: string;
  icon: string;
  type: 'text' | 'message' | 'document' | 'image';
  text: string;
  description: string;
}

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    label: '🦉 WhatsApp Chat',
    icon: 'message',
    type: 'message',
    description: 'Conversational chat thread with shared promises & deadlines',
    text: `[12/03/2026, 14:22:10] Alex: Hey Sarah, can you please call Dr. Chen's pediatric clinic tomorrow at 10 AM to schedule Jordan's annual dental checkup?
[12/03/2026, 14:25:34] Sarah: Sure, I will book it first thing in the morning! Also remember to pick up the dry cleaning before Saturday noon.
[12/03/2026, 14:26:01] Alex: Got it. Don't forget to submit the science fair permission slip by Thursday 3 PM as well.`,
  },
  {
    label: '💬 SMS Message Alert',
    icon: 'sms',
    type: 'message',
    description: 'SMS notification from clinic / service provider',
    text: `From: Westside Medical Care (+1-555-0192)
Date: Today, 9:15 AM
Reminder: Your prescription refill at Corner Pharmacy is ready for pickup. Please collect it before Friday 6:00 PM. Reply STOP to opt out.`,
  },
  {
    label: '📜 School Permission Slip',
    icon: 'slip',
    type: 'document',
    description: 'Educational field trip notice & required return date',
    text: `Oakridge Middle School - Spring Excursion Notice
To the Parents/Guardians of 7th Grade Students:
Please review and return the attached signed permission form along with the $25 museum entry fee by tomorrow, 3:00 PM. We need an exact count for chartered transportation.
- Principal Vance`,
  },
  {
    label: '⚡ Utility Bill / Invoice',
    icon: 'bill',
    type: 'document',
    description: 'Billing statement with due date & late penalty',
    text: `City Water & Power - Billing Notification
Account: #98421-Rivera
Billing Period: Current Month
Total Amount Due: $94.20
Payment Deadline: Next Friday at 5:00 PM.
Late penalties of 10% will be incurred if not settled through our portal or phone support before the deadline.`,
  },
  {
    label: '📝 Doc Meeting Minutes',
    icon: 'doc',
    type: 'document',
    description: 'Action items & commitments from team/household notes',
    text: `Project & Household Sync Notes - September 2026
Action Items:
1. Submit the Q3 financial report to accounting by next Tuesday 4:00 PM (Alex)
2. Schedule HVAC heating inspection before next Monday 11:00 AM (Sarah)
3. Renew vehicle registration online by the 25th of this month (High priority)`,
  },
];

export const AiIngestCard: React.FC<AiIngestCardProps> = ({
  groups,
  selectedGroupId,
  onTasksCreated,
}) => {
  // Input modes: 'upload' | 'paste'
  const [activeMode, setActiveMode] = useState<'upload' | 'paste'>('upload');
  const [inputText, setInputText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [inputType, setInputType] = useState<'text' | 'image' | 'document' | 'message'>('document');
  const [isDragOver, setIsDragOver] = useState(false);

  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [ingestionId, setIngestionId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [availableMembers, setAvailableMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [extractionEngine, setExtractionEngine] = useState<string | null>(null);
  const [extractionNotice, setExtractionNotice] = useState<string | null>(null);
  const [detectedInputType, setDetectedInputType] = useState<string | null>(null);
  const [extractedTextPreview, setExtractedTextPreview] = useState<string | null>(null);
  const [extractedFilesSummary, setExtractedFilesSummary] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Maintain image object URLs for thumbnail previews
  useEffect(() => {
    const newPreviews: Record<string, string> = {};
    selectedFiles.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const key = `${file.name}-${file.size}-${index}`;
        newPreviews[key] = URL.createObjectURL(file);
      }
    });
    setImagePreviews(newPreviews);

    return () => {
      Object.values(newPreviews).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  // Handle clipboard paste listener (for screenshots via Cmd+V / Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const file = new File([blob], `screenshot_${new Date().toISOString().replace(/[:.]/g, '-')}.png`, {
              type: blob.type || 'image/png',
            });
            handleFilesSelect([file]);
            setActiveMode('upload');
            setError(null);
            setSuccessMsg('📸 Screenshot captured from clipboard and added to files!');
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFilesSelect = (incoming: FileList | File[]) => {
    const incomingArray = Array.from(incoming);
    if (incomingArray.length === 0) return;

    setError(null);
    setSuccessMsg(null);

    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const fresh = incomingArray.filter((f) => !existingKeys.has(`${f.name}-${f.size}`));
      const combined = [...prev, ...fresh];

      // Auto-detect dominant input type
      const hasDoc = combined.some(
        (f) =>
          f.name.toLowerCase().endsWith('.pdf') ||
          f.name.toLowerCase().match(/\.(docx?|odt|rtf)$/) ||
          f.type === 'application/pdf'
      );
      const hasImg = combined.some(
        (f) => f.type.startsWith('image/') || f.name.match(/\.(png|jpe?g|webp|gif|bmp)$/i)
      );
      const hasChat = combined.some((f) => f.name.match(/(chat|whatsapp|sms)\.txt$/i));

      if (hasDoc) {
        setInputType('document');
      } else if (hasImg) {
        setInputType('image');
      } else if (hasChat) {
        setInputType('message');
      } else {
        setInputType('document');
      }

      if (fresh.length > 0) {
        setSuccessMsg(
          combined.length > 1
            ? `📎 ${combined.length} files attached and ready for Dobby!`
            : `📎 Attached: ${fresh[0].name}`
        );
      }

      return combined;
    });
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAllFiles = () => {
    setSelectedFiles([]);
    setError(null);
    setSuccessMsg(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handlePasteClipboardClick = async () => {
    try {
      if (!navigator.clipboard?.read) {
        setError('Direct clipboard reading is not supported by your browser. Simply press Ctrl+V / Cmd+V to paste your screenshot!');
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      let foundImage = false;
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `screenshot_${Date.now()}.png`, { type: imageType });
          handleFilesSelect([file]);
          setActiveMode('upload');
          setSuccessMsg('📸 Screenshot retrieved from clipboard and added to files!');
          foundImage = true;
          break;
        }
      }
      if (!foundImage) {
        setError('No image found in clipboard. Copy an image or screenshot first, or press Ctrl+V to paste.');
      }
    } catch (err: any) {
      setError('Could not access clipboard image directly. Please press Ctrl+V / Cmd+V anywhere on the page to paste.');
    }
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0 && !inputText.trim()) {
      setError('Please upload one or more files (Docs, PDFs, Images, Screenshots, Chats) or paste text to extract tasks.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await api.analyzeContent(
        selectedFiles.length > 0
          ? {
              files: selectedFiles,
              text: inputText.trim() || undefined,
              inputType,
              groupId: selectedGroupId || undefined,
            }
          : {
              text: inputText.trim(),
              inputType,
              groupId: selectedGroupId || undefined,
            }
      );

      setIngestionId(res.ingestionId);
      setSuggestions(res.suggestions || []);
      setAvailableMembers(res.availableMembers || []);
      setExtractionEngine(res.engine || null);
      setExtractionNotice(res.notice || null);
      setDetectedInputType(res.detectedInputType || inputType);
      setExtractedTextPreview(res.extractedTextPreview || null);
      setExtractedFilesSummary(res.fileNames || (res.fileName ? [res.fileName] : []));

      if (!res.suggestions || res.suggestions.length === 0) {
        setError('No actionable tasks or commitments were detected in the provided content.');
      }
    } catch (err: any) {
      setError(err.message || 'AI extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSuggestion = (index: number, field: keyof TaskSuggestion, value: any) => {
    const next = [...suggestions];
    next[index] = { ...next[index], [field]: value };
    setSuggestions(next);
  };

  const handleRemoveSuggestion = (index: number) => {
    setSuggestions(suggestions.filter((_, i) => i !== index));
  };

  const handleConfirmAll = async () => {
    if (suggestions.length === 0) return;
    setConfirming(true);
    setError(null);

    try {
      const mappedTasks = suggestions.map((s) => {
        let assignedToId: string | undefined = undefined;
        if (s.assignedToName && availableMembers.length > 0) {
          const match = availableMembers.find(
            (m) => m.name.toLowerCase() === s.assignedToName?.toLowerCase()
          );
          if (match) assignedToId = match.id;
        }

        return {
          title: s.title,
          description: s.description,
          dueDate: s.dueDate,
          dueTime: s.dueTime,
          priority: s.priority,
          assignedTo: assignedToId,
          sourceExcerpt: s.sourceExcerpt,
          confidence: s.confidence,
          originalExpression: s.originalExpression,
        };
      });

      const res = await api.confirmTasks(ingestionId || '', mappedTasks, selectedGroupId || undefined);
      setSuccessMsg(res.message || 'Tasks and reminders committed to MongoDB!');
      setSuggestions([]);
      setIngestionId(null);
      setSelectedFiles([]);
      setExtractedFilesSummary([]);
      setInputText('');
      onTasksCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to commit tasks to database');
    } finally {
      setConfirming(false);
    }
  };

  const getFormatBadge = (type: string, fileName?: string) => {
    const lower = (fileName || '').toLowerCase();
    if (type === 'image' || lower.match(/\.(png|jpe?g|webp|gif)$/)) {
      return { label: 'Image / Screenshot', icon: ImageIcon, color: 'text-sky-300 bg-sky-500/10 border-sky-500/30' };
    }
    if (lower.endsWith('.pdf')) {
      return { label: 'PDF Document', icon: FileText, color: 'text-red-300 bg-red-500/10 border-red-500/30' };
    }
    if (lower.match(/\.docx?$/)) {
      return { label: 'Word Document', icon: FileText, color: 'text-blue-300 bg-blue-500/10 border-blue-500/30' };
    }
    if (type === 'message' || lower.match(/(chat|whatsapp|sms)/)) {
      return { label: 'WhatsApp / SMS Chat', icon: MessageSquare, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' };
    }
    return { label: 'Text / Note', icon: FileText, color: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' };
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Decorative ambient shimmer blur */}
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pensieve-ripple" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-tr from-slate-900 to-indigo-950 border border-cyan-500/30 text-cyan-300 shadow-sm shadow-cyan-500/20 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold font-cinzel text-slate-100 flex items-center gap-2">
              Dobby&apos;s Memory Desk
              <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                AI Ingestion
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Upload photos, documents, bills, or paste WhatsApp messages — Dobby extracts all commitments.
            </p>
          </div>
        </div>

        {/* Input Mode Selector */}
        <div className="flex items-center p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveMode('upload')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeMode === 'upload'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload File / Photo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('paste')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeMode === 'paste'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Paste Text / Chat</span>
          </button>
        </div>
      </div>

      {/* Preset Scrolls Quick Selector (Compact Horizontal Scroll) */}
      <div className="mb-3.5 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <span className="text-[11px] font-bold text-slate-500 shrink-0 whitespace-nowrap pl-0.5">
          Samples:
        </span>
        {SAMPLE_PRESETS.map((sample) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => {
              setInputText(sample.text);
              setInputType(sample.type);
              setSelectedFiles([]);
              setActiveMode('paste');
              setSuggestions([]);
              setError(null);
              setSuccessMsg(`Loaded sample: ${sample.label}`);
            }}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            {sample.label}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Mode 1: File Upload (Doc, PDF, Image, Screenshot, Chat export - Supports Multiple Files) */}
      {activeMode === 'upload' && (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            id="multimodal-file-input"
            className="hidden"
            multiple
            accept=".doc,.docx,.pdf,.txt,.md,.csv,.log,image/*,.png,.jpg,.jpeg,.webp"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesSelect(e.target.files);
                e.target.value = '';
              }
            }}
          />

          {selectedFiles.length === 0 ? (
            /* Empty State Drop Zone */
            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-2xl p-5 sm:p-7 text-center transition-all cursor-pointer relative ${
                isDragOver
                  ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-500/10'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="space-y-2.5 py-1">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center justify-center mx-auto shadow-sm">
                  <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-200">
                    Choose files, photos, or drag &amp; drop here
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                    Supports Word docs (<span className="text-cyan-300 font-mono">.docx</span>), PDFs, Photos, bills, screenshots, or WhatsApp exports.
                  </p>
                  <div className="mt-2.5">
                    <span className="inline-block text-[11px] font-bold px-3 py-1 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                      Tap or Click to Select
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Multi-File Attached Container */
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 space-y-3">
                {/* Header with count and actions */}
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Files className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Attached Files ({selectedFiles.length})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      • {(selectedFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB total
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add More</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllFiles}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/30 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* List of Attached Files */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {selectedFiles.map((file, idx) => {
                    const previewKey = `${file.name}-${file.size}-${idx}`;
                    const imgUrl = imagePreviews[previewKey];
                    const badge = getFormatBadge(inputType, file.name);
                    const BadgeIcon = badge.icon;

                    return (
                      <div
                        key={previewKey}
                        className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {imgUrl ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-cyan-500/30 shrink-0 bg-slate-950">
                              <img
                                src={imgUrl}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700 text-cyan-400 flex items-center justify-center shrink-0">
                              <BadgeIcon className="w-5 h-5" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-100 truncate" title={file.name}>
                              {file.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${badge.color}`}>
                                {badge.label}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {(file.size / 1024).toFixed(0)} KB
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1.5 rounded-lg hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition-colors shrink-0"
                          title="Remove this file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Drag-over target when files are already present */}
                <div
                  ref={dropZoneRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-xl p-2.5 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-cyan-400 bg-cyan-950/30 text-cyan-300'
                      : 'border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-300 bg-slate-950/30'
                  }`}
                >
                  <p className="text-[11px] flex items-center justify-center gap-1.5">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Drop additional files here, or click to add more</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Optional context text accompanying the files */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <span>Optional Note / Question to Dobby:</span>
              <span className="text-[10px] text-slate-500 font-normal">
                (e.g., &quot;Compare deadlines across all these files&quot; or &quot;Assign the field trip to Sarah&quot;)
              </span>
            </label>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Provide extra context or instructions across all files, or leave empty..."
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Quick paste screenshot from clipboard button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handlePasteClipboardClick}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>📸 Paste Screenshot from Clipboard (or Ctrl+V)</span>
            </button>

            <button
              type="button"
              id="btn-analyze-file"
              onClick={handleAnalyze}
              disabled={loading || (selectedFiles.length === 0 && !inputText.trim())}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span>
                    {selectedFiles.length > 1
                      ? `Examining ${selectedFiles.length} files with Gemini...`
                      : 'Extracting with Gemini...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {selectedFiles.length > 1
                      ? `Dobby • Extract Tasks from ${selectedFiles.length} Files`
                      : selectedFiles.length === 1
                      ? 'Dobby • Extract Tasks from File'
                      : 'Dobby • Extract Tasks'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Paste Text / Chat Transcript (WhatsApp, SMS, Notes) */}
      {activeMode === 'paste' && (
        <div className="space-y-3">
          <div className="relative">
            <textarea
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste conversational messages, WhatsApp chat exports, SMS threads, invoice details, or school slips here..."
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors font-mono leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Scroll Format:</span>
              {(['message', 'document', 'text'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setInputType(t)}
                  className={`px-2.5 py-0.5 rounded capitalize transition-colors ${
                    inputType === t
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'message' ? 'WhatsApp / SMS' : t === 'document' ? 'Notice / Doc' : 'Plain Text'}
                </button>
              ))}
            </div>

            <button
              type="button"
              id="btn-analyze-content"
              onClick={handleAnalyze}
              disabled={loading || !inputText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span>Siphoning Memories with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Cast Revelio • Extract Tasks</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Extracted Suggestions Review Stage */}
      {suggestions.length > 0 && (
        <div className="mt-7 pt-6 border-t border-slate-800 animate-fade-in">
          {extractionNotice && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{extractionNotice}</span>
            </div>
          )}

          {extractedTextPreview && (
            <div className="mb-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>Extracted Document Excerpt:</span>
              </div>
              <p className="line-clamp-2 text-slate-300">{extractedTextPreview}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold font-cinzel text-slate-200">
                Revealed Commitments ({suggestions.length})
              </h3>
              {extractionEngine && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    extractionEngine.startsWith('gemini')
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  {extractionEngine.startsWith('gemini')
                    ? `AI Assistant: ${extractionEngine}`
                    : "Dobby's Pattern Engine"}
                </span>
              )}
              {detectedInputType && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                  Source: {detectedInputType}
                </span>
              )}
              {extractedFilesSummary.length > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 max-w-md truncate" title={extractedFilesSummary.join(', ')}>
                  <Files className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {extractedFilesSummary.length === 1
                      ? extractedFilesSummary[0]
                      : `${extractedFilesSummary.length} Files: ${extractedFilesSummary.join(', ')}`}
                  </span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleConfirmAll}
              disabled={confirming || suggestions.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{confirming ? 'Saving Tasks...' : 'Commit All to Household Tasks'}</span>
            </button>
          </div>

          {/* Cards for each suggested task */}
          <div className="space-y-3">
            {suggestions.map((suggestion, idx) => (
              <div
                key={suggestion.id || idx}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors relative"
              >
                <button
                  type="button"
                  onClick={() => handleRemoveSuggestion(idx)}
                  className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 transition-colors text-xs font-semibold p-1"
                  title="Discard suggestion"
                >
                  ✕ Discard
                </button>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pr-14">
                  {/* Title & Description */}
                  <div className="md:col-span-6 space-y-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Task Title
                      </label>
                      <input
                        type="text"
                        value={suggestion.title}
                        onChange={(e) => handleUpdateSuggestion(idx, 'title', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-semibold focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Context / Notes
                      </label>
                      <input
                        type="text"
                        value={suggestion.description || ''}
                        onChange={(e) => handleUpdateSuggestion(idx, 'description', e.target.value)}
                        placeholder="Additional details from source..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Due Date & Time */}
                  <div className="md:col-span-3 space-y-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        <span>Due Date</span>
                      </label>
                      <input
                        type="date"
                        value={suggestion.dueDate || ''}
                        onChange={(e) => handleUpdateSuggestion(idx, 'dueDate', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>Due Time</span>
                      </label>
                      <input
                        type="time"
                        value={suggestion.dueTime || ''}
                        onChange={(e) => handleUpdateSuggestion(idx, 'dueTime', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Priority & Suggested Owner */}
                  <div className="md:col-span-3 space-y-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Priority
                      </label>
                      <select
                        value={suggestion.priority}
                        onChange={(e) =>
                          handleUpdateSuggestion(idx, 'priority', e.target.value as 'low' | 'medium' | 'high')
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 capitalize"
                      >
                        <option value="high">🔴 High Priority</option>
                        <option value="medium">🟡 Medium Priority</option>
                        <option value="low">🟢 Low Priority</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <User className="w-3 h-3 text-cyan-400" />
                        <span>Suggested Owner</span>
                      </label>
                      <input
                        type="text"
                        value={suggestion.assignedToName || ''}
                        onChange={(e) => handleUpdateSuggestion(idx, 'assignedToName', e.target.value)}
                        placeholder="Assignee name..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Evidence footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-900 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Source Evidence:</span>
                    <span className="italic text-slate-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      &quot;{suggestion.sourceExcerpt || suggestion.originalExpression || 'Detected from content'}&quot;
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {suggestion.originalExpression && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        Phrase: {suggestion.originalExpression}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        suggestion.confidence >= 0.8
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {Math.round(suggestion.confidence * 100)}% Confidence
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
