import React from 'react';
import { useEmailLogStore } from '@/store/emailLogStore';
import { Mail, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

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

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${formatDDMMYYYY(iso)} ${d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}

export default function EmailHistoryPage() {
  const { logs, clearLogs } = useEmailLogStore();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email History</h1>
        {logs.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Clear all email history?')) clearLogs();
            }}
            className="btn-danger flex items-center gap-1.5 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="section-card p-8 text-center text-gray-500 dark:text-gray-400">
          <Mail className="mx-auto mb-3 h-12 w-12 opacity-40" />
          <p>No emails sent yet. Send a daily plan to see it logged here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="section-card overflow-hidden"
            >
              <div className="flex items-start gap-3 p-4">
                {/* Status icon */}
                <div className="mt-0.5">
                  {entry.status === 'sent' ? (
                    <CheckCircle2 className="h-5 w-5 text-success-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-danger-500" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {entry.subject}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.status === 'sent'
                          ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-300'
                          : 'bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-300'
                      }`}
                    >
                      {entry.status === 'sent' ? 'Sent' : 'Failed'}
                    </span>
                  </div>

                  <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Sent: </span>
                      {formatDateTime(entry.sentAt)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Plan date: </span>
                      {formatDDMMYYYY(entry.date)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Project: </span>
                      {entry.projectNumber || '—'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Sub Job: </span>
                      {entry.subjobCode || '—'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Client: </span>
                      {entry.client || '—'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Crew: </span>
                      {entry.crewCount} members
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">To:</span>{' '}
                    {entry.toRecipients.join(', ')}
                    {entry.ccRecipients.length > 0 && (
                      <>
                        {' · '}
                        <span className="font-medium">CC:</span>{' '}
                        {entry.ccRecipients.join(', ')}
                      </>
                    )}
                  </div>

                  {entry.error && (
                    <div className="mt-2 rounded bg-danger-50 px-2 py-1 text-xs text-danger-700 dark:bg-danger-900/20 dark:text-danger-300">
                      {entry.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
