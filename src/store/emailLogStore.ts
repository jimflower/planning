import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EmailLogEntry } from '@/types/email.types';

interface EmailLogState {
  logs: EmailLogEntry[];
  addLog: (entry: EmailLogEntry) => void;
  clearLogs: () => void;
}

export const useEmailLogStore = create<EmailLogState>()(
  persist(
    (set) => ({
      logs: [],

      addLog: (entry) =>
        set((s) => ({
          logs: [entry, ...s.logs],
        })),

      clearLogs: () => set({ logs: [] }),
    }),
    { name: 'email-log' },
  ),
);
