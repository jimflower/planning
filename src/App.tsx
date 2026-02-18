import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { Header } from '@/components/common/Header';
import { OfflineIndicator } from '@/components/common/OfflineIndicator';
import { useSettingsStore } from '@/store/settingsStore';
import { usePlanningStore } from '@/store/planningStore';
import { graphScopes } from '@/config/msalConfig';
import { ClipboardList, LogIn, Loader2 } from 'lucide-react';
import { procoreService } from '@/services/procore.service';
import HomePage from '@/pages/HomePage';
import DashboardPage from '@/pages/DashboardPage';
import HistoryPage from '@/pages/HistoryPage';
import EmailHistoryPage from '@/pages/EmailHistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import ProcoreCallbackPage from '@/pages/ProcoreCallbackPage';

export default function App() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const loadFromApi = usePlanningStore((s) => s.loadFromApi);
  const isAuthenticated = useIsAuthenticated();
  const { instance, inProgress } = useMsal();

  // On startup, sync with the API server (if running)
  useEffect(() => {
    if (isAuthenticated) {
      loadFromApi();
      // Sync Procore tokens to the server (if user has them in localStorage)
      procoreService.syncCredentials();
    }
  }, [loadFromApi, isAuthenticated]);

  const handleLogin = () => {
    instance.loginPopup({ scopes: graphScopes }).catch((err) => {
      console.error('Login failed:', err);
    });
  };

  // Show loading while MSAL is processing
  if (inProgress !== InteractionStatus.None) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Signing in…</p>
          </div>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
            {/* Logo */}
            <div className="mb-6 flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500 text-white">
                <ClipboardList className="h-8 w-8" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Daily Planning Hub
              </h1>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Sign in with your GNB Energy Microsoft account to access the planning system.
              </p>
            </div>

            {/* Sign in button */}
            <button
              onClick={handleLogin}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-base"
            >
              <LogIn className="h-5 w-5" />
              Sign in with Microsoft
            </button>

            <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
              planning.roseconnections.com.au
            </p>
          </div>
        </div>
      </div>
    );
  }

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
