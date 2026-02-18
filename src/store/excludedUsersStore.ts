/**
 * Store for managing users excluded from planning email analytics.
 * These users won't be counted in "Tomorrow's Planning Status" dashboard stats.
 * 
 * Settings are now GLOBAL (stored server-side) and shared across all users.
 * Only users with admin/manager roles can modify excluded users.
 */
import { create } from 'zustand';

interface ExcludedUsersState {
  excludedUserIds: Set<number>; // Procore user IDs
  isLoading: boolean;
  excludeUser: (userId: number, userEmail: string) => Promise<void>;
  includeUser: (userId: number, userEmail: string) => Promise<void>;
  isExcluded: (userId: number) => boolean;
  getExcludedIds: () => number[];
  loadFromServer: () => Promise<void>;
}

export const useExcludedUsersStore = create<ExcludedUsersState>((set, get) => ({
  excludedUserIds: new Set<number>(),
  isLoading: false,

  excludeUser: async (userId: number, userEmail: string) => {
    const current = get().excludedUserIds;
    const newSet = new Set(current);
    newSet.add(userId);
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'excludedUserIds',
          value: JSON.stringify(Array.from(newSet)),
          userEmail,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update excluded users');
      }
      
      set({ excludedUserIds: newSet });
    } catch (err) {
      console.error('[ExcludedUsers] Failed to exclude user:', err);
      throw err;
    }
  },

  includeUser: async (userId: number, userEmail: string) => {
    const current = get().excludedUserIds;
    const newSet = new Set(current);
    newSet.delete(userId);
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'excludedUserIds',
          value: JSON.stringify(Array.from(newSet)),
          userEmail,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update excluded users');
      }
      
      set({ excludedUserIds: newSet });
    } catch (err) {
      console.error('[ExcludedUsers] Failed to include user:', err);
      throw err;
    }
  },

  isExcluded: (userId: number) => {
    return get().excludedUserIds.has(userId);
  },

  getExcludedIds: () => {
    return Array.from(get().excludedUserIds);
  },

  loadFromServer: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/settings/excludedUserIds');
      if (response.ok) {
        const data = await response.json();
        const ids = JSON.parse(data.value || '[]') as number[];
        set({ excludedUserIds: new Set(ids) });
      } else if (response.status === 404) {
        // Setting doesn't exist yet, use empty set
        set({ excludedUserIds: new Set() });
      }
    } catch (err) {
      console.error('[ExcludedUsers] Failed to load from server:', err);
    } finally {
      set({ isLoading: false });
    }
  },
}));
