/* ── Offline / sync types ──────────────────────────── */

export interface SyncOperation {
  id: string;
  type: 'create_planning' | 'update_planning' | 'send_email' | 'procore_sync';
  data: unknown;
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}
