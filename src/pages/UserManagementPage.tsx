import React, { useState, useEffect } from 'react';
import { authService, type AuthUser } from '@/services/auth.service';
import { Users, Crown, Star, AlertCircle, Loader2, Save, Shield } from 'lucide-react';

interface UserRole {
  email: string;
  role: 'admin' | 'manager' | 'user';
  created_at: string;
  updated_at: string;
}

export default function UserManagementPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'manager' | 'user'>('user');
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'manager' | 'user'>('user');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Get current user
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      
      if (!user?.email) {
        setError('You must be signed in to access user management');
        setLoading(false);
        return;
      }

      // Get current user's role
      const roleResp = await fetch(`/api/user-role/${encodeURIComponent(user.email)}`);
      const roleData = await roleResp.json();
      setCurrentUserRole(roleData.role || 'user');

      // Only admins can access this page
      if (roleData.role !== 'admin') {
        setError('Admin access required');
        setLoading(false);
        return;
      }

      // Load all user roles
      const usersResp = await fetch(`/api/user-roles?userEmail=${encodeURIComponent(user.email)}`);
      if (usersResp.ok) {
        const usersData = await usersResp.json();
        setUsers(usersData);
      } else {
        const err = await usersResp.json();
        setError(err.error || 'Failed to load users');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (email: string, newRole: 'admin' | 'manager' | 'user') => {
    if (!currentUser?.email) return;
    
    setSaving(email);
    setError('');
    
    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: newRole,
          userEmail: currentUser.email,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update role');
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, role: newRole, updated_at: new Date().toISOString() } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setSaving(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.email || !newUserEmail.trim()) return;

    setSaving('new');
    setError('');

    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail.trim().toLowerCase(),
          role: newUserRole,
          userEmail: currentUser.email,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add user');
      }

      // Reload users
      await loadData();
      setNewUserEmail('');
      setNewUserRole('user');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setSaving(null);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-4 w-4" />;
      case 'manager':
        return <Star className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </main>
    );
  }

  if (currentUserRole !== 'admin') {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/30">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
            <div>
              <h2 className="text-lg font-semibold text-red-900 dark:text-red-200">Access Denied</h2>
              <p className="text-sm text-red-700 dark:text-red-300">
                Admin access is required to manage user roles.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <Shield className="h-7 w-7" />
          User Management
        </h1>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Add New User */}
      <div className="section-card mb-6 p-4">
        <h2 className="section-header">Add User Role</h2>
        <form onSubmit={handleAddUser} className="mt-4">
          <div className="flex gap-3">
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="user@gnbenergy.com.au"
              className="input-field flex-1"
              required
              disabled={saving === 'new'}
            />
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'manager' | 'user')}
              className="input-field w-32"
              disabled={saving === 'new'}
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={saving === 'new'}
              className="btn-primary flex items-center gap-2"
            >
              {saving === 'new' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Add User
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Add a user's email and assign their role. They'll see the role on their next page visit.
          </p>
        </form>
      </div>

      {/* User List */}
      <div className="section-card p-4">
        <h2 className="section-header">All Users ({users.length})</h2>
        <div className="mt-4 space-y-3">
          {users.length === 0 ? (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">No users found</p>
          ) : (
            users.map((user) => (
              <div
                key={user.email}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{user.email}</span>
                    {user.email === currentUser?.email && (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Added: {new Date(user.created_at).toLocaleDateString()} • Updated:{' '}
                    {new Date(user.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(user.role)}`}>
                    {getRoleIcon(user.role)}
                    <span className="capitalize">{user.role}</span>
                  </span>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.email, e.target.value as 'admin' | 'manager' | 'user')}
                    disabled={saving === user.email || user.email === currentUser?.email}
                    className="input-field text-sm py-1"
                    title={user.email === currentUser?.email ? "You can't change your own role" : 'Change role'}
                  >
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  {saving === user.email && <Loader2 className="h-4 w-4 animate-spin text-primary-600" />}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Role Descriptions */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/30">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-200">
          <Users className="h-4 w-4" />
          Role Permissions
        </h3>
        <div className="space-y-2 text-xs text-blue-800 dark:text-blue-300">
          <div className="flex items-start gap-2">
            <Crown className="h-4 w-4 flex-shrink-0 text-purple-600 dark:text-purple-400" />
            <div>
              <span className="font-semibold">Admin:</span> Full access to all settings, user management, and can
              modify global configurations
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Star className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <span className="font-semibold">Manager:</span> Can modify global settings like excluded users for
              analytics
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
            <div>
              <span className="font-semibold">User:</span> Read-only access, can create and send planning emails
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
