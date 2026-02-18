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
import { getAllPlans, getPlanById, upsertPlan, deletePlan, bulkUpsert } from './db.js';
import type { PlanRow } from './db.js';

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

/* ── Start ─────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n  🗄️  Daily Planning Hub API server`);
  console.log(`  📁 Database: planning-hub.db`);
  console.log(`  🌐 http://localhost:${PORT}/api/plans\n`);
});
