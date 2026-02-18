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

  -- Pending Procore notes: queued for future-date posting via cron
  CREATE TABLE IF NOT EXISTS pending_procore_notes (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id            TEXT NOT NULL,
    project_id         INTEGER NOT NULL,
    scheduled_date     TEXT NOT NULL,          -- YYYY-MM-DD target date
    subject            TEXT NOT NULL DEFAULT '',
    comment_body       TEXT NOT NULL DEFAULT '',
    access_token       TEXT NOT NULL,
    refresh_token      TEXT NOT NULL,
    token_expires_at   INTEGER NOT NULL,       -- epoch ms
    company_id         TEXT NOT NULL DEFAULT '',
    status             TEXT NOT NULL DEFAULT 'pending',  -- pending | posted | failed
    created_at         TEXT NOT NULL,
    posted_at          TEXT,
    error              TEXT,
    UNIQUE(plan_id, scheduled_date)
  );

  CREATE INDEX IF NOT EXISTS idx_pending_notes_date   ON pending_procore_notes(scheduled_date);
  CREATE INDEX IF NOT EXISTS idx_pending_notes_status ON pending_procore_notes(status);

  -- Server-side Procore credential storage (synced from browser)
  CREATE TABLE IF NOT EXISTS procore_credentials (
    user_email       TEXT PRIMARY KEY,
    access_token     TEXT NOT NULL,
    refresh_token    TEXT NOT NULL,
    expires_at       INTEGER NOT NULL,       -- epoch ms
    company_id       TEXT NOT NULL DEFAULT '',
    updated_at       TEXT NOT NULL
  );
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

export interface PendingNoteRow {
  id: number;
  plan_id: string;
  project_id: number;
  scheduled_date: string;
  subject: string;
  comment_body: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: number;
  company_id: string;
  status: 'pending' | 'posted' | 'failed';
  created_at: string;
  posted_at: string | null;
  error: string | null;
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

/* ── Pending Procore Notes ─────────────────────────── */
const pendingStmts = {
  insert: db.prepare(`
    INSERT INTO pending_procore_notes (
      plan_id, project_id, scheduled_date, subject, comment_body,
      access_token, refresh_token, token_expires_at, company_id,
      status, created_at
    ) VALUES (
      @plan_id, @project_id, @scheduled_date, @subject, @comment_body,
      @access_token, @refresh_token, @token_expires_at, @company_id,
      'pending', @created_at
    )
    ON CONFLICT(plan_id, scheduled_date) DO UPDATE SET
      project_id       = @project_id,
      subject          = @subject,
      comment_body     = @comment_body,
      access_token     = @access_token,
      refresh_token    = @refresh_token,
      token_expires_at = @token_expires_at,
      company_id       = @company_id,
      status           = 'pending',
      created_at       = @created_at,
      posted_at        = NULL,
      error            = NULL
  `),

  getByDate: db.prepare(
    `SELECT * FROM pending_procore_notes WHERE scheduled_date = ? AND status = 'pending'`
  ),

  getAll: db.prepare(
    `SELECT * FROM pending_procore_notes ORDER BY scheduled_date ASC, created_at DESC`
  ),

  markPosted: db.prepare(
    `UPDATE pending_procore_notes SET status = 'posted', posted_at = ? WHERE id = ?`
  ),

  markFailed: db.prepare(
    `UPDATE pending_procore_notes SET status = 'failed', error = ? WHERE id = ?`
  ),

  updateTokens: db.prepare(
    `UPDATE pending_procore_notes SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?`
  ),

  deleteById: db.prepare(`DELETE FROM pending_procore_notes WHERE id = ?`),
};

export function insertPendingNote(note: Omit<PendingNoteRow, 'id' | 'status' | 'posted_at' | 'error'>): number {
  const result = pendingStmts.insert.run(note);
  return Number(result.lastInsertRowid);
}

export function getPendingNotesByDate(date: string): PendingNoteRow[] {
  return pendingStmts.getByDate.all(date) as PendingNoteRow[];
}

export function getAllPendingNotes(): PendingNoteRow[] {
  return pendingStmts.getAll.all() as PendingNoteRow[];
}

export function markNotePosted(id: number): void {
  pendingStmts.markPosted.run(new Date().toISOString(), id);
}

export function markNoteFailed(id: number, error: string): void {
  pendingStmts.markFailed.run(error, id);
}

export function updateNoteTokens(id: number, accessToken: string, refreshToken: string, expiresAt: number): void {
  pendingStmts.updateTokens.run(accessToken, refreshToken, expiresAt, id);
}

export function deletePendingNote(id: number): boolean {
  const result = pendingStmts.deleteById.run(id);
  return result.changes > 0;
}

/* ── Procore Credentials (server-side secure storage) ─ */
export interface ProcoreCredentialRow {
  user_email: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  company_id: string;
  updated_at: string;
}

const credStmts = {
  upsert: db.prepare(`
    INSERT INTO procore_credentials (user_email, access_token, refresh_token, expires_at, company_id, updated_at)
    VALUES (@user_email, @access_token, @refresh_token, @expires_at, @company_id, @updated_at)
    ON CONFLICT(user_email) DO UPDATE SET
      access_token  = @access_token,
      refresh_token = @refresh_token,
      expires_at    = @expires_at,
      company_id    = @company_id,
      updated_at    = @updated_at
  `),

  getByEmail: db.prepare(`SELECT * FROM procore_credentials WHERE user_email = ?`),

  getFirst: db.prepare(`SELECT * FROM procore_credentials ORDER BY updated_at DESC LIMIT 1`),

  getAll: db.prepare(`SELECT * FROM procore_credentials ORDER BY updated_at DESC`),
};

export function upsertProcoreCredentials(cred: ProcoreCredentialRow): void {
  credStmts.upsert.run(cred);
}

export function getProcoreCredentials(email: string): ProcoreCredentialRow | undefined {
  return credStmts.getByEmail.get(email) as ProcoreCredentialRow | undefined;
}

export function getLatestProcoreCredentials(): ProcoreCredentialRow | undefined {
  return credStmts.getFirst.get() as ProcoreCredentialRow | undefined;
}

export function getAllProcoreCredentials(): ProcoreCredentialRow[] {
  return credStmts.getAll.all() as ProcoreCredentialRow[];
}

export default db;
