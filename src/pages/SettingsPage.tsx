import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { procoreService } from '@/services/procore.service';
import { authService, type AuthUser } from '@/services/auth.service';
import { Plug, Unplug, LogIn, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const {
    companyName, setCompanyName,
    defaultStartTime, setDefaultStartTime,
    defaultCrewCount, setDefaultCrewCount,
  } = useSettingsStore();

  const procoreConfigured = procoreService.isConfigured();
  const [procoreConnected, setProcoreConnected] = useState(procoreService.isAuthenticated());

  const msalConfigured = authService.isConfigured();
  const [msalUser, setMsalUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    authService.getCurrentUser().then(setMsalUser);
  }, []);

  const handleConnectProcore = () => {
    procoreService.startOAuthFlow();
  };

  const handleDisconnectProcore = () => {
    if (confirm('Disconnect from Procore? Cached crew and equipment data will be cleared.')) {
      procoreService.disconnect();
      setProcoreConnected(false);
    }
  };

  const handleMsalSignIn = async () => {
    try {
      const u = await authService.signIn();
      setMsalUser(u);
    } catch (err) {
      console.error('Microsoft sign-in failed:', err);
    }
  };

  const handleMsalSignOut = async () => {
    await authService.signOut();
    setMsalUser(null);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <div className="space-y-6">
        {/* General */}
        <div className="section-card p-4">
          <h2 className="section-header">General</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Default Start Time
                </label>
                <input
                  type="time"
                  value={defaultStartTime}
                  onChange={(e) => setDefaultStartTime(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Default Crew Rows
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={defaultCrewCount}
                  onChange={(e) => setDefaultCrewCount(Number(e.target.value))}
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="section-card p-4">
          <h2 className="section-header">Integrations</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Microsoft 365 (Email)</span>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    msalUser
                      ? 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300'
                      : msalConfigured
                        ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {msalUser ? `Signed in (${msalUser.email})` : msalConfigured ? 'Not signed in' : 'Not configured'}
                </span>
                {msalConfigured && !msalUser && (
                  <button onClick={handleMsalSignIn} className="btn-primary flex items-center gap-1 text-xs">
                    <LogIn className="h-3 w-3" /> Sign in
                  </button>
                )}
                {msalUser && (
                  <button onClick={handleMsalSignOut} className="btn-danger flex items-center gap-1 text-xs">
                    <LogOut className="h-3 w-3" /> Sign out
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Procore</span>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    procoreConnected
                      ? 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300'
                      : procoreConfigured
                        ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {procoreConnected ? 'Connected' : procoreConfigured ? 'Not connected' : 'Not configured'}
                </span>
                {procoreConfigured && !procoreConnected && (
                  <button onClick={handleConnectProcore} className="btn-primary flex items-center gap-1 text-xs">
                    <Plug className="h-3 w-3" /> Connect
                  </button>
                )}
                {procoreConnected && (
                  <button onClick={handleDisconnectProcore} className="btn-danger flex items-center gap-1 text-xs">
                    <Unplug className="h-3 w-3" /> Disconnect
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {procoreConfigured
                ? procoreConnected
                  ? 'Procore is connected. Crew names and equipment will auto-populate.'
                  : 'Procore is configured. Click Connect to authorise.'
                : <>Add API credentials in your <code>.env</code> file. See <code>.env.example</code>.</>}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
