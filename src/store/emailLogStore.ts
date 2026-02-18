/**
 * Email log store - now synced with server database.
 * Email logs are global and shared across all users.
 */
import { create } from 'zustand';
import type { EmailLogEntry } from '@/types/email.types';

interface EmailLogState {
  logs: EmailLogEntry[];
  isLoading: boolean;
  addLog: (entry: EmailLogEntry) => Promise<void>;
  loadFromServer: () => Promise<void>;
  clearLogs: () => void;
}

export const useEmailLogStore = create<EmailLogState>((set, get) => ({
  logs: [],
  isLoading: false,

  addLog: async (entry) => {
    try {
      // Save to server
      const response = await fetch('/api/email-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          plan_id: entry.planId,
          date: entry.date,
          sent_at: entry.sentAt,
          subject: entry.subject,
          to_recipients: JSON.stringify(entry.toRecipients),
          cc_recipients: JSON.stringify(entry.ccRecipients),
          project_number: entry.projectNumber || '',
          subjob_code: entry.subjobCode || '',
          client: entry.client || '',
          location: entry.location || '',
          crew_count: entry.crewCount || 0,
          sent_by: entry.sentBy || '',
          status: entry.status,
          error: entry.error || null,
          recipient_user_ids: JSON.stringify(entry.recipientUserIds || []),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save email log to server');
      }

      // Update local state
      set((s) => ({
        logs: [entry, ...s.logs],
      }));
    } catch (err) {
      console.error('[EmailLog] Failed to save to server:', err);
      // Still update local state even if server save fails
      set((s) => ({
        logs: [entry, ...s.logs],
      }));
    }
  },

  loadFromServer: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/email-logs');
      if (response.ok) {
        const serverLogs = await response.json();
        
        // Convert server format to client format
        const logs: EmailLogEntry[] = serverLogs.map((log: any) => ({
          id: log.id,
          planId: log.plan_id,
          date: log.date,
          sentAt: log.sent_at,
          subject: log.subject,
          toRecipients: JSON.parse(log.to_recipients || '[]'),
          ccRecipients: JSON.parse(log.cc_recipients || '[]'),
          projectNumber: log.project_number,
          subjobCode: log.subjob_code,
          client: log.client,
          location: log.location,
          crewCount: log.crew_count,
          sentBy: log.sent_by,
          status: log.status,
          error: log.error,
          recipientUserIds: JSON.parse(log.recipient_user_ids || '[]'),
        }));

        set({ logs });
      }
    } catch (err) {
      console.error('[EmailLog] Failed to load from server:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  clearLogs: () => set({ logs: [] }),
}));
