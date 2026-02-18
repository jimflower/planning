import React from 'react';
import { useEmailLogStore } from '@/store/emailLogStore';
import { usePlanningStore } from '@/store/planningStore';
import { Mail, Send, AlertTriangle, ClipboardList, Users, FolderOpen } from 'lucide-react';

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
  const logs = useEmailLogStore((s) => s.logs);
  const history = usePlanningStore((s) => s.history);

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
