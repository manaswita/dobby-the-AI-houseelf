import { NotificationDeliveryLog, ChannelsStatus } from './types';

const TOKEN_KEY = 'tasklens_jwt_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }

  return data as T;
}

export const api = {
  getToken: getAuthToken,
  setToken: setAuthToken,
  clearToken: clearAuthToken,
  request,

  // Auth
  login(email: string, password: string) {
    return request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register(name: string, email: string, password: string, timeZone?: string, phoneNumber?: string) {
    return request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, timeZone, phoneNumber }),
    });
  },

  getMe() {
    return request<{ user: any }>('/api/auth/me');
  },

  updateProfile(updates: any) {
    return request<{ user: any }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  getUsers() {
    return request<{ users: any[] }>('/api/auth/users');
  },

  // Groups
  getGroups() {
    return request<{ groups: any[] }>('/api/groups');
  },

  getAvailableUsers() {
    return request<{ users: { _id: string; name: string; email: string; phoneNumber?: string; timeZone?: string }[] }>('/api/groups/available-users');
  },

  createGroup(name: string, description: string, type: string) {
    return request<{ group: any }>('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description, type }),
    });
  },

  updateGroup(groupId: string, data: { name?: string; description?: string; type?: string }) {
    return request<{ message: string; group: any }>(`/api/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  joinGroup(inviteCode: string) {
    return request<{ message: string; group: any }>('/api/groups/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    });
  },

  addMember(groupId: string, data: { userId?: string; email?: string; role?: 'admin' | 'member' }) {
    return request<{ message: string; group: any }>(`/api/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  removeMember(groupId: string, memberId: string) {
    return request<{ message: string; group: any }>(`/api/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
    });
  },

  // Family & Group Chat
  getMessages(groupId: string) {
    return request<{ messages: any[] }>(`/api/groups/${groupId}/messages`);
  },

  sendMessage(groupId: string, content: string, askElf?: boolean) {
    return request<{ message: string; userMessage: any; elfMessage?: any; messages: any[] }>(`/api/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, askElf }),
    });
  },

  deleteMessage(groupId: string, messageId: string) {
    return request<{ message: string }>(`/api/groups/${groupId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  // Tasks
  getTasks(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ tasks: any[]; count: number }>('/api/tasks' + query);
  },

  createTask(taskData: any) {
    return request<{ task: any; reminders: any[] }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  },

  updateTask(id: string, updates: any) {
    return request<{ task: any }>(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  toggleCompleteTask(id: string) {
    return request<{ task: any }>(`/api/tasks/${id}/complete`, {
      method: 'POST',
    });
  },

  deleteTask(id: string) {
    return request<{ message: string }>(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  // Reminders
  getReminders() {
    return request<{ reminders: any[] }>('/api/reminders');
  },

  createTaskReminder(
    taskId: string,
    data: {
      amount?: number;
      unit?: 'hours' | 'days' | 'minutes';
      triggerTime?: string;
      title?: string;
      targetDueDate?: string;
      targetDueTime?: string;
    }
  ) {
    return request<{ reminder: any; task?: any }>(`/api/tasks/${taskId}/reminders`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  snoozeReminder(id: string, minutes: number = 15) {
    return request<{ reminder: any }>(`/api/reminders/${id}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    });
  },

  dismissReminder(id: string) {
    return request<{ reminder: any }>(`/api/reminders/${id}/dismiss`, {
      method: 'POST',
    });
  },

  deleteReminder(id: string) {
    return request<{ message: string }>(`/api/reminders/${id}`, {
      method: 'DELETE',
    });
  },

  // Notifications
  getNotifications() {
    return request<{ notifications: any[]; unreadCount: number }>('/api/notifications');
  },

  markNotificationRead(id: string) {
    return request<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: 'PUT',
    });
  },

  markAllNotificationsRead() {
    return request<{ modifiedCount: number }>('/api/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  // Channels & External Alerts
  getChannelsStatus() {
    return request<ChannelsStatus>('/api/notifications/channels-status');
  },

  getDeliveryLogs() {
    return request<{ logs: NotificationDeliveryLog[] }>('/api/notifications/delivery-logs');
  },

  updateNotificationSettings(settings: {
    whatsapp?: boolean;
    inApp?: boolean;
    whatsappPhone?: string;
    phoneNumber?: string;
    notifyOnAssigned?: boolean;
    notifyOnReminder?: boolean;
    notifyOnDailyDigest?: boolean;
  }) {
    return request<{ message: string; notificationPrefs: any; user: any }>('/api/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  sendTestWhatsApp(targetPhone?: string) {
    return request<{ message: string; result: any; waLink?: string }>('/api/notifications/test-whatsapp', {
      method: 'POST',
      body: JSON.stringify({ targetPhone }),
    });
  },

  triggerReminderNow(reminderId: string) {
    return request<{ message: string; dispatch: any }>(`/api/reminders/${reminderId}/trigger-now`, {
      method: 'POST',
    });
  },

  checkDueReminders() {
    return request<{ message: string; checkedCount: number; firedCount: number; results: any[] }>('/api/reminders/check-due', {
      method: 'POST',
    });
  },

  // Ingestion & AI
  analyzeContent(
    payload:
      | {
          text?: string;
          file?: File;
          files?: File[];
          fileBase64?: string;
          fileName?: string;
          fileMimeType?: string;
          inputType?: string;
          groupId?: string;
        }
      | string,
    inputType: string = 'text',
    groupId?: string
  ) {
    if (typeof payload === 'string') {
      return request<{
        ingestionId: string;
        status: string;
        suggestionsCount: number;
        suggestions: any[];
        availableMembers: any[];
        engine?: string;
        notice?: string;
        detectedInputType?: string;
        fileName?: string;
        fileNames?: string[];
        filesCount?: number;
        extractedTextPreview?: string;
      }>('/api/ingest/analyze', {
        method: 'POST',
        body: JSON.stringify({ text: payload, inputType, groupId }),
      });
    }

    // If native File instances are attached, submit via multipart FormData
    const hasFiles = Boolean(
      (payload.files && payload.files.length > 0) || payload.file
    );

    if (hasFiles) {
      const formData = new FormData();

      if (payload.files && payload.files.length > 0) {
        for (const f of payload.files) {
          formData.append('files', f);
        }
      } else if (payload.file) {
        formData.append('file', payload.file);
      }

      if (payload.text) formData.append('text', payload.text);
      if (payload.inputType) formData.append('inputType', payload.inputType);
      if (payload.groupId) formData.append('groupId', payload.groupId);

      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      return fetch('/api/ingest/analyze', {
        method: 'POST',
        headers,
        body: formData,
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
        return data as {
          ingestionId: string;
          status: string;
          suggestionsCount: number;
          suggestions: any[];
          availableMembers: any[];
          engine?: string;
          notice?: string;
          detectedInputType?: string;
          fileName?: string;
          fileNames?: string[];
          filesCount?: number;
          extractedTextPreview?: string;
        };
      });
    }

    return request<{
      ingestionId: string;
      status: string;
      suggestionsCount: number;
      suggestions: any[];
      availableMembers: any[];
      engine?: string;
      notice?: string;
      detectedInputType?: string;
      fileName?: string;
      fileNames?: string[];
      filesCount?: number;
      extractedTextPreview?: string;
    }>('/api/ingest/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  confirmTasks(ingestionId: string, confirmedTasks: any[], groupId?: string) {
    return request<{ message: string; tasks: any[]; reminders: any[] }>('/api/ingest/confirm', {
      method: 'POST',
      body: JSON.stringify({ ingestionId, confirmedTasks, groupId }),
    });
  },

  // System
  getHealth() {
    return request<any>('/api/system/health');
  },

  reconnectDb() {
    return request<{
      success: boolean;
      connectedToMongoDB: boolean;
      message: string;
      error: string | null;
      database?: any;
    }>('/api/system/reconnect-db', {
      method: 'POST',
    });
  },

  seedData() {
    return request<any>('/api/system/seed', {
      method: 'POST',
    });
  },

  getEndpoints() {
    return request<any>('/api/system/endpoints');
  },
};
