import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config';
import {
  IUser,
  IGroup,
  IChatMessage,
  ITask,
  IReminder,
  INotification,
  IIngestionRun,
  INotificationDeliveryLog,
} from './models/types';

// ==========================================
// 1. Mongoose Schema Definitions (MongoDB)
// ==========================================

const UserMongooseSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phoneNumber: { type: String },
    timeZone: { type: String, default: 'UTC' },
    locale: { type: String, default: 'en-US' },
    notificationPrefs: {
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      alertEmail: { type: String },
      whatsappPhone: { type: String },
      notifyOnAssigned: { type: Boolean, default: true },
      notifyOnReminder: { type: Boolean, default: true },
      notifyOnDailyDigest: { type: Boolean, default: true },
    },
    deviceTokens: [{ type: String }],
  },
  { timestamps: true }
);

const GroupMongooseSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['family', 'work', 'personal', 'project', 'other'], default: 'family' },
    createdBy: { type: String, required: true },
    members: [
      {
        userId: { type: String, required: true },
        role: { type: String, enum: ['admin', 'member'], default: 'member' },
        joinedAt: { type: String, default: () => new Date().toISOString() },
      },
    ],
    inviteCode: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

const TaskMongooseSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'overdue'],
      default: 'pending',
    },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    dueDate: { type: String },
    dueTime: { type: String },
    timeZone: { type: String, default: 'UTC' },
    createdBy: { type: String, required: true },
    assignedTo: { type: String },
    groupId: { type: String },
    sourceEvidence: {
      excerpt: { type: String },
      confidence: { type: Number },
      originalExpression: { type: String },
      page: { type: Number },
      block: { type: String },
    },
    version: { type: Number, default: 1 },
    completedAt: { type: String },
  },
  { timestamps: true }
);

const ReminderMongooseSchema = new Schema<IReminder>(
  {
    taskId: { type: String, required: true },
    userId: { type: String, required: true },
    triggerTime: { type: String, required: true },
    relativeMinutes: { type: Number },
    type: { type: String, enum: ['relative', 'custom'], default: 'relative' },
    status: {
      type: String,
      enum: ['scheduled', 'fired', 'snoozed', 'dismissed'],
      default: 'scheduled',
    },
    title: { type: String, required: true },
  },
  { timestamps: true }
);

const NotificationMongooseSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['task_assigned', 'reminder', 'group_invite', 'task_completed', 'system'],
      default: 'system',
    },
    refId: { type: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const IngestionRunMongooseSchema = new Schema<IIngestionRun>(
  {
    userId: { type: String, required: true },
    rawText: { type: String, required: true },
    inputType: {
      type: String,
      enum: ['text', 'image', 'document', 'message'],
      default: 'text',
    },
    extractedSuggestions: [{ type: Schema.Types.Mixed }],
    status: {
      type: String,
      enum: ['analyzed', 'confirmed', 'discarded'],
      default: 'analyzed',
    },
    confirmedTaskIds: [{ type: String }],
  },
  { timestamps: true }
);

const DeliveryLogMongooseSchema = new Schema<INotificationDeliveryLog>(
  {
    userId: { type: String, required: true },
    taskId: { type: String },
    reminderId: { type: String },
    channel: { type: String, enum: ['email', 'whatsapp', 'in_app'], required: true },
    recipient: { type: String, required: true },
    status: { type: String, enum: ['sent', 'simulated', 'failed'], default: 'sent' },
    subject: { type: String },
    content: { type: String, required: true },
    error: { type: String },
    messageSid: { type: String },
  },
  { timestamps: true }
);

const ChatMessageMongooseSchema = new Schema<IChatMessage>(
  {
    groupId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    content: { type: String, required: true },
    isAiElf: { type: Boolean, default: false },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

// Mongoose Models
export const MongoUserModel: any = mongoose.models.User || mongoose.model('User', UserMongooseSchema);
export const MongoGroupModel: any = mongoose.models.Group || mongoose.model('Group', GroupMongooseSchema);
export const MongoChatMessageModel: any = mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageMongooseSchema);
export const MongoTaskModel: any = mongoose.models.Task || mongoose.model('Task', TaskMongooseSchema);
export const MongoReminderModel: any = mongoose.models.Reminder || mongoose.model('Reminder', ReminderMongooseSchema);
export const MongoNotificationModel: any = mongoose.models.Notification || mongoose.model('Notification', NotificationMongooseSchema);
export const MongoIngestionModel: any = mongoose.models.IngestionRun || mongoose.model('IngestionRun', IngestionRunMongooseSchema);
export const MongoDeliveryLogModel: any = mongoose.models.DeliveryLog || mongoose.model('DeliveryLog', DeliveryLogMongooseSchema);

// ==========================================
// 2. High-Performance Local Persistent Store
//    (Matches MongoDB semantics seamlessly)
// ==========================================

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'tasklens_store.json');

interface IDataStore {
  users: IUser[];
  groups: IGroup[];
  messages: IChatMessage[];
  tasks: ITask[];
  reminders: IReminder[];
  notifications: INotification[];
  ingestions: IIngestionRun[];
  deliveryLogs: INotificationDeliveryLog[];
}

let memoryStore: IDataStore = {
  users: [],
  groups: [],
  messages: [],
  tasks: [],
  reminders: [],
  notifications: [],
  ingestions: [],
  deliveryLogs: [],
};

let isConnectedToMongoDB = false;
let mongoConnectionError: string | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn('Could not create data directory:', e);
    }
  }
}

