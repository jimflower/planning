/**
 * SQLite database layer for Daily Planning Hub.
 *
 * Uses better-sqlite3 — a synchronous, zero-config, file-based database.
 * The .db file lives alongside the project and persists across restarts.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'planning-hub.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

/* ── Schema ────────────────────────────────────────── */
db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id               TEXT PRIMARY KEY,
    date             TEXT NOT NULL,
    project_number   TEXT NOT NULL DEFAULT '',
    subjob_code      TEXT NOT NULL DEFAULT '',
    client           TEXT NOT NULL DEFAULT '',
    location         TEXT NOT NULL DEFAULT '',
    weather          TEXT NOT NULL DEFAULT '',
    planned_work     TEXT NOT NULL DEFAULT '',
    materials        TEXT NOT NULL DEFAULT '',
    notes            TEXT NOT NULL DEFAULT '',
    created_by       TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL,
    last_modified    TEXT NOT NULL,
    sent_at          TEXT,
    procore_sync     TEXT,
    procore_diary_id TEXT,

    -- JSON columns for nested data
    crew_assignments TEXT NOT NULL DEFAULT '[]',
    qa_requirements  TEXT NOT NULL DEFAULT '[]'
  );

  CREATE INDEX IF NOT EXISTS idx_plans_date ON plans(date);
  CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project_number);
`);

/* ── Types matching the frontend PlanningEmail ─────── */
export interface PlanRow {
  id: string;
  date: string;
  project_number: string;
  subjob_code: string;
  client: string;
  location: string;
  weather: string;
  planned_work: string;
  materials: string;
  notes: string;
  created_by: string;
  created_at: string;
  last_modified: string;
  sent_at: string | null;
  procore_sync: string | null;
  procore_diary_id: string | null;
  crew_assignments: string; // JSON
  qa_requirements: string;  // JSON
}

/* ── Prepared statements ───────────────────────────── */
const stmts = {
  getAll: db.prepare(`SELECT * FROM plans ORDER BY date DESC, last_modified DESC`),

  getById: db.prepare(`SELECT * FROM plans WHERE id = ?`),

  upsert: db.prepare(`
    INSERT INTO plans (
      id, date, project_number, subjob_code, client, location, weather,
      planned_work, materials, notes, created_by, created_at, last_modified,
      sent_at, procore_sync, procore_diary_id, crew_assignments, qa_requirements
    ) VALUES (
      @id, @date, @project_number, @subjob_code, @client, @location, @weather,
      @planned_work, @materials, @notes, @created_by, @created_at, @last_modified,
      @sent_at, @procore_sync, @procore_diary_id, @crew_assignments, @qa_requirements
    )
    ON CONFLICT(id) DO UPDATE SET
      date             = @date,
      project_number   = @project_number,
      subjob_code      = @subjob_code,
      client           = @client,
      location         = @location,
      weather          = @weather,
      planned_work     = @planned_work,
      materials        = @materials,
      notes            = @notes,
      created_by       = @created_by,
      last_modified    = @last_modified,
      sent_at          = @sent_at,
      procore_sync     = @procore_sync,
      procore_diary_id = @procore_diary_id,
      crew_assignments = @crew_assignments,
      qa_requirements  = @qa_requirements
  `),

  deleteById: db.prepare(`DELETE FROM plans WHERE id = ?`),
};

/* ── Public API ────────────────────────────────────── */
export function getAllPlans(): PlanRow[] {
  return stmts.getAll.all() as PlanRow[];
}

export function getPlanById(id: string): PlanRow | undefined {
  return stmts.getById.get(id) as PlanRow | undefined;
}

export function upsertPlan(plan: PlanRow): void {
  stmts.upsert.run(plan);
}

export function deletePlan(id: string): boolean {
  const result = stmts.deleteById.run(id);
  return result.changes > 0;
}

/** Bulk upsert (used for initial sync from localStorage) */
export function bulkUpsert(plans: PlanRow[]): number {
  const tx = db.transaction((items: PlanRow[]) => {
    for (const p of items) stmts.upsert.run(p);
    return items.length;
  });
  return tx(plans);
}

export default db;
