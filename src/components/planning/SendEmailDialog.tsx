import React, { useState, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { graphService } from '@/services/graph.service';
import { buildEmailSubject, buildEmailHtml } from '@/services/emailTemplate';
import { usePlanningStore } from '@/store/planningStore';
import { useEmailLogStore } from '@/store/emailLogStore';
import { useProcoreData } from '@/hooks/useProcoreData';
import { procoreService, buildDailyLogComment } from '@/services/procore.service';
import { procoreConfig } from '@/config/procoreConfig';
import { uuid } from '@/lib/utils/dateHelpers';
import type { PlanningEmail } from '@/types/planning.types';
import type { EmailLogEntry } from '@/types/email.types';

const ALWAYS_CC = 'planning@gnbenergy.com.au';

interface Props {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

export function SendEmailDialog({ open, onClose, onSent }: Props) {
  const plan = usePlanningStore((s) => s.currentPlan) as PlanningEmail;
  const { users, projects } = useProcoreData();
  const addLog = useEmailLogStore((s) => s.addLog);
  const { accounts } = useMsal();

  const userEmail = accounts[0]?.username ?? '';
  const userName = accounts[0]?.name ?? userEmail;

  const [toField, setToField] = useState('');
  const [ccField, setCcField] = useState(ALWAYS_CC);
  const [subject, setSubject] = useState('');
  const [procoreStatus, setProcoreStatus] = useState<'idle' | 'posting' | 'success' | 'failed' | 'scheduled'>('idle');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // On open: set subject, resolve crew emails
  useEffect(() => {
    if (!open) return;
    setError('');
    setProcoreStatus('idle');
    setSubject(buildEmailSubject(plan));

    // Ensure CC always includes planning@gnbenergy.com.au
    setCcField((prev) => {
      const existing = prev
        .split(/[,;]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (!existing.includes(ALWAYS_CC.toLowerCase())) {
        return prev ? `${prev}; ${ALWAYS_CC}` : ALWAYS_CC;
      }
      return prev;
    });

    // Auto-populate To with crew member emails from Procore
    if (users.length > 0 && plan.crewAssignments.length > 0) {
      const crewNames = plan.crewAssignments
        .map((c) => c.name?.trim())
        .filter(Boolean);

      const emails = crewNames
        .map((name) => {
          const match = users.find(
            (u) => u.name.toLowerCase() === name.toLowerCase(),
          );
          return match?.email_address;
        })
        .filter((e): e is string => Boolean(e));

      // Deduplicate
      const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
      if (unique.length > 0) {
        setToField(unique.join('; '));
      }
    }
  }, [open, plan, users]);

  const handleSend = async () => {
    const toList = toField
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (toList.length === 0) {
      setError('Enter at least one recipient email address.');
      return;
    }
    const ccList = ccField
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    // Ensure planning@gnbenergy.com.au is always CC'd
    if (!ccList.some((e) => e.toLowerCase() === ALWAYS_CC.toLowerCase())) {
      ccList.push(ALWAYS_CC);
    }

    setSending(true);
    setError('');
    
    // Map email addresses to Procore user IDs for analytics
    const recipientUserIds = toList
      .map((email) => {
        const user = users.find((u) => u.email_address.toLowerCase() === email.toLowerCase());
        return user?.id;
      })
      .filter((id): id is number => id !== undefined);
    
    try {
      const html = buildEmailHtml(plan);
      const result = await graphService.sendPlanningEmail(subject, html, toList, ccList);

      // Log the attempt
      const logEntry: EmailLogEntry = {
        id: uuid(),
        planId: plan.id,
        date: plan.date,
        sentAt: new Date().toISOString(),
        subject,
        toRecipients: toList,
        ccRecipients: ccList,
        projectNumber: plan.projectNumber,
        subjobCode: plan.subjobCode,
        client: plan.client,
        location: plan.location,
        crewCount: plan.crewAssignments.filter((c) => c.name).length,
        sentBy: userEmail,
        status: result.success ? 'sent' : 'failed',
        error: result.error,
        recipientUserIds: recipientUserIds.length > 0 ? recipientUserIds : undefined,
      };
      addLog(logEntry);

      if (result.success) {
        // Post to Procore daily log — keep dialog open briefly to show result
        await postToProcoreDailyLog(plan, subject);
        onSent();
        // Small delay so user sees the Procore status
        setTimeout(() => onClose(), 1500);
      } else {
        setError(result.error ?? 'Failed to send email.');
      }
    } catch (err: unknown) {
      // Log failures too
      addLog({
        id: uuid(),
        planId: plan.id,
        date: plan.date,
        sentAt: new Date().toISOString(),
        subject,
        toRecipients: toList,
        ccRecipients: ccList,
        projectNumber: plan.projectNumber,
        subjobCode: plan.subjobCode,
        client: plan.client,
        location: plan.location,
        crewCount: plan.crewAssignments.filter((c) => c.name).length,
        sentBy: userEmail,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
        recipientUserIds: recipientUserIds.length > 0 ? recipientUserIds : undefined,
      });
      setError(err instanceof Error ? err.message : 'Unexpected error sending email.');
    } finally {
      setSending(false);
    }
  };

  /** Post a daily log note to Procore for the selected project */
  const postToProcoreDailyLog = async (p: PlanningEmail, subj: string) => {
    if (!procoreService.isAuthenticated()) return;
    const project = projects.find(
      (pr) => pr.project_number === p.projectNumber || pr.name === p.projectNumber,
    );
    if (!project) return;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const isFuture = p.date > today;

    if (isFuture) {
      // Queue for the cron job to post on the scheduled date
      setProcoreStatus('posting');
      try {
        const commentBody = buildDailyLogComment(subj, p);
        const tokens = JSON.parse(localStorage.getItem('procore_tokens') ?? '{}');

        await fetch('/api/pending-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: p.id,
            projectId: project.id,
            scheduledDate: p.date,
            subject: subj,
            commentBody,
            accessToken: tokens.access_token ?? '',
            refreshToken: tokens.refresh_token ?? '',
            tokenExpiresAt: tokens.expires_at ?? 0,
            companyId: procoreConfig.companyId,
          }),
        });

        setProcoreStatus('scheduled');
        console.log('[Procore] Queued daily log note for', p.date, 'on project', project.id);
      } catch (err) {
        setProcoreStatus('failed');
        console.warn('[Procore] Failed to queue daily log note:', err);
      }
    } else {
      // Post immediately for today or past dates
      setProcoreStatus('posting');
      try {
        await procoreService.createDailyLogNote(project.id, p.date, subj, p);
        setProcoreStatus('success');
        console.log('[Procore] Daily log note created for project', project.id, 'date', p.date);
      } catch (err) {
        setProcoreStatus('failed');
        console.warn('[Procore] Failed to create daily log note:', err);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Send Daily Plan
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Signed-in indicator */}
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Sending as <strong>{userName}</strong> ({userEmail})
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="form-input w-full rounded-lg border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* To */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              To <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="email@example.com; email2@example.com"
              value={toField}
              onChange={(e) => setToField(e.target.value)}
              className="form-input w-full rounded-lg border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500">Separate multiple with commas or semicolons</p>
          </div>

          {/* CC */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              CC
            </label>
            <input
              type="text"
              placeholder="Optional"
              value={ccField}
              onChange={(e) => setCcField(e.target.value)}
              className="form-input w-full rounded-lg border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Procore daily log status */}
          {procoreStatus === 'posting' && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Posting to Procore daily log…
            </div>
          )}
          {procoreStatus === 'success' && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
              ✅ Email sent &amp; Procore daily log note created
            </div>
          )}
          {procoreStatus === 'scheduled' && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              📅 Email sent &amp; Procore note scheduled — will auto-post at 00:01 AM on {plan.date}
            </div>
          )}
          {procoreStatus === 'failed' && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              ⚠️ Email sent but Procore daily log note failed — check project permissions
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-5 py-4 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}
