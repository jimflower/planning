/**
 * Express API server for Daily Planning Hub.
 *
 * Runs on port 3001 alongside the Vite dev server (5173).
 * All plan data is persisted in a local SQLite database.
 *
 * Endpoints:
 *   GET    /api/plans          - List all plans
 *   GET    /api/plans/:id      - Get a single plan
 *   POST   /api/plans          - Create or update a plan
 *   DELETE /api/plans/:id      - Delete a plan
 *   POST   /api/plans/sync     - Bulk sync from localStorage
 */
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import axios from 'axios';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAllPlans, getPlanById, upsertPlan, deletePlan, bulkUpsert,
  insertPendingNote, getAllPendingNotes, getPendingNotesByDate,
  markNotePosted, markNoteFailed, updateNoteTokens, deletePendingNote,
  upsertProcoreCredentials, getLatestProcoreCredentials, getAllProcoreCredentials,
  getSetting, getAllSettings, upsertSetting, deleteSetting,
  getUserRole, getAllUserRoles, upsertUserRole, deleteUserRole,
  insertEmailLog, getAllEmailLogs, getEmailLogById, getEmailLogsByDateRange, deleteEmailLog,
} from './db.js';
import type { PlanRow, PendingNoteRow, ProcoreCredentialRow, SettingRow, UserRoleRow, EmailLogRow } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ?? 3001;
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ── Procore proxy routes (replaces Vite dev proxy in production) ── */

