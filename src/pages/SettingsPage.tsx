import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useExcludedUsersStore } from '@/store/excludedUsersStore';
import { procoreService } from '@/services/procore.service';
import { authService, type AuthUser } from '@/services/auth.service';
import { Plug, Unplug, LogIn, LogOut, Users, Loader2 } from 'lucide-react';
import type { ProcoreUser } from '@/types/procore.types';

export default function SettingsPage() {
  const {
    companyName, setCompanyName,
    defaultStartTime, setDefaultStartTime,
    defaultCrewCount, setDefaultCrewCount,
  } = useSettingsStore();

  const { excludedUserIds, excludeUser, includeUser, loadFromServer } = useExcludedUsersStore();

  const procoreConfigured = procoreService.isConfigured();
  const [procoreConnected, setProcoreConnected] = useState(procoreService.isAuthenticated());

  const msalConfigured = authService.isConfigured();
  const [msalUser, setMsalUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'user'>('user');

  // Procore users for exclusion settings
  const [procoreUsers, setProcoreUsers] = useState<ProcoreUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingExclusion, setSavingExclusion] = useState(false);

  useEffect(() => {
    authService.getCurrentUser().then((user) => {
      setMsalUser(user);
      // Fetch user role from server
      if (user?.email) {
        console.log('[Settings] Fetching role for:', user.email);
        fetch(`/api/user-role/${encodeURIComponent(user.email)}`)
          .then((res) => res.json())
          .then((data) => {
            console.log('[Settings] Role fetched:', data);
            setUserRole(data.role || 'user');
          })
          .catch((err) => {
            console.error('[Settings] Failed to fetch role:', err);
            setUserRole('user');
          });
      }
    });
    // Load excluded users from server
    loadFromServer();
  }, [loadFromServer]);

  useEffect(() => {
    if (procoreConnected) {
      setLoadingUsers(true);
      procoreService.getCompanyUsers()
        .then((all) => {
          // Filter to only GNB Energy employees (same filter as crew dropdowns)
          const employees = all.filter((u) =>
            u.is_employee !== false &&
            (!u.vendor || /gnb energy/i.test(u.vendor.name)),
          );
          setProcoreUsers(employees);
          setLoadingUsers(false);
        })
        .catch(() => setLoadingUsers(false));
    }
  }, [procoreConnected]);

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

      {/* User Info Banner */}
      {msalUser && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                Signed in as: {msalUser.displayName}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">{msalUser.email}</p>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
              userRole === 'admin' 
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200'
                : userRole === 'manager'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
            }`}>
              {userRole === 'admin' && '👑 '}
              {userRole === 'manager' && '⭐ '}
              Role: <span className="capitalize">{userRole}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
            💡 Global settings like excluded users are shared across all users.
            {userRole === 'user' && ' Contact an admin to change your role.'}
            {userRole === 'manager' && ' You can modify global settings.'}
            {userRole === 'admin' && ' You have full administrative access.'}
          </p>
        </div>
      )}

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

        {/* Email Analytics Settings - Admin/Manager Only */}
        {procoreConnected && (userRole === 'admin' || userRole === 'manager') && (
          <div className="section-card p-4">
            <h2 className="section-header flex items-center gap-2">
              <Users className="h-5 w-5" />
              Email Analytics Settings
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Exclude users from the "Tomorrow's Planning Status" analytics on the Dashboard. Excluded users won't be counted in the "Not yet notified" total.
              <span className="ml-1 font-semibold text-purple-600 dark:text-purple-400">
                (Global setting - affects all users)
              </span>
            </p>
            <div className="mt-4">
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading users...
                </div>
              ) : procoreUsers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No users found.</p>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto rounded border border-gray-200 p-3 dark:border-gray-700">
                  {procoreUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={excludedUserIds.has(user.id)}
                        disabled={savingExclusion}
                        onChange={async (e) => {
                          if (!msalUser?.email) return;
                          setSavingExclusion(true);
                          try {
                            if (e.target.checked) {
                              await excludeUser(user.id, msalUser.email);
                            } else {
                              await includeUser(user.id, msalUser.email);
                            }
                          } catch (err) {
                            alert('Failed to update user exclusion. You may not have permission.');
                          } finally {
                            setSavingExclusion(false);
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-primary-600"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {user.email_address}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {excludedUserIds.size > 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {excludedUserIds.size} {excludedUserIds.size === 1 ? 'user' : 'users'} excluded from analytics
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
