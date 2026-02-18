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
import {
  getAllPlans, getPlanById, upsertPlan, deletePlan, bulkUpsert,
  insertPendingNote, getAllPendingNotes, getPendingNotesByDate,
  markNotePosted, markNoteFailed, updateNoteTokens, deletePendingNote,
} from './db.js';
import type { PlanRow, PendingNoteRow } from './db.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

/* ── Procore cron job: posts pending notes at 00:01 AM ─ */

const PROCORE_TOKEN_URL = 'https://login.procore.com/oauth/token';
const PROCORE_API_BASE = 'https://api.procore.com';
const PROCORE_CLIENT_ID = process.env.VITE_PROCORE_CLIENT_ID ?? '';
const PROCORE_CLIENT_SECRET = process.env.VITE_PROCORE_CLIENT_SECRET ?? '';

/**
 * Refresh Procore tokens if they're about to expire (< 5 min remaining).
 * Updates the DB row with the new tokens.
 */
async function ensureFreshTokens(note: PendingNoteRow): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const FIVE_MINS = 5 * 60 * 1000;

  if (note.token_expires_at - Date.now() > FIVE_MINS) {
    return { accessToken: note.access_token, refreshToken: note.refresh_token, expiresAt: note.token_expires_at };
  }

  console.log(`[Cron] Refreshing Procore token for pending note #${note.id}…`);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: PROCORE_CLIENT_ID,
    client_secret: PROCORE_CLIENT_SECRET,
    refresh_token: note.refresh_token,
  });

  const resp = await axios.post(PROCORE_TOKEN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const { access_token, refresh_token, expires_in } = resp.data;
  const newRefresh = refresh_token ?? note.refresh_token;
  const newExpires = Date.now() + expires_in * 1000;

  updateNoteTokens(note.id, access_token, newRefresh, newExpires);
  return { accessToken: access_token, refreshToken: newRefresh, expiresAt: newExpires };
}

/**
 * Post a single pending note to Procore's notes_logs endpoint.
 */
async function postPendingNote(note: PendingNoteRow): Promise<void> {
  const { accessToken } = await ensureFreshTokens(note);

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
        ...(note.company_id ? { 'Procore-Company-Id': note.company_id } : {}),
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

/* ── Start ─────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n  🗄️  Daily Planning Hub API server`);
  console.log(`  📁 Database: planning-hub.db`);
  console.log(`  🌐 http://localhost:${PORT}/api/plans\n`);
});