function loadLocalStore() {
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf-8');
      const loaded = JSON.parse(content);
      memoryStore = {
        users: loaded.users || [],
        groups: loaded.groups || [],
        messages: loaded.messages || [],
        tasks: loaded.tasks || [],
        reminders: loaded.reminders || [],
        notifications: loaded.notifications || [],
        ingestions: loaded.ingestions || [],
        deliveryLogs: loaded.deliveryLogs || [],
      };
    }
  } catch (err) {
    console.warn('Could not load local data store, starting fresh:', err);
  }
}

function saveLocalStore() {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local data store:', err);
  }
}

function generateId(): string {
  return crypto.randomBytes(12).toString('hex');
}

// Unified Collections Layer: Transparently operates on MongoDB (Mongoose) when connected,
// or Local Document Store when MONGODB_URI is not supplied or connecting.

export const db = {
  get isMongoConnected() {
    return isConnectedToMongoDB;
  },

  getConnectionStatus() {
    return {
      connectedToMongoDB: isConnectedToMongoDB,
      mongoUriProvided: Boolean(config.mongoUri),
      mode: isConnectedToMongoDB ? 'MongoDB Atlas / Cluster (Live)' : 'Local Persistent Document Store (MongoDB Emulation)',
      error: mongoConnectionError,
      counts: {
        users: memoryStore.users.length,
        groups: memoryStore.groups.length,
        messages: (memoryStore.messages || []).length,
        tasks: memoryStore.tasks.length,
        reminders: memoryStore.reminders.length,
        notifications: memoryStore.notifications.length,
        ingestions: memoryStore.ingestions.length,
      },
    };
  },

  async getConnectionStatusAsync() {
    let counts = {
      users: memoryStore.users.length,
      groups: memoryStore.groups.length,
      messages: (memoryStore.messages || []).length,
      tasks: memoryStore.tasks.length,
      reminders: memoryStore.reminders.length,
      notifications: memoryStore.notifications.length,
      ingestions: memoryStore.ingestions.length,
    };

    if (isConnectedToMongoDB) {
      try {
        const [users, groups, messages, tasks, reminders, notifications, ingestions] = await Promise.all([
          MongoUserModel.countDocuments(),
          MongoGroupModel.countDocuments(),
          MongoChatMessageModel.countDocuments(),
          MongoTaskModel.countDocuments(),
          MongoReminderModel.countDocuments(),
          MongoNotificationModel.countDocuments(),
          MongoIngestionModel.countDocuments(),
        ]);
        counts = { users, groups, messages, tasks, reminders, notifications, ingestions };
      } catch (err) {
        // Fall back to memory counts if Mongoose query fails
      }
    }

    return {
      connectedToMongoDB: isConnectedToMongoDB,
      mongoUriProvided: Boolean(config.mongoUri),
      mode: isConnectedToMongoDB ? 'MongoDB Atlas / Cluster (Live)' : 'Local Persistent Document Store (MongoDB Emulation)',
      error: mongoConnectionError,
      counts,
    };
  },

  // USERS
  users: {
    async findById(id: string): Promise<IUser | null> {
      if (!id) return null;
      if (isConnectedToMongoDB) {
        try {
          let doc = null;
          if (mongoose.Types.ObjectId.isValid(id)) {
            doc = await MongoUserModel.findById(id).lean();
          }
          if (!doc) {
            doc = await MongoUserModel.findOne({ _id: id }).lean();
          }
          if (doc) {
            return {
              ...doc,
              _id: String(doc._id),
            } as unknown as IUser;
          }
        } catch (e) {
          // fallback to memoryStore
        }
      }
      const local = memoryStore.users.find((u) => String(u._id) === String(id));
      return local ? { ...local, _id: String(local._id) } : null;
    },

    async findByEmail(email: string): Promise<IUser | null> {
      if (!email) return null;
      const normalized = email.trim().toLowerCase();
      if (isConnectedToMongoDB) {
        try {
          const doc = await MongoUserModel.findOne({ email: normalized }).lean();
          if (doc) {
            return {
              ...doc,
              _id: String(doc._id),
            } as unknown as IUser;
          }
        } catch (e) {
          // fallback
        }
      }
      const local = memoryStore.users.find((u) => u.email.toLowerCase() === normalized);
      return local ? { ...local, _id: String(local._id) } : null;
    },

    async create(userData: Partial<IUser>): Promise<IUser> {
      const now = new Date().toISOString();
      const user: IUser = {
        _id: generateId(),
        name: userData.name || '',
        email: (userData.email || '').trim().toLowerCase(),
        passwordHash: userData.passwordHash || '',
        timeZone: userData.timeZone || 'UTC',
        locale: userData.locale || 'en-US',
        notificationPrefs: {
          email: true,
          push: true,
          inApp: true,
          ...(userData.notificationPrefs || {}),
        },
        deviceTokens: userData.deviceTokens || [],
        createdAt: now,
        updatedAt: now,
      };

      if (isConnectedToMongoDB) {
        const created = await MongoUserModel.create(user);
        return created.toObject() as unknown as IUser;
      }

      memoryStore.users.push(user);
      saveLocalStore();
      return user;
    },

    async update(id: string, updates: Partial<IUser>): Promise<IUser | null> {
      if (isConnectedToMongoDB) {
        const updated = await MongoUserModel.findByIdAndUpdate(
          id,
          { ...updates, updatedAt: new Date().toISOString() },
          { new: true }
        ).lean();
        return updated ? (updated as unknown as IUser) : null;
      }

      const idx = memoryStore.users.findIndex((u) => u._id === id);
      if (idx === -1) return null;
      memoryStore.users[idx] = {
        ...memoryStore.users[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      saveLocalStore();
      return memoryStore.users[idx];
    },

    async listAll(): Promise<IUser[]> {
      if (isConnectedToMongoDB) {
        const docs = await MongoUserModel.find().lean();
        return docs as unknown as IUser[];
      }
      return memoryStore.users;
    },
  },

  // GROUPS
  groups: {
    async findById(id: string): Promise<IGroup | null> {
      if (!id) return null;
      if (isConnectedToMongoDB) {
        try {
          let doc = null;
          if (mongoose.Types.ObjectId.isValid(id)) {
            doc = await MongoGroupModel.findById(id).lean();
          }
          if (!doc) {
            doc = await MongoGroupModel.findOne({ _id: id }).lean();
          }
          if (doc) return { ...doc, _id: String(doc._id) } as unknown as IGroup;
        } catch {}
      }
      const local = memoryStore.groups.find((g) => String(g._id) === String(id));
      return local ? { ...local, _id: String(local._id) } : null;
    },

    async findByInviteCode(code: string): Promise<IGroup | null> {
      const normalized = code.trim().toUpperCase();
      if (isConnectedToMongoDB) {
        try {
          const doc = await MongoGroupModel.findOne({ inviteCode: normalized }).lean();
          if (doc) return { ...doc, _id: String(doc._id) } as unknown as IGroup;
        } catch {}
      }
      const local = memoryStore.groups.find((g) => g.inviteCode.toUpperCase() === normalized);
      return local ? { ...local, _id: String(local._id) } : null;
    },

    async findForUser(userId: string): Promise<IGroup[]> {
      const normalizedId = String(userId);
      if (isConnectedToMongoDB) {
        try {
          const docs = await MongoGroupModel.find({
            $or: [
              { 'members.userId': normalizedId },
              { createdBy: normalizedId },
            ],
          }).lean();
          if (docs) {
            const seen = new Set<string>();
            const result: IGroup[] = [];
            for (const d of docs) {
              const sid = String(d._id);
              if (!seen.has(sid)) {
                seen.add(sid);
                result.push({ ...d, _id: sid } as unknown as IGroup);
              }
            }
            return result;
          }
        } catch {}
      }
      const seen = new Set<string>();
      return memoryStore.groups
        .filter((g) => {
          const sid = String(g._id);
          if (seen.has(sid)) return false;
          const match =
            String(g.createdBy) === normalizedId ||
            g.members.some((m) => String(m.userId) === normalizedId);
          if (match) {
            seen.add(sid);
            return true;
          }
          return false;
        })
        .map((g) => ({ ...g, _id: String(g._id) }));
    },

    async create(groupData: Partial<IGroup>): Promise<IGroup> {
      const now = new Date().toISOString();
      const group: IGroup = {
        _id: generateId(),
        name: groupData.name || 'My Group',
        description: groupData.description || '',
        type: groupData.type || 'family',
        createdBy: groupData.createdBy || '',
        members: groupData.members || [],
        inviteCode: groupData.inviteCode || crypto.randomBytes(4).toString('hex').toUpperCase(),
        createdAt: now,
        updatedAt: now,
      };

      if (isConnectedToMongoDB) {
        const created = await MongoGroupModel.create(group);
        return created.toObject() as unknown as IGroup;
      }

      memoryStore.groups.push(group);
      saveLocalStore();
      return group;
    },

    async update(id: string, updates: Partial<IGroup>): Promise<IGroup | null> {
      if (isConnectedToMongoDB) {
        const updated = await MongoGroupModel.findByIdAndUpdate(
          id,
          { ...updates, updatedAt: new Date().toISOString() },
          { new: true }
        ).lean();
        return updated ? (updated as unknown as IGroup) : null;
      }

      const idx = memoryStore.groups.findIndex((g) => g._id === id);
      if (idx === -1) return null;
      memoryStore.groups[idx] = {
        ...memoryStore.groups[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      saveLocalStore();
      return memoryStore.groups[idx];
    },

    async delete(id: string): Promise<boolean> {
      if (isConnectedToMongoDB) {
        const res = await MongoGroupModel.findByIdAndDelete(id);
        return Boolean(res);
      }
      const initialLen = memoryStore.groups.length;
      memoryStore.groups = memoryStore.groups.filter((g) => g._id !== id);
      saveLocalStore();
      return memoryStore.groups.length < initialLen;
    },
  },

  // CHAT MESSAGES (Family & Group Messaging)
  messages: {
    async findForGroup(groupId: string, limit = 100): Promise<IChatMessage[]> {
      if (!groupId) return [];
      if (isConnectedToMongoDB) {
        try {
          const docs = await MongoChatMessageModel.find({ groupId })
            .sort({ createdAt: 1 })
            .limit(limit)
            .lean();
          if (docs && docs.length > 0) {
            return docs.map((d: any) => ({ ...d, _id: String(d._id) })) as unknown as IChatMessage[];
          }
        } catch {}
      }
      const list = (memoryStore.messages || []).filter((m) => m.groupId === groupId);
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return list.slice(-limit).map((m) => ({ ...m, _id: String(m._id) }));
    },

    async create(msgData: Partial<IChatMessage>): Promise<IChatMessage> {
      const now = new Date().toISOString();
      const msg: IChatMessage = {
        _id: generateId(),
        groupId: msgData.groupId || '',
        senderId: msgData.senderId || '',
        senderName: msgData.senderName || 'Family Member',
        content: msgData.content || '',
        isAiElf: Boolean(msgData.isAiElf),
        createdAt: msgData.createdAt || now,
      };

      if (isConnectedToMongoDB) {
        try {
          const created = await MongoChatMessageModel.create(msg);
          return created.toObject() as unknown as IChatMessage;
        } catch {}
      }

      if (!memoryStore.messages) {
        memoryStore.messages = [];
      }
      memoryStore.messages.push(msg);
      saveLocalStore();
      return msg;
    },

    async delete(id: string): Promise<boolean> {
      if (isConnectedToMongoDB) {
        try {
          const res = await MongoChatMessageModel.findByIdAndDelete(id);
          return Boolean(res);
        } catch {}
      }
      if (!memoryStore.messages) return false;
      const prev = memoryStore.messages.length;
      memoryStore.messages = memoryStore.messages.filter((m) => m._id !== id);
      saveLocalStore();
      return memoryStore.messages.length < prev;
    },
  },

  // TASKS
  tasks: {
    async findById(id: string): Promise<ITask | null> {
      if (!id) return null;
      if (isConnectedToMongoDB) {
        try {
          let doc = null;
          if (mongoose.Types.ObjectId.isValid(id)) {
            doc = await MongoTaskModel.findById(id).lean();
          }
          if (!doc) {
            doc = await MongoTaskModel.findOne({ _id: id }).lean();
          }
          if (doc) return { ...doc, _id: String(doc._id) } as unknown as ITask;
        } catch {}
      }
      const local = memoryStore.tasks.find((t) => String(t._id) === String(id));
      return local ? { ...local, _id: String(local._id) } : null;
    },

    async find(query: {
      userId?: string;
      groupId?: string;
      assignedTo?: string;
      status?: string;
      priority?: string;
    }): Promise<ITask[]> {
      if (isConnectedToMongoDB) {
        try {
          const filter: any = {};
          if (query.groupId) {
            filter.groupId = query.groupId;
          } else if (query.userId) {
            filter.$or = [
              { createdBy: query.userId },
              { createdBy: String(query.userId) },
              { assignedTo: query.userId },
              { assignedTo: String(query.userId) },
            ];
          }
          if (query.assignedTo) filter.assignedTo = query.assignedTo;
          if (query.status) filter.status = query.status;
          if (query.priority) filter.priority = query.priority;

          const docs = await MongoTaskModel.find(filter).sort({ createdAt: -1 }).lean();
          return docs.map((d: any) => ({ ...d, _id: String(d._id) })) as unknown as ITask[];
        } catch {}
      }

      let results = [...memoryStore.tasks].map((t) => ({ ...t, _id: String(t._id) }));

      if (query.groupId) {
        results = results.filter((t) => t.groupId === query.groupId);
      } else if (query.userId) {
        results = results.filter((t) => t.createdBy === query.userId || t.assignedTo === query.userId);
      }

      if (query.assignedTo) {
        results = results.filter((t) => t.assignedTo === query.assignedTo);
      }
      if (query.status) {
        results = results.filter((t) => t.status === query.status);
      }
      if (query.priority) {
        results = results.filter((t) => t.priority === query.priority);
      }

      // Sort newest first
      return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async create(taskData: Partial<ITask>): Promise<ITask> {
      const now = new Date().toISOString();
      const task: ITask = {
        _id: generateId(),
        title: taskData.title || '',
        description: taskData.description || '',
        status: taskData.status || 'pending',
        priority: taskData.priority || 'medium',
        dueDate: taskData.dueDate,
        dueTime: taskData.dueTime,
        timeZone: taskData.timeZone || 'UTC',
        createdBy: taskData.createdBy || '',
        assignedTo: taskData.assignedTo,
        groupId: taskData.groupId,
        sourceEvidence: taskData.sourceEvidence,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };

      if (isConnectedToMongoDB) {
        const created = await MongoTaskModel.create(task);
        return created.toObject() as unknown as ITask;
      }

      memoryStore.tasks.push(task);
      saveLocalStore();
      return task;
    },

    async update(id: string, updates: Partial<ITask>): Promise<ITask | null> {
      if (isConnectedToMongoDB) {
        const updated = await MongoTaskModel.findByIdAndUpdate(
          id,
          {
            ...updates,
            $inc: { version: 1 },
            updatedAt: new Date().toISOString(),
          },
          { new: true }
        ).lean();
        return updated ? (updated as unknown as ITask) : null;
      }

      const idx = memoryStore.tasks.findIndex((t) => t._id === id);
      if (idx === -1) return null;
      memoryStore.tasks[idx] = {
        ...memoryStore.tasks[idx],
        ...updates,
        version: (memoryStore.tasks[idx].version || 1) + 1,
        updatedAt: new Date().toISOString(),
      };
      saveLocalStore();
      return memoryStore.tasks[idx];
    },

    async delete(id: string): Promise<boolean> {
      if (isConnectedToMongoDB) {
        const res = await MongoTaskModel.findByIdAndDelete(id);
        return Boolean(res);
      }
      const initial = memoryStore.tasks.length;
      memoryStore.tasks = memoryStore.tasks.filter((t) => t._id !== id);
      // Clean up associated reminders too
      memoryStore.reminders = memoryStore.reminders.filter((r) => r.taskId !== id);
      saveLocalStore();
      return memoryStore.tasks.length < initial;
    },
  },

  // REMINDERS
  reminders: {
    async findForUser(userId: string): Promise<IReminder[]> {
      if (isConnectedToMongoDB) {
        const docs = await MongoReminderModel.find({ userId }).sort({ triggerTime: 1 }).lean();
        return docs as unknown as IReminder[];
      }
      return memoryStore.reminders
        .filter((r) => r.userId === userId)
        .sort((a, b) => new Date(a.triggerTime).getTime() - new Date(b.triggerTime).getTime());
    },

    async findByTaskId(taskId: string): Promise<IReminder[]> {
      if (isConnectedToMongoDB) {
        const docs = await MongoReminderModel.find({ taskId }).lean();
        return docs as unknown as IReminder[];
      }
      return memoryStore.reminders.filter((r) => r.taskId === taskId);
    },

    async create(reminderData: Partial<IReminder>): Promise<IReminder> {
      const now = new Date().toISOString();
      const reminder: IReminder = {
        _id: generateId(),
        taskId: reminderData.taskId || '',
        userId: reminderData.userId || '',
        triggerTime: reminderData.triggerTime || now,
        relativeMinutes: reminderData.relativeMinutes,
        type: reminderData.type || 'relative',
        status: reminderData.status || 'scheduled',
        title: reminderData.title || 'Task Reminder',
        createdAt: now,
      };

      if (isConnectedToMongoDB) {
        const created = await MongoReminderModel.create(reminder);
        return created.toObject() as unknown as IReminder;
      }

      memoryStore.reminders.push(reminder);
      saveLocalStore();
      return reminder;
    },

    async update(id: string, updates: Partial<IReminder>): Promise<IReminder | null> {
      if (isConnectedToMongoDB) {
        const updated = await MongoReminderModel.findByIdAndUpdate(id, updates, { new: true }).lean();
        return updated ? (updated as unknown as IReminder) : null;
      }

      const idx = memoryStore.reminders.findIndex((r) => r._id === id);
      if (idx === -1) return null;
      memoryStore.reminders[idx] = { ...memoryStore.reminders[idx], ...updates };
      saveLocalStore();
      return memoryStore.reminders[idx];
    },

    async delete(id: string): Promise<boolean> {
      if (isConnectedToMongoDB) {
        const res = await MongoReminderModel.findByIdAndDelete(id);
        return Boolean(res);
      }
      const initial = memoryStore.reminders.length;
      memoryStore.reminders = memoryStore.reminders.filter((r) => r._id !== id);
      saveLocalStore();
      return memoryStore.reminders.length < initial;
    },

    async findDueReminders(beforeTime: string): Promise<IReminder[]> {
      if (isConnectedToMongoDB) {
        const docs = await MongoReminderModel.find({
          status: 'scheduled',
          triggerTime: { $lte: beforeTime },
        }).lean();
        return docs as unknown as IReminder[];
      }
      const targetMs = new Date(beforeTime).getTime();
      return memoryStore.reminders.filter(
        (r) => r.status === 'scheduled' && new Date(r.triggerTime).getTime() <= targetMs
      );
    },
  },

  // NOTIFICATIONS
  notifications: {
    async findForUser(userId: string): Promise<INotification[]> {
      if (isConnectedToMongoDB) {
        const docs = await MongoNotificationModel.find({ userId }).sort({ createdAt: -1 }).lean();
        return docs as unknown as INotification[];
      }
      return memoryStore.notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async create(notifData: Partial<INotification>): Promise<INotification> {
      const notif: INotification = {
        _id: generateId(),
        userId: notifData.userId || '',
        title: notifData.title || '',
        message: notifData.message || '',
        type: notifData.type || 'system',
        refId: notifData.refId,
        read: notifData.read || false,
        createdAt: new Date().toISOString(),
      };

      if (isConnectedToMongoDB) {
        const created = await MongoNotificationModel.create(notif);
        return created.toObject() as unknown as INotification;
      }

      memoryStore.notifications.unshift(notif);
      saveLocalStore();
      return notif;
    },

    async markRead(id: string, userId: string): Promise<boolean> {
      if (isConnectedToMongoDB) {
        const res = await MongoNotificationModel.updateOne({ _id: id, userId }, { read: true });
        return res.modifiedCount > 0;
      }
      const notif = memoryStore.notifications.find((n) => n._id === id && n.userId === userId);
      if (notif) {
        notif.read = true;
        saveLocalStore();
        return true;
      }
      return false;
    },

    async markAllRead(userId: string): Promise<number> {
      if (isConnectedToMongoDB) {
        const res = await MongoNotificationModel.updateMany({ userId, read: false }, { read: true });
        return res.modifiedCount;
      }
      let count = 0;
      for (const n of memoryStore.notifications) {
        if (n.userId === userId && !n.read) {
          n.read = true;
          count++;
        }
      }
      saveLocalStore();
      return count;
    },
  },

  // INGESTIONS
  ingestions: {
    async findById(id: string): Promise<IIngestionRun | null> {
      if (isConnectedToMongoDB) {
        const doc = await MongoIngestionModel.findById(id).lean();
        return doc ? (doc as unknown as IIngestionRun) : null;
      }
      return memoryStore.ingestions.find((i) => i._id === id) || null;
    },

    async findForUser(userId: string): Promise<IIngestionRun[]> {
      if (isConnectedToMongoDB) {
        const docs = await MongoIngestionModel.find({ userId }).sort({ createdAt: -1 }).lean();
        return docs as unknown as IIngestionRun[];
      }
      return memoryStore.ingestions
        .filter((i) => i.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async create(ingestionData: Partial<IIngestionRun>): Promise<IIngestionRun> {
      const ingestion: IIngestionRun = {
        _id: generateId(),
        userId: ingestionData.userId || '',
        rawText: ingestionData.rawText || '',
        inputType: ingestionData.inputType || 'text',
        extractedSuggestions: ingestionData.extractedSuggestions || [],
        status: ingestionData.status || 'analyzed',
        confirmedTaskIds: ingestionData.confirmedTaskIds || [],
        createdAt: new Date().toISOString(),
      };

      if (isConnectedToMongoDB) {
        const created = await MongoIngestionModel.create(ingestion);
        return created.toObject() as unknown as IIngestionRun;
      }

      memoryStore.ingestions.unshift(ingestion);
      saveLocalStore();
      return ingestion;
    },

    async update(id: string, updates: Partial<IIngestionRun>): Promise<IIngestionRun | null> {
      if (isConnectedToMongoDB) {
        const updated = await MongoIngestionModel.findByIdAndUpdate(id, updates, { new: true }).lean();
        return updated ? (updated as unknown as IIngestionRun) : null;
      }

      const idx = memoryStore.ingestions.findIndex((i) => i._id === id);
      if (idx === -1) return null;
      memoryStore.ingestions[idx] = { ...memoryStore.ingestions[idx], ...updates };
      saveLocalStore();
      return memoryStore.ingestions[idx];
    },
  },

  // DELIVERY LOGS
  deliveryLogs: {
    async findForUser(userId: string): Promise<INotificationDeliveryLog[]> {
      if (isConnectedToMongoDB) {
        const docs = await MongoDeliveryLogModel.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
        return docs as unknown as INotificationDeliveryLog[];
      }
      return (memoryStore.deliveryLogs || [])
        .filter((d) => d.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50);
    },

    async create(logData: Partial<INotificationDeliveryLog>): Promise<INotificationDeliveryLog> {
      const log: INotificationDeliveryLog = {
        _id: generateId(),
        userId: logData.userId || '',
        taskId: logData.taskId,
        reminderId: logData.reminderId,
        channel: logData.channel || 'email',
        recipient: logData.recipient || '',
        status: logData.status || 'sent',
        subject: logData.subject,
        content: logData.content || '',
        error: logData.error,
        messageSid: logData.messageSid,
        createdAt: new Date().toISOString(),
      };

      if (isConnectedToMongoDB) {
        const created = await MongoDeliveryLogModel.create(log);
        return created.toObject() as unknown as INotificationDeliveryLog;
      }

      if (!memoryStore.deliveryLogs) memoryStore.deliveryLogs = [];
      memoryStore.deliveryLogs.unshift(log);
      saveLocalStore();
      return log;
    },
  },
};

// ==========================================
// 3. Database Initialization & Reconnection
// ==========================================

export async function tryConnectMongoDB(): Promise<{
  success: boolean;
  connectedToMongoDB: boolean;
  message: string;
  error: string | null;
}> {
  if (!config.mongoUri) {
    return {
      success: false,
      connectedToMongoDB: false,
      message: 'No MONGODB_URI environment variable provided. Operating via local persistent document store.',
      error: 'MONGODB_URI_MISSING',
    };
  }

  if (
    config.mongoUri.includes('<db_username>') ||
    config.mongoUri.includes('<db_password>') ||
    config.mongoUri.includes('<password>') ||
    config.mongoUri.includes('<username>')
  ) {
    const msg =
      'MONGODB_URI contains Atlas template placeholders (<db_username> or <db_password>). In AI Studio Settings, replace them with your actual Atlas Database User username and password created under MongoDB Atlas > Database Access.';
    mongoConnectionError = msg;
    return {
      success: false,
      connectedToMongoDB: false,
      message: msg,
      error: msg,
    };
  }

  try {
    // If currently connected or in progress, disconnect first cleanly
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }

    mongoose.set('bufferCommands', false);

    console.log('Connecting to MongoDB at:', config.mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@'));
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 6000,
    });

    isConnectedToMongoDB = true;
    mongoConnectionError = null;
    console.log('Successfully connected to MongoDB Atlas / Cluster via Mongoose!');

    // Ensure seed data exists in MongoDB cluster
    await seedInitialData();

    return {
      success: true,
      connectedToMongoDB: true,
      message: 'Successfully connected to live MongoDB Atlas cluster!',
      error: null,
    };
  } catch (err: any) {
    isConnectedToMongoDB = false;
    await mongoose.disconnect().catch(() => {});

    let friendly = err?.message || 'Failed to connect to MongoDB';
    if (friendly.toLowerCase().includes('bad auth') || friendly.toLowerCase().includes('authentication failed')) {
      friendly =
        'MongoDB Atlas Authentication failed (invalid credentials). Please check that your Atlas Database User username and password in MONGODB_URI are correct (MongoDB Atlas > Database Access).';
    } else if (
      friendly.includes('IP that isn\'t whitelisted') ||
      friendly.includes('whitelist') ||
      friendly.includes('ETIMEDOUT') ||
      friendly.includes('querySrv ENOTFOUND')
    ) {
      friendly =
        'MongoDB Atlas connection was blocked by Network Access IP whitelist. To allow access, visit MongoDB Atlas > Network Access > Add IP Address > "Allow Access from Anywhere" (0.0.0.0/0).';
    }

    mongoConnectionError = friendly;
    console.info('MongoDB cluster currently unreachable (%s); active on local persistent store.', friendly);

    return {
      success: false,
      connectedToMongoDB: false,
      message: friendly,
      error: friendly,
    };
  }
}

export async function initDatabase(): Promise<void> {
  loadLocalStore();

  // Ensure initial seed data exists in local store immediately for instant startup
  await seedInitialData();

  if (config.mongoUri) {
    // Connect to MongoDB Atlas asynchronously without delaying server boot
    tryConnectMongoDB().catch((err) => {
      console.info('Background MongoDB connection attempt resolved; running on resilient local store.');
    });
  } else {
    console.log('No MONGODB_URI configured. Running with local persistent document store.');
  }
}

export async function seedInitialData(force = false): Promise<void> {
  const existingUsers = await db.users.listAll();
  if (existingUsers.length > 0 && !force) {
    return;
  }

  console.log('Seeding initial TaskLens users, family group, and commitments...');

  // 1. Create demo users
  const demoHash = await bcrypt.hash('password123', 10);

  const alex = await db.users.create({
    name: 'Alex Rivera',
    email: 'alex@tasklens.io',
    passwordHash: demoHash,
    timeZone: 'America/Los_Angeles',
    locale: 'en-US',
  });

  const sarah = await db.users.create({
    name: 'Sarah Rivera',
    email: 'sarah@tasklens.io',
    passwordHash: demoHash,
    timeZone: 'America/Los_Angeles',
    locale: 'en-US',
  });

  const jordan = await db.users.create({
    name: 'Jordan Rivera (Kid)',
    email: 'jordan@tasklens.io',
    passwordHash: demoHash,
    timeZone: 'America/Los_Angeles',
    locale: 'en-US',
  });

  // 2. Create Family Group
  const familyGroup = await db.groups.create({
    name: 'Rivera Family',
    description: 'Shared household logistics, school forms, doctor appointments, and bills.',
    type: 'family',
    createdBy: alex._id,
    inviteCode: 'RIVERA26',
    members: [
      { userId: alex._id, role: 'admin', joinedAt: new Date().toISOString() },
      { userId: sarah._id, role: 'admin', joinedAt: new Date().toISOString() },
      { userId: jordan._id, role: 'member', joinedAt: new Date().toISOString() },
    ],
  });

  // 3. Create Sample Tasks extracted from real-world documents/messages
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);

  const task1 = await db.tasks.create({
    title: 'Submit Jordan School Science Fair Permission Slip',
    description: 'Signed PDF needs to be returned to Ms. Vance before Friday 3:00 PM.',
    priority: 'high',
    status: 'pending',
    dueDate: tomorrow.toISOString().split('T')[0],
    dueTime: '15:00',
    timeZone: 'America/Los_Angeles',
    createdBy: alex._id,
    assignedTo: sarah._id,
    groupId: familyGroup._id,
    sourceEvidence: {
      excerpt: 'Please return the signed permission slip for the Science Fair by Friday 3 PM at the latest.',
      confidence: 0.96,
      originalExpression: 'by Friday 3 PM',
    },
  });

  const task2 = await db.tasks.create({
    title: 'Pay Municipal Water Bill #98421 ($84.50)',
    description: 'Avoid late penalty charges before due date next week.',
    priority: 'medium',
    status: 'pending',
    dueDate: nextWeek.toISOString().split('T')[0],
    dueTime: '18:00',
    timeZone: 'America/Los_Angeles',
    createdBy: sarah._id,
    assignedTo: alex._id,
    groupId: familyGroup._id,
    sourceEvidence: {
      excerpt: 'Your total balance of $84.50 is due on September 17. Late fee will apply after this date.',
      confidence: 0.98,
      originalExpression: 'due on September 17',
    },
  });

  const task3 = await db.tasks.create({
    title: 'Dental Checkup for Jordan',
    description: 'Pediatric Dental Group - Clean and fluoridation check.',
    priority: 'low',
    status: 'completed',
    dueDate: today.toISOString().split('T')[0],
    dueTime: '10:30',
    timeZone: 'America/Los_Angeles',
    createdBy: alex._id,
    assignedTo: alex._id,
    groupId: familyGroup._id,
    completedAt: new Date().toISOString(),
  });

  // 4. Create Reminders
  await db.reminders.create({
    taskId: task1._id,
    userId: sarah._id,
    triggerTime: new Date(tomorrow.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    relativeMinutes: 120,
    type: 'relative',
    status: 'scheduled',
    title: 'Reminder: Jordan Science Fair Slip due in 2 hours',
  });

  await db.reminders.create({
    taskId: task2._id,
    userId: alex._id,
    triggerTime: new Date(nextWeek.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    relativeMinutes: 1440,
    type: 'relative',
    status: 'scheduled',
    title: 'Reminder: Water Bill due tomorrow ($84.50)',
  });

  // 5. Create In-app Notifications
  await db.notifications.create({
    userId: sarah._id,
    title: 'New Task Assigned',
    message: 'Alex assigned you: "Submit Jordan School Science Fair Permission Slip"',
    type: 'task_assigned',
    refId: task1._id,
    read: false,
  });

  await db.notifications.create({
    userId: alex._id,
    title: 'Welcome to TaskLens',
    message: 'TaskLens backend is active with Node.js and MongoDB data storage.',
    type: 'system',
    read: true,
  });

  console.log('Seeding completed successfully!');
}
