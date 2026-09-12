export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  timeZone?: string;
  locale?: string;
  notificationPrefs?: {
    email?: boolean;
    whatsapp?: boolean;
    push?: boolean;
    inApp?: boolean;
    alertEmail?: string;
    whatsappPhone?: string;
    notifyOnAssigned?: boolean;
    notifyOnReminder?: boolean;
    notifyOnDailyDigest?: boolean;
  };
}

export interface GroupMember {
  userId: string;
  name?: string;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface ChatMessage {
  _id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  content: string;
  isAiElf?: boolean;
  createdAt: string;
}

export interface RegisteredUser {
  _id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  timeZone?: string;
}

export interface Group {
  _id: string;
  name: string;
  description?: string;
  type: string;
  createdBy: string;
  members: GroupMember[];
  inviteCode: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  dueTime?: string;
  timeZone?: string;
  createdBy: string;
  creatorName?: string;
  assignedTo?: string;
  assigneeName?: string;
  groupId?: string;
  groupName?: string;
  sourceEvidence?: {
    excerpt?: string;
    confidence?: number;
    originalExpression?: string;
  };
  version: number;
  createdAt: string;
  completedAt?: string;
}

export interface Reminder {
  _id: string;
  taskId: string;
  taskTitle?: string;
  taskDueDate?: string;
  taskPriority?: string;
  taskStatus?: string;
  userId: string;
  triggerTime: string;
  relativeMinutes?: number;
  type: 'relative' | 'custom';
  status: 'scheduled' | 'fired' | 'snoozed' | 'dismissed';
  title: string;
}

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'reminder' | 'group_invite' | 'task_completed' | 'system';
  refId?: string;
  read: boolean;
  createdAt: string;
}

export interface TaskSuggestion {
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

export interface SystemHealth {
  status: string;
  timestamp: string;
  database: {
    connectedToMongoDB: boolean;
    mongoUriProvided: boolean;
    mode: string;
    error: string | null;
    counts: {
      users: number;
      groups: number;
      tasks: number;
      reminders: number;
      notifications: number;
      ingestions: number;
    };
  };
  ai: {
    provider: string;
    model: string;
    configured: boolean;
  };
  version: string;
  uptimeSeconds: number;
}

export interface NotificationDeliveryLog {
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

export interface ChannelsStatus {
  channels: {
    whatsapp: {
      configured: boolean;
      provider: string;
      from: string;
    };
  };
  userPrefs: UserProfile['notificationPrefs'];
  userContact: {
    phoneNumber?: string;
    whatsappPhone?: string;
  };
}
