/* ── Email log types ───────────────────────────────── */

export interface EmailLogEntry {
  id: string;
  planId: string;
  date: string;        // plan date (ISO)
  sentAt: string;      // ISO timestamp when sent
  subject: string;
  toRecipients: string[];
  ccRecipients: string[];
  projectNumber: string;
  subjobCode: string;
  client: string;
  location: string;
  crewCount: number;
  sentBy: string;      // email of sender (from MSAL)
  status: 'sent' | 'failed';
  error?: string;
}
