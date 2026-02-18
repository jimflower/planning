import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from '@/components/common/Header';
import { OfflineIndicator } from '@/components/common/OfflineIndicator';
import { useSettingsStore } from '@/store/settingsStore';
import { usePlanningStore } from '@/store/planningStore';
import HomePage from '@/pages/HomePage';
import DashboardPage from '@/pages/DashboardPage';
import HistoryPage from '@/pages/HistoryPage';
import EmailHistoryPage from '@/pages/EmailHistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import ProcoreCallbackPage from '@/pages/ProcoreCallbackPage';

export default function App() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const loadFromApi = usePlanningStore((s) => s.loadFromApi);

  // On startup, sync with the API server (if running)
  useEffect(() => {
    loadFromApi();
  }, [loadFromApi]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/email-history" element={<EmailHistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/procore/callback" element={<ProcoreCallbackPage />} />
        </Routes>
        <OfflineIndicator />
      </div>
    </div>
  );
}
