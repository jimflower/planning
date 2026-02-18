/**
 * Store for managing users excluded from planning emails.
 * These users won't receive emails and won't be counted in dashboard analytics.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExcludedUsersState {
  excludedUserIds: Set<number>; // Procore user IDs
  excludeUser: (userId: number) => void;
  includeUser: (userId: number) => void;
  isExcluded: (userId: number) => boolean;
  getExcludedIds: () => number[];
}

export const useExcludedUsersStore = create<ExcludedUsersState>()(
  persist(
    (set, get) => ({
      excludedUserIds: new Set<number>(),

      excludeUser: (userId: number) => {
        set((state) => {
          const newSet = new Set(state.excludedUserIds);
          newSet.add(userId);
          return { excludedUserIds: newSet };
        });
      },

      includeUser: (userId: number) => {
        set((state) => {
          const newSet = new Set(state.excludedUserIds);
          newSet.delete(userId);
          return { excludedUserIds: newSet };
        });
      },

      isExcluded: (userId: number) => {
        return get().excludedUserIds.has(userId);
      },

      getExcludedIds: () => {
        return Array.from(get().excludedUserIds);
      },
    }),
    {
      name: 'excluded-users-storage',
      // Convert Set to Array for JSON storage
      partialize: (state) => ({
        excludedUserIds: Array.from(state.excludedUserIds),
      }),
      // Convert Array back to Set on load
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.excludedUserIds)) {
          state.excludedUserIds = new Set(state.excludedUserIds as unknown as number[]);
        }
      },
    },
  ),
);
