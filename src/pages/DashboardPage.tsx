import React, { useEffect, useState } from 'react';
import { useEmailLogStore } from '@/store/emailLogStore';
import { usePlanningStore } from '@/store/planningStore';
import { useExcludedUsersStore } from '@/store/excludedUsersStore';
import { procoreService } from '@/services/procore.service';
import { Mail, Send, AlertTriangle, ClipboardList, Users, FolderOpen, Clock, CheckCircle2, XCircle, Trash2, Loader2, UserCheck, UserX } from 'lucide-react';

function formatDDMMYYYY(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return iso;
  }
}

export default function DashboardPage() {
  const { logs, loadFromServer } = useEmailLogStore();
  const history = usePlanningStore((s) => s.history);
  const { excludedUserIds, loadFromServer: loadExcludedUsers } = useExcludedUsersStore();

  // Procore users directory
  const [procoreUsers, setProcoreUsers] = useState<Array<{ id: number; name: string; email_address: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    // Load excluded users from server
    loadExcludedUsers();
    // Load email logs from server
    loadFromServer();
    
    if (procoreService.isAuthenticated()) {
      procoreService.getCompanyUsers().then((all) => {
        // Filter to GNB Energy employees only
        const employees = all.filter((u) =>
          u.is_employee === true &&
          (!u.vendor || /gnb/i.test(u.vendor.name))
        );
        console.log(`[Dashboard] Filtered ${all.length} users to ${employees.length} GNB employees`);
        setProcoreUsers(employees);
        setLoadingUsers(false);
      }).catch(() => setLoadingUsers(false));
    } else {
      setLoadingUsers(false);
    }
  }, [loadFromServer, loadExcludedUsers]);

  // Pending Procore notes
  interface PendingNote {
    id: number;
    plan_id: string;
    project_id: number;
    scheduled_date: string;
    subject: string;
    status: 'pending' | 'posted' | 'failed';
    created_at: string;
    posted_at: string | null;
    error: string | null;
  }
  const [pendingNotes, setPendingNotes] = useState<PendingNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchPendingNotes = async () => {
    try {
      const resp = await fetch('/api/pending-notes');
      if (resp.ok) setPendingNotes(await resp.json());
    } catch {
      // silent — server may be offline
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    fetchPendingNotes();
    // Refresh every 60 s
    const iv = setInterval(fetchPendingNotes, 60_000);
    return () => clearInterval(iv);
  }, []);

  const handleDeleteNote = async (id: number) => {
    setDeletingId(id);
    try {
      const resp = await fetch(`/api/pending-notes/${id}`, { method: 'DELETE' });
      if (resp.ok) setPendingNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  const totalSent = logs.filter((l) => l.status === 'sent').length;
  const totalFailed = logs.filter((l) => l.status === 'failed').length;
  const totalPlans = history.length;

  // Unique projects sent to
  const uniqueProjects = new Set(
    logs.filter((l) => l.status === 'sent' && l.projectNumber).map((l) => l.projectNumber),
  );

  // Emails by project
  const byProject = new Map<string, number>();
  logs
    .filter((l) => l.status === 'sent' && l.projectNumber)
    .forEach((l) => {
      byProject.set(l.projectNumber, (byProject.get(l.projectNumber) ?? 0) + 1);
    });
  const projectBreakdown = [...byProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Recent sends (last 10)
  const recentSends = logs.filter((l) => l.status === 'sent').slice(0, 10);

  // Total unique crew across all sent plans
  const totalCrew = logs
    .filter((l) => l.status === 'sent')
    .reduce((sum, l) => sum + l.crewCount, 0);

  // Today's email analytics
  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

  // Find emails sent for today's date
  const todayEmails = logs.filter((l) => l.status === 'sent' && l.date.startsWith(todayDateStr));
  
  // Get all user IDs who received today's emails
  const recipientIdsForToday = new Set<number>();
  todayEmails.forEach((email) => {
    email.recipientUserIds?.forEach((id) => recipientIdsForToday.add(id));
  });

  // Tomorrow's email analytics
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

  // Find emails sent for tomorrow's date
  const tomorrowEmails = logs.filter((l) => l.status === 'sent' && l.date.startsWith(tomorrowDateStr));
  
  // Get all user IDs who received tomorrow's emails
  const recipientIdsForTomorrow = new Set<number>();
  tomorrowEmails.forEach((email) => {
    email.recipientUserIds?.forEach((id) => recipientIdsForTomorrow.add(id));
  });

  // Filter out excluded users from directory
  const activeUsers = procoreUsers.filter((u) => !excludedUserIds.has(u.id));
  
  // Count users who received vs didn't receive emails for today
  const todayUsersWithEmail = activeUsers.filter((u) => recipientIdsForToday.has(u.id)).length;
  const todayUsersWithoutEmail = activeUsers.length - todayUsersWithEmail;

  // Count users who received vs didn't receive emails for tomorrow
  const tomorrowUsersWithEmail = activeUsers.filter((u) => recipientIdsForTomorrow.has(u.id)).length;
  const tomorrowUsersWithoutEmail = activeUsers.length - tomorrowUsersWithEmail;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          icon={<ClipboardList className="h-6 w-6" />}
          label="Total Plans"
          value={totalPlans}
          colour="primary"
        />
        <StatCard
          icon={<Send className="h-6 w-6" />}
          label="Emails Sent"
          value={totalSent}
          colour="success"
        />
        <StatCard
          icon={<AlertTriangle className="h-6 w-6" />}
          label="Failed"
          value={totalFailed}
          colour="danger"
        />
        <StatCard
          icon={<FolderOpen className="h-6 w-6" />}
          label="Projects"
          value={uniqueProjects.size}
          colour="secondary"
        />
        <StatCard
          icon={<Clock className="h-6 w-6" />}
          label="Scheduled"
          value={pendingNotes.filter((n) => n.status === 'pending').length}
          colour="primary"
        />
      </div>

      {/* Today's Email Analytics */}
      {procoreService.isAuthenticated() && !loadingUsers && activeUsers.length > 0 && (
        <div className="mb-8 section-card">
          <div className="section-header">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Today's Planning Status ({todayDateStr})
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4">
            <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{todayUsersWithEmail}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Users notified</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-orange-50 p-4 dark:bg-orange-900/20">
              <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
                <UserX className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{todayUsersWithoutEmail}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Not yet notified</p>
              </div>
            </div>
          </div>
          {todayUsersWithoutEmail > 0 && (
            <div className="border-t px-4 py-3 dark:border-gray-700">
              <p className="text-xs text-gray-500">
                {todayUsersWithoutEmail} active user{todayUsersWithoutEmail > 1 ? 's' : ''} in the directory {todayUsersWithoutEmail > 1 ? 'have' : 'has'} not received planning emails for today yet.
                {excludedUserIds.size > 0 && ` (${excludedUserIds.size} user${excludedUserIds.size > 1 ? 's' : ''} excluded from counts)`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tomorrow's Email Analytics */}
      {procoreService.isAuthenticated() && !loadingUsers && activeUsers.length > 0 && (
        <div className="mb-8 section-card">
          <div className="section-header">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Tomorrow's Planning Status ({tomorrowDateStr})
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4">
            <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{tomorrowUsersWithEmail}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Users notified</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-orange-50 p-4 dark:bg-orange-900/20">
              <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
                <UserX className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{tomorrowUsersWithoutEmail}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Not yet notified</p>
              </div>
            </div>
          </div>
          {tomorrowUsersWithoutEmail > 0 && (
            <div className="border-t px-4 py-3 dark:border-gray-700">
              <p className="text-xs text-gray-500">
                {tomorrowUsersWithoutEmail} active user{tomorrowUsersWithoutEmail > 1 ? 's' : ''} in the directory {tomorrowUsersWithoutEmail > 1 ? 'have' : 'has'} not received planning emails for tomorrow yet.
                {excludedUserIds.size > 0 && ` (${excludedUserIds.size} user${excludedUserIds.size > 1 ? 's' : ''} excluded from counts)`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Scheduled Procore Updates */}
      <div className="mb-8 section-card">
        <div className="section-header">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <Clock className="h-4 w-4 text-primary-500" />
            Scheduled Procore Updates
          </h2>
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {pendingNotes.filter((n) => n.status === 'pending').length} pending
          </span>
        </div>

        {loadingNotes ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : pendingNotes.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No scheduled Procore updates.</p>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {pendingNotes.map((note) => (
              <div key={note.id} className="flex items-center gap-3 px-4 py-3">
                {/* Status icon */}
                {note.status === 'pending' && (
                  <Clock className="h-4 w-4 shrink-0 text-blue-500" />
                )}
                {note.status === 'posted' && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                )}
                {note.status === 'failed' && (
                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                )}

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {note.subject || `Plan ${note.plan_id.slice(0, 8)}…`}
                  </p>
                  <p className="text-xs text-gray-500">
                    Scheduled for {formatDDMMYYYY(note.scheduled_date)}
                    {note.posted_at && ` · Posted ${formatDDMMYYYY(note.posted_at)}`}
                    {note.error && ` · Error: ${note.error}`}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    note.status === 'pending'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : note.status === 'posted'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  {note.status}
                </span>

                {/* Delete button (only for pending) */}
                {note.status === 'pending' && (
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    disabled={deletingId === note.id}
                    className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    title="Cancel scheduled update"
                  >
                    {deletingId === note.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Emails by Project */}
        <div className="section-card">
          <div className="section-header">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Emails by Project
            </h2>
          </div>
          <div className="p-4">
            {projectBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500">No emails sent yet.</p>
            ) : (
              <div className="space-y-3">
                {projectBreakdown.map(([project, count]) => {
                  const pct = totalSent > 0 ? (count / totalSent) * 100 : 0;
                  return (
                    <div key={project}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{project}</span>
                        <span className="text-gray-500">{count} sent</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full bg-primary-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Sends */}
        <div className="section-card">
          <div className="section-header">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Recent Sends
            </h2>
          </div>
          <div className="divide-y dark:divide-gray-700">
            {recentSends.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No emails sent yet.</p>
            ) : (
              recentSends.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <Mail className="h-4 w-4 shrink-0 text-primary-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                      {entry.projectNumber}{entry.subjobCode ? ` / ${entry.subjobCode}` : ''}
                      {entry.client ? ` — ${entry.client}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDDMMYYYY(entry.date)} · {entry.crewCount} crew · {entry.toRecipients.length} recipients
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatDDMMYYYY(entry.sentAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Crew summary */}
      {totalSent > 0 && (
        <div className="mt-6 section-card p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary-500" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Crew Deployments
              </p>
              <p className="text-xs text-gray-500">
                {totalCrew} total crew member assignments across {totalSent} sent plans
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ── Stat Card ─────────────────────────────────────── */
function StatCard({
  icon,
  label,
  value,
  colour,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  colour: 'primary' | 'success' | 'danger' | 'secondary';
}) {
  const bgMap = {
    primary: 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300',
    success: 'bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-300',
    danger: 'bg-danger-50 text-danger-600 dark:bg-danger-900/20 dark:text-danger-300',
    secondary: 'bg-secondary-50 text-secondary-600 dark:bg-secondary-900/20 dark:text-secondary-300',
  };
  return (
    <div className="section-card p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${bgMap[colour]}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
