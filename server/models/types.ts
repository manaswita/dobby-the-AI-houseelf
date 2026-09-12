export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  phoneNumber?: string;
  timeZone?: string;
  locale?: string;
  notificationPrefs?: {
    email?: boolean;
    whatsapp?: boolean;
    inApp?: boolean;
    push?: boolean;
    alertEmail?: string;
    whatsappPhone?: string;
    notifyOnAssigned?: boolean;
    notifyOnReminder?: boolean;
    notifyOnDailyDigest?: boolean;
  };
  deviceTokens?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IGroupMember {
  userId: string;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface IGroup {
  _id: string;
  name: string;
  description?: string;
  type: 'family' | 'work' | 'personal' | 'project' | 'other';
  createdBy: string;
  members: IGroupMember[];
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface IChatMessage {
  _id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  content: string;
  isAiElf?: boolean;
  createdAt: string;
}

export interface ISourceEvidence {
  excerpt?: string;
  confidence?: number;
  originalExpression?: string;
  page?: number;
  block?: string;
}

export interface ITask {
  _id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  timeZone?: string;
  createdBy: string;
  assignedTo?: string; // User ID
  groupId?: string; // Group ID or undefined for personal
  sourceEvidence?: ISourceEvidence;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface IReminder {
  _id: string;
  taskId: string;
  userId: string;
  triggerTime: string; // ISO string
  relativeMinutes?: number; // e.g. 15, 60, 1440
  type: 'relative' | 'custom';
  status: 'scheduled' | 'fired' | 'snoozed' | 'dismissed';
  title: string;
  createdAt: string;
}

export interface INotification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'reminder' | 'group_invite' | 'task_completed' | 'system';
  refId?: string; // Task ID, Group ID, etc.
  read: boolean;
  createdAt: string;
}

export interface ITaskSuggestion {
  id?: string;
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: 'low' | 'medium' | 'high';
  assignedToName?: string;
  confidence: number;
  sourceExcerpt?: string;
  originalExpression?: string;
  warnings?: string[];
}

export interface IIngestionRun {
  _id: string;
  userId: string;
  rawText: string;
  inputType: 'text' | 'image' | 'document' | 'message';
  extractedSuggestions: ITaskSuggestion[];
  status: 'analyzed' | 'confirmed' | 'discarded';
  confirmedTaskIds?: string[];
  createdAt: string;
}

export interface INotificationDeliveryLog {
  _id: string;
  userId: string;
  taskId?: string;
  reminderId?: string;
  channel: 'email' | 'whatsapp' | 'in_app';
  recipient: string;
  status: 'sent' | 'simulated' | 'failed';
  subject?: string;
  content: string;
  error?: string;
  messageSid?: string;
  createdAt: string;
}
