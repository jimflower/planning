import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  darkMode: boolean;
  toggleDarkMode: () => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  defaultStartTime: string;
  setDefaultStartTime: (v: string) => void;
  defaultCrewCount: number;
  setDefaultCrewCount: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: false,
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      companyName: 'GNB Energy',
      setCompanyName: (v) => set({ companyName: v }),
      defaultStartTime: '06:30',
      setDefaultStartTime: (v) => set({ defaultStartTime: v }),
      defaultCrewCount: 10,
      setDefaultCrewCount: (v) => set({ defaultCrewCount: v }),
    }),
    { name: 'dph-settings' },
  ),
);