// Proxy middleware for /proxy/login/* and /proxy/api/*
app.use('/proxy', async (req, res, next) => {
  if (req.path.startsWith('/login/')) {
    const targetPath = req.path.replace('/login/', '');
    const targetUrl = `https://login.procore.com/${targetPath}`;
    console.log(`[Proxy] ${req.method} ${req.path} → ${targetUrl}`);
    console.log(`[Proxy] Request body:`, req.body);
    
    try {
      const resp = await axios({
        method: req.method as any,
        url: targetUrl,
        data: req.body,
        headers: {
          ...Object.fromEntries(
            Object.entries(req.headers).filter(([k]) =>
              !['host', 'connection', 'content-length'].includes(k.toLowerCase()),
            ),
          ),
          host: 'login.procore.com',
        },
        params: req.query,
        validateStatus: () => true,
      });
      
      console.log(`[Proxy] Response status: ${resp.status}`);
      if (resp.status >= 400) {
        console.log(`[Proxy] Error response:`, resp.data);
      }
      
      res.status(resp.status);
      for (const [key, val] of Object.entries(resp.headers)) {
        if (val && !['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, val as string);
        }
      }
      res.send(resp.data);
    } catch (err) {
      console.error('[Proxy] login.procore.com error:', err);
      res.status(502).json({ error: 'Proxy error' });
    }
  } else if (req.path.startsWith('/api/')) {
    const targetPath = req.path.replace('/api/', '');
    const targetUrl = `https://api.procore.com/${targetPath}`;
    console.log(`[Proxy] ${req.method} ${req.path} → ${targetUrl}`);
    
    try {
      const resp = await axios({
        method: req.method as any,
        url: targetUrl,
        data: req.body,
        headers: {
          ...Object.fromEntries(
            Object.entries(req.headers).filter(([k]) =>
              !['host', 'connection', 'content-length'].includes(k.toLowerCase()),
            ),
          ),
          host: 'api.procore.com',
        },
        params: req.query,
        validateStatus: () => true,
      });
      
      res.status(resp.status);
      for (const [key, val] of Object.entries(resp.headers)) {
        if (val && !['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, val as string);
        }
      }
      res.send(resp.data);
    } catch (err) {
      console.error('[Proxy] api.procore.com error:', err);
      res.status(502).json({ error: 'Proxy error' });
    }
  } else {
    next();
  }
});

/* ── Helper: convert frontend PlanningEmail → PlanRow ── */
interface PlanningEmailPayload {
  id: string;
  date: string;
  projectNumber: string;
  subjobCode: string;
  client: string;
  location: string;
  weather: string;
  plannedWork: string;
  crewAssignments: unknown[];
  materials: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  lastModified: string;
  sentAt?: string;
  procoreSyncStatus?: string;
  procoreDiaryId?: string;
  qaRequirements: unknown[];
}

function toRow(plan: PlanningEmailPayload): PlanRow {
  return {
    id: plan.id,
    date: plan.date,
    project_number: plan.projectNumber ?? '',
    subjob_code: plan.subjobCode ?? '',
    client: plan.client ?? '',
    location: plan.location ?? '',
    weather: plan.weather ?? '',
    planned_work: plan.plannedWork ?? '',
    materials: plan.materials ?? '',
    notes: plan.notes ?? '',
    created_by: plan.createdBy ?? '',
    created_at: plan.createdAt,
    last_modified: plan.lastModified,
    sent_at: plan.sentAt ?? null,
    procore_sync: plan.procoreSyncStatus ?? null,
    procore_diary_id: plan.procoreDiaryId ?? null,
    crew_assignments: JSON.stringify(plan.crewAssignments ?? []),
    qa_requirements: JSON.stringify(plan.qaRequirements ?? []),
  };
}

function fromRow(row: PlanRow): PlanningEmailPayload {
  return {
    id: row.id,
    date: row.date,
    projectNumber: row.project_number,
    subjobCode: row.subjob_code,
    client: row.client,
    location: row.location,
    weather: row.weather,
    plannedWork: row.planned_work,
    crewAssignments: JSON.parse(row.crew_assignments),
    materials: row.materials,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastModified: row.last_modified,
    sentAt: row.sent_at ?? undefined,
    procoreSyncStatus: (row.procore_sync as PlanningEmailPayload['procoreSyncStatus']) ?? undefined,
    procoreDiaryId: row.procore_diary_id ?? undefined,
    qaRequirements: JSON.parse(row.qa_requirements),
  };
}

/* ── Routes ────────────────────────────────────────── */

// List all plans
app.get('/api/plans', (_req, res) => {
  try {
    const rows = getAllPlans();
    res.json(rows.map(fromRow));
  } catch (err) {
    console.error('[API] GET /api/plans error:', err);
    res.status(500).json({ error: 'Failed to retrieve plans' });
  }
});

// Get single plan
app.get('/api/plans/:id', (req, res) => {
  try {
    const row = getPlanById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Plan not found' });
    res.json(fromRow(row));
  } catch (err) {
    console.error('[API] GET /api/plans/:id error:', err);
    res.status(500).json({ error: 'Failed to retrieve plan' });
  }
});

// Create or update a plan
app.post('/api/plans', (req, res) => {
  try {
    const plan = req.body as PlanningEmailPayload;
    if (!plan.id) return res.status(400).json({ error: 'Plan must have an id' });
    upsertPlan(toRow(plan));
    console.log(`[API] Saved plan ${plan.id} (${plan.date} - ${plan.projectNumber})`);
    res.json({ success: true, id: plan.id });
  } catch (err) {
    console.error('[API] POST /api/plans error:', err);
    res.status(500).json({ error: 'Failed to save plan' });
  }
});

// Delete a plan
app.delete('/api/plans/:id', (req, res) => {
  try {
    const deleted = deletePlan(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Plan not found' });
    console.log(`[API] Deleted plan ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /api/plans/:id error:', err);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// Bulk sync — accepts array of plans from localStorage
app.post('/api/plans/sync', (req, res) => {
  try {
    const plans = req.body as PlanningEmailPayload[];
    if (!Array.isArray(plans)) return res.status(400).json({ error: 'Expected an array of plans' });
    const rows = plans.map(toRow);
    const count = bulkUpsert(rows);
    console.log(`[API] Bulk synced ${count} plans`);
    res.json({ success: true, count });
  } catch (err) {
    console.error('[API] POST /api/plans/sync error:', err);
    res.status(500).json({ error: 'Failed to sync plans' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ── Pending Procore Notes endpoints ───────────────── */

// Queue a future-date Procore note
app.post('/api/pending-notes', (req, res) => {
  try {
    const body = req.body as {
      planId: string;
      projectId: number;
      scheduledDate: string;
      subject: string;
      commentBody: string;
      accessToken: string;
      refreshToken: string;
      tokenExpiresAt: number;
      companyId: string;
    };

    if (!body.planId || !body.projectId || !body.scheduledDate || !body.accessToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = insertPendingNote({
      plan_id: body.planId,
      project_id: body.projectId,
      scheduled_date: body.scheduledDate,
      subject: body.subject ?? '',
      comment_body: body.commentBody ?? '',
      access_token: body.accessToken,
      refresh_token: body.refreshToken,
      token_expires_at: body.tokenExpiresAt,
      company_id: body.companyId ?? '',
      created_at: new Date().toISOString(),
    });

    console.log(`[API] Queued pending Procore note #${id} for ${body.scheduledDate} (plan ${body.planId})`);
    res.json({ success: true, id });
  } catch (err) {
    console.error('[API] POST /api/pending-notes error:', err);
    res.status(500).json({ error: 'Failed to queue pending note' });
  }
});

// List all pending notes
app.get('/api/pending-notes', (_req, res) => {
  try {
    res.json(getAllPendingNotes());
  } catch (err) {
    console.error('[API] GET /api/pending-notes error:', err);
    res.status(500).json({ error: 'Failed to retrieve pending notes' });
  }
});

// Delete a pending note
app.delete('/api/pending-notes/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const deleted = deletePendingNote(id);
    if (!deleted) return res.status(404).json({ error: 'Pending note not found' });
    console.log(`[API] Deleted pending note #${id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /api/pending-notes/:id error:', err);
    res.status(500).json({ error: 'Failed to delete pending note' });
  }
});

/* ── Procore Credentials (server-side secure storage) ─ */

// Sync Procore tokens from browser to server
app.post('/api/procore-credentials', (req, res) => {
  try {
    const body = req.body as {
      userEmail: string;
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      companyId: string;
    };

    if (!body.userEmail || !body.accessToken) {
      return res.status(400).json({ error: 'Missing required fields (userEmail, accessToken)' });
    }

    upsertProcoreCredentials({
      user_email: body.userEmail,
      access_token: body.accessToken,
      refresh_token: body.refreshToken,
      expires_at: body.expiresAt,
      company_id: body.companyId ?? '',
      updated_at: new Date().toISOString(),
    });

    console.log(`[API] Synced Procore credentials for ${body.userEmail}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] POST /api/procore-credentials error:', err);
    res.status(500).json({ error: 'Failed to store credentials' });
  }
});

// Get stored credentials status (no secrets exposed)
app.get('/api/procore-credentials', (_req, res) => {
  try {
    const creds = getAllProcoreCredentials();
    // Return only metadata — never expose tokens to the browser
    res.json(
      creds.map((c) => ({
        userEmail: c.user_email,
        companyId: c.company_id,
        hasTokens: Boolean(c.access_token),
        expiresAt: c.expires_at,
        updatedAt: c.updated_at,
      })),
    );
  } catch (err) {
    console.error('[API] GET /api/procore-credentials error:', err);
    res.status(500).json({ error: 'Failed to retrieve credentials' });
  }
});

/* ── Global Settings ───────────────────────────────── */

// Get all settings
app.get('/api/settings', (_req, res) => {
  try {
    const settings = getAllSettings();
    const settingsObj: Record<string, string> = {};
    settings.forEach((s) => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  } catch (err) {
    console.error('[API] GET /api/settings error:', err);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// Get a single setting
app.get('/api/settings/:key', (req, res) => {
  try {
    const setting = getSetting(req.params.key);
    if (!setting) return res.status(404).json({ error: 'Setting not found' });
    res.json({ key: setting.key, value: setting.value });
  } catch (err) {
    console.error('[API] GET /api/settings/:key error:', err);
    res.status(500).json({ error: 'Failed to retrieve setting' });
  }
});

// Update or create a setting
app.post('/api/settings', (req, res) => {
  try {
    const { key, value, userEmail } = req.body;
    if (!key || !value) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    
    // Check user role — only admins and managers can update global settings
    const userRole = getUserRole(userEmail ?? '');
    if (userRole && !['admin', 'manager'].includes(userRole.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    upsertSetting(key, value, userEmail ?? 'system');
    console.log(`[API] Updated setting ${key} by ${userEmail ?? 'system'}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] POST /api/settings error:', err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Delete a setting
app.delete('/api/settings/:key', (req, res) => {
  try {
    const { userEmail } = req.body;
    
    // Check user role — only admins can delete settings
    const userRole = getUserRole(userEmail ?? '');
    if (!userRole || userRole.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    
    const deleted = deleteSetting(req.params.key);
    if (!deleted) return res.status(404).json({ error: 'Setting not found' });
    console.log(`[API] Deleted setting ${req.params.key}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /api/settings/:key error:', err);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

/* ── User Roles ────────────────────────────────────── */

// Get current user's role
app.get('/api/user-role/:email', (req, res) => {
  try {
    let role = getUserRole(req.params.email);
    
    // Auto-create user with 'user' role if they don't exist
    if (!role) {
      upsertUserRole(req.params.email, 'user');
      console.log(`[API] Auto-created user role for ${req.params.email}`);
      role = { email: req.params.email, role: 'user', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    }
    
    res.json({ email: req.params.email, role: role.role });
  } catch (err) {
    console.error('[API] GET /api/user-role/:email error:', err);
    res.status(500).json({ error: 'Failed to retrieve user role' });
  }
});

// Get all user roles (admin only)
app.get('/api/user-roles', (req, res) => {
  try {
    const { userEmail } = req.query;
    
    // Check if requesting user is admin
    const requestingUser = getUserRole(userEmail as string ?? '');
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    
    const roles = getAllUserRoles();
    res.json(roles);
  } catch (err) {
    console.error('[API] GET /api/user-roles error:', err);
    res.status(500).json({ error: 'Failed to retrieve user roles' });
  }
});

// Update user role (admin only)
app.post('/api/user-role', (req, res) => {
  try {
    const { email, role, userEmail } = req.body;
    
    // Check if requesting user is admin
    const requestingUser = getUserRole(userEmail ?? '');
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    
    if (!email || !role || !['admin', 'manager', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Valid email and role (admin|manager|user) required' });
    }
    
    upsertUserRole(email, role);
    console.log(`[API] Set role for ${email} to ${role} by ${userEmail}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] POST /api/user-role error:', err);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

/* ── Email Logs ────────────────────────────────────── */

// Get all email logs
app.get('/api/email-logs', (_req, res) => {
  try {
    const logs = getAllEmailLogs();
    res.json(logs);
  } catch (err) {
    console.error('[API] GET /api/email-logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve email logs' });
  }
});

// Get email logs by date range
app.get('/api/email-logs/range', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    const logs = getEmailLogsByDateRange(startDate as string, endDate as string);
    res.json(logs);
  } catch (err) {
    console.error('[API] GET /api/email-logs/range error:', err);
    res.status(500).json({ error: 'Failed to retrieve email logs' });
  }
});

// Create email log
app.post('/api/email-logs', (req, res) => {
  try {
    const log = req.body as EmailLogRow;
    if (!log.id || !log.plan_id || !log.date || !log.sent_at) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Ensure JSON fields are stringified
    const logRow: EmailLogRow = {
      ...log,
      to_recipients: typeof log.to_recipients === 'string' ? log.to_recipients : JSON.stringify(log.to_recipients),
      cc_recipients: typeof log.cc_recipients === 'string' ? log.cc_recipients : JSON.stringify(log.cc_recipients),
      recipient_user_ids: typeof log.recipient_user_ids === 'string' ? log.recipient_user_ids : JSON.stringify(log.recipient_user_ids || []),
    };

    insertEmailLog(logRow);
    console.log(`[API] Logged email ${log.id} for plan ${log.plan_id} by ${log.sent_by}`);
    res.json({ success: true, id: log.id });
  } catch (err) {
    console.error('[API] POST /api/email-logs error:', err);
    res.status(500).json({ error: 'Failed to save email log' });
  }
});

// Delete email log
app.delete('/api/email-logs/:id', (req, res) => {
  try {
    const deleted = deleteEmailLog(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Email log not found' });
    console.log(`[API] Deleted email log ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /api/email-logs/:id error:', err);
    res.status(500).json({ error: 'Failed to delete email log' });
  }
});

/* ── Procore cron job: posts pending notes at 00:01 AM ─ */

const PROCORE_TOKEN_URL = 'https://login.procore.com/oauth/token';
const PROCORE_API_BASE = 'https://api.procore.com';
const PROCORE_CLIENT_ID = process.env.VITE_PROCORE_CLIENT_ID ?? '';
const PROCORE_CLIENT_SECRET = process.env.VITE_PROCORE_CLIENT_SECRET ?? '';

/**
 * Refresh Procore tokens if they're about to expire (< 5 min remaining).
 * Uses centrally stored credentials, falling back to per-note tokens.
 */
async function ensureFreshTokens(note: PendingNoteRow): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const FIVE_MINS = 5 * 60 * 1000;

  // Prefer server-side credential store (synced from browser)
  const serverCred = getLatestProcoreCredentials();
  const accessToken = serverCred?.access_token ?? note.access_token;
  const refreshToken = serverCred?.refresh_token ?? note.refresh_token;
  const expiresAt = serverCred?.expires_at ?? note.token_expires_at;

  if (expiresAt - Date.now() > FIVE_MINS) {
    return { accessToken, refreshToken, expiresAt };
  }

  console.log(`[Cron] Refreshing Procore token for pending note #${note.id}…`);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: PROCORE_CLIENT_ID,
    client_secret: PROCORE_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const resp = await axios.post(PROCORE_TOKEN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const { access_token, refresh_token, expires_in } = resp.data;
  const newRefresh = refresh_token ?? refreshToken;
  const newExpires = Date.now() + expires_in * 1000;

  // Update both per-note tokens and server credential store
  updateNoteTokens(note.id, access_token, newRefresh, newExpires);
  if (serverCred) {
    upsertProcoreCredentials({
      ...serverCred,
      access_token,
      refresh_token: newRefresh,
      expires_at: newExpires,
      updated_at: new Date().toISOString(),
    });
    console.log(`[Cron] Updated server-stored Procore credentials for ${serverCred.user_email}`);
  }

  return { accessToken: access_token, refreshToken: newRefresh, expiresAt: newExpires };
}

/**
 * Post a single pending note to Procore's notes_logs endpoint.
 */
async function postPendingNote(note: PendingNoteRow): Promise<void> {
  const { accessToken } = await ensureFreshTokens(note);
  const companyId = note.company_id || getLatestProcoreCredentials()?.company_id || '';

  const url = `${PROCORE_API_BASE}/rest/v1.0/projects/${note.project_id}/notes_logs`;
  await axios.post(
    url,
    {
      notes_log: {
        date: note.scheduled_date,
        comment: note.comment_body,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(companyId ? { 'Procore-Company-Id': companyId } : {}),
      },
    },
  );
}

/**
 * Process all pending notes for today's date.
 */
async function processPendingNotes(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const notes = getPendingNotesByDate(today);

  if (notes.length === 0) return;

  console.log(`[Cron] Processing ${notes.length} pending Procore note(s) for ${today}…`);

  for (const note of notes) {
    try {
      await postPendingNote(note);
      markNotePosted(note.id);
      console.log(`[Cron] ✅ Posted note #${note.id} (plan ${note.plan_id}) to project ${note.project_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      markNoteFailed(note.id, message);
      console.error(`[Cron] ❌ Failed note #${note.id}:`, message);
    }
  }
}

// Schedule: every day at 00:01 AM
cron.schedule('1 0 * * *', async () => {
  console.log(`\n[Cron] ⏰ Running scheduled Procore note posting at ${new Date().toISOString()}`);
  try {
    await processPendingNotes();
  } catch (err) {
    console.error('[Cron] Unexpected error:', err);
  }
});

// Also process on server startup (catches any missed notes from server downtime)
setTimeout(async () => {
  console.log('[Cron] Checking for any pending notes on startup…');
  try {
    await processPendingNotes();
  } catch (err) {
    console.error('[Cron] Startup check error:', err);
  }
}, 5000);

/* ── Serve built frontend (production) ──────────────── */
import fs from 'node:fs';

if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  // Serve static assets with caching
  app.use(express.static(DIST_DIR, { maxAge: '1d' }));

  // SPA fallback: serve index.html for any non-API route
  app.use((_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });

  console.log(`  📂 Serving frontend from ${DIST_DIR}`);
} else {
  console.warn('  ⚠️  No dist/ folder found — run "npm run build" to build the frontend');
}

/* ── Start ─────────────────────────────────────────── */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🗄️  Daily Planning Hub API server`);
  console.log(`  📁 Database: planning-hub.db`);
  console.log(`  🌐 http://0.0.0.0:${PORT}`);
  console.log(`  🌍 Accessible from network at http://172.16.0.196:${PORT}\n`);
});
