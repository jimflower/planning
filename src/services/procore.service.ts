/**
 * Procore OAuth + REST API service (live).
 *
 * Auth flow:
 *   1. User clicks "Connect Procore" → redirected to Procore login
 *   2. Procore redirects back to /procore/callback?code=…
 *   3. We exchange the code for an access + refresh token
 *   4. Tokens stored in localStorage; auto-refresh on expiry
 *
 * NOTE: The token exchange uses the client secret. In production this
 *       MUST go through a backend proxy. For this internal tool running
 *       on localhost it works directly.
 */
import axios, { type AxiosInstance } from 'axios';
import { procoreConfig } from '@/config/procoreConfig';
import type { ProcoreUser, EquipmentItem, ProcoreProject, ProcorePrimeContract, ProcoreInspection } from '@/types/procore.types';

/* ── Token management ─────────────────────────────── */
interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

const TOKEN_KEY = 'procore_tokens';

function getTokens(): TokenData | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as TokenData) : null;
  } catch {
    return null;
  }
}

function saveTokens(data: TokenData) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
  // Auto-sync to server for cron job reliability
  syncTokensToServer(data);
}

/**
 * Push Procore tokens to the backend so the cron job
 * can post scheduled notes even if the browser is closed.
 */
function syncTokensToServer(tokens: TokenData) {
  // Get the current Microsoft user email (stored in MSAL cache)
  const msalKeys = Object.keys(localStorage).filter((k) => k.includes('login.microsoftonline.com'));
  let userEmail = '';
  for (const key of msalKeys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
      if (parsed.username) { userEmail = parsed.username; break; }
    } catch { /* ignore */ }
  }

  fetch('/api/procore-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail: userEmail || 'unknown',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
      companyId: procoreConfig.companyId,
    }),
  }).catch((err) => console.warn('[Procore] Failed to sync tokens to server:', err));
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

/* ── Cache helpers ────────────────────────────────── */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T) {
  cache.set(key, { data, expiresAt: Date.now() + procoreConfig.cacheDurationMs });
}

/* ── Axios instance ───────────────────────────────── */
function createApi(): AxiosInstance {
  const instance = axios.create({ baseURL: procoreConfig.apiBaseUrl });

  instance.interceptors.request.use(async (config) => {
    const tokens = getTokens();
    if (!tokens) throw new Error('Not authenticated with Procore');

    // Auto-refresh if within 60 s of expiry
    if (tokens.expires_at - Date.now() < 60_000) {
      await procoreService.refreshAccessToken();
      const fresh = getTokens();
      if (fresh) config.headers.Authorization = `Bearer ${fresh.access_token}`;
    } else {
      config.headers.Authorization = `Bearer ${tokens.access_token}`;
    }

    // Procore requires company context header
    if (procoreConfig.companyId) {
      config.headers['Procore-Company-Id'] = procoreConfig.companyId;
    }

    return config;
  });

  return instance;
}

let api: AxiosInstance | null = null;
function getApi() {
  if (!api) api = createApi();
  return api;
}

/* ── Shared helpers ───────────────────────────────── */

/**
 * Build the plain-text body that goes into a Procore daily-log note.
 * Exported so the SendEmailDialog can pre-render it for queued (future-date) notes.
 */
export function buildDailyLogComment(
  subject: string,
  plan: {
    projectNumber?: string;
    subjobCode?: string;
    client?: string;
    location?: string;
    weather?: string;
    crewAssignments?: Array<{
      name?: string;
      roles?: string[];
      startTime?: string;
      startPoint?: string;
      plant?: string;
    }>;
    qaRequirements?: Array<{
      item: string;
      completed?: boolean;
      assignedTo?: string;
      tool?: string;
    }>;
    plannedWork?: string;
    materials?: string;
    notes?: string;
  },
): string {
  const lines: string[] = [`📋 ${subject}`, ''];
  if (plan.projectNumber) lines.push(`Project: ${plan.projectNumber}`);
  if (plan.subjobCode) lines.push(`Sub Job: ${plan.subjobCode}`);
  if (plan.client) lines.push(`Client: ${plan.client}`);
  if (plan.location) lines.push(`Location: ${plan.location}`);
  if (plan.weather) lines.push(`Weather: ${plan.weather}`);

  if (plan.crewAssignments?.length) {
    const activeCrew = plan.crewAssignments.filter((c) => c.name?.trim());
    if (activeCrew.length) {
      lines.push('', '👷 Crew:');
      activeCrew.forEach((c) => {
        const roles = c.roles?.length ? ` (${c.roles.join(', ')})` : '';
        const detail = [c.startTime, c.startPoint, c.plant].filter(Boolean).join(' | ');
        lines.push(`  • ${c.name}${roles}${detail ? ` — ${detail}` : ''}`);
      });
    }
  }

  if (plan.qaRequirements?.length) {
    lines.push('', '✅ QA Requirements:');
    plan.qaRequirements.forEach((qa) => {
      const status = qa.completed ? '✓' : '○';
      lines.push(`  ${status} ${qa.item}${qa.assignedTo ? ` → ${qa.assignedTo}` : ''}${qa.tool ? ` (${qa.tool})` : ''}`);
    });
  }

  if (plan.plannedWork) {
    lines.push('', '🔧 Planned Work:', plan.plannedWork);
  }

  if (plan.materials) {
    lines.push('', '📦 Materials:', plan.materials);
  }

  if (plan.notes) {
    lines.push('', '📝 Notes:', plan.notes);
  }

  return lines.join('\n');
}

/* ── Public service ───────────────────────────────── */
export const procoreService = {
  /* ── Config check ─────────────────────── */
  isConfigured(): boolean {
    return Boolean(procoreConfig.clientId);
  },

  isAuthenticated(): boolean {
    const tokens = getTokens();
    return Boolean(tokens?.access_token);
  },

  /** Force sync current tokens to the server (call on login / page load) */
  syncCredentials() {
    const tokens = getTokens();
    if (tokens) syncTokensToServer(tokens);
  },

  /* ── OAuth ────────────────────────────── */
  /** Redirect user to Procore login */
  startOAuthFlow() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: procoreConfig.clientId,
      redirect_uri: procoreConfig.redirectUri,
    });
    window.location.href = `${procoreConfig.authUrl}?${params.toString()}`;
  },

  /** Exchange authorization code for tokens */
  async exchangeCode(code: string): Promise<void> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: procoreConfig.clientId,
      client_secret: procoreConfig.clientSecret,
      code,
      redirect_uri: procoreConfig.redirectUri,
    });

    const resp = await axios.post(procoreConfig.tokenUrl, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, refresh_token, expires_in } = resp.data;
    saveTokens({
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    });
    api = null; // reset so new tokens are picked up
  },

  /** Refresh the access token */
  async refreshAccessToken(): Promise<void> {
    const tokens = getTokens();
    if (!tokens?.refresh_token) throw new Error('No refresh token available');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: procoreConfig.clientId,
      client_secret: procoreConfig.clientSecret,
      refresh_token: tokens.refresh_token,
    });

    const resp = await axios.post(procoreConfig.tokenUrl, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, refresh_token, expires_in } = resp.data;
    saveTokens({
      access_token,
      refresh_token: refresh_token ?? tokens.refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    });
    api = null;
  },

  /** Disconnect / sign out */
  disconnect() {
    clearTokens();
    cache.clear();
    api = null;
  },

  /* ── API calls ────────────────────────── */

  /** List active projects for the company (including sub jobs) */
  async getProjects(): Promise<ProcoreProject[]> {
    const cacheKey = 'projects';
    const cached = getCached<ProcoreProject[]>(cacheKey);
    if (cached) return cached;

    const resp = await getApi().get('/rest/v1.0/projects', {
      params: {
        company_id: procoreConfig.companyId,
        'filters[status_id]': 'Active',
        per_page: 300,
      },
    });
    const projects = resp.data as ProcoreProject[];
    console.log(
      `[Procore] Loaded ${projects.length} projects. Sample:`,
      projects.slice(0, 3).map((p) => ({
        id: p.id, name: p.name, project_number: p.project_number,
        parent_id: p.parent_id, code: p.code,
        owner: p.owner, address: p.address, city: p.city,
      })),
    );
    setCache(cacheKey, projects);
    return projects;
  },

  /** Get full project detail (includes fields the list omits like custom fields, owner, etc.) */
  async getProjectDetail(projectId: number): Promise<Record<string, unknown>> {
    const cacheKey = `project_detail_${projectId}`;
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    try {
      const resp = await getApi().get(`/rest/v1.0/projects/${projectId}`);
      const data = resp.data as Record<string, unknown>;
      console.log(`[Procore] Project detail ${projectId} keys:`, Object.keys(data));
      console.log(`[Procore] Project detail ${projectId}:`, JSON.stringify(data, null, 2).substring(0, 5000));
      setCache(cacheKey, data);
      return data;
    } catch (err) {
      console.warn(`[Procore] getProjectDetail(${projectId}) failed:`, err);
      return {};
    }
  },

  /** Get sub jobs for a given project */
  async getSubJobs(projectId: number): Promise<ProcoreProject[]> {
    const cacheKey = `subjobs_${projectId}`;
    const cached = getCached<ProcoreProject[]>(cacheKey);
    if (cached) return cached;

    try {
      const resp = await getApi().get('/rest/v1.0/sub_jobs', {
        params: { project_id: projectId, per_page: 200 },
      });
      const raw = resp.data;
      const arr = Array.isArray(raw) ? raw : (raw?.data ?? []);
      console.log(`[Procore] Sub jobs for project ${projectId}:`, arr.length, arr.slice(0, 3));
      const subJobs = arr as ProcoreProject[];
      setCache(cacheKey, subJobs);
      return subJobs;
    } catch (err) {
      console.warn(`[Procore] sub_jobs request failed for project ${projectId}:`, err);
      setCache(cacheKey, []);
      return [];
    }
  },

  /** Get prime (head) contracts for a project.
   *  Tries multiple endpoint patterns — Procore uses DIFFERENT paths depending on API version:
   *    - /rest/v1.0/prime_contracts?project_id=X  (root-level, query param)
   *    - /rest/v1.1/prime_contracts?project_id=X  (root-level, query param)
   *    - /rest/v1.0/projects/X/prime_contracts     (nested — may 404)
   *  The v1.0 singular GET /prime_contract (no s) returns the TEMPLATE — skip it. */
  async getPrimeContracts(projectId: number): Promise<ProcorePrimeContract[]> {
    const cacheKey = `prime_contracts_${projectId}`;
    const cached = getCached<ProcorePrimeContract[]>(cacheKey);
    if (cached) {
      console.log(`[Procore] prime_contracts CACHE HIT for project ${projectId}: ${cached.length} contracts`);
      return cached;
    }
    console.log(`[Procore] prime_contracts CACHE MISS for project ${projectId}, fetching from API…`);

    let contracts: ProcorePrimeContract[] = [];

    // Try multiple endpoint patterns — Procore's API paths differ by version
    const endpoints = [
      { url: `/rest/v1.0/prime_contracts`, params: { project_id: projectId, per_page: 100 }, label: 'v1.0 root' },
      { url: `/rest/v1.1/prime_contracts`, params: { project_id: projectId, per_page: 100 }, label: 'v1.1 root' },
      { url: `/rest/v1.0/projects/${projectId}/prime_contracts`, params: { per_page: 100 }, label: 'v1.0 nested' },
      { url: `/rest/v1.1/projects/${projectId}/prime_contracts`, params: { per_page: 100 }, label: 'v1.1 nested' },
    ];

    for (const ep of endpoints) {
      try {
        console.log(`[Procore] Trying ${ep.label}: ${ep.url}`, ep.params);
        const resp = await getApi().get(ep.url, { params: ep.params });
        const raw = resp.data;
        console.log(`[Procore] ${ep.label} raw response type:`, typeof raw, Array.isArray(raw) ? `array[${raw.length}]` : '');
        const arr = Array.isArray(raw) ? raw : (raw?.data ?? []);
        if (arr.length > 0) {
          console.log(`[Procore] ✓ ${ep.label} returned ${arr.length} contracts`);
          arr.forEach((c: Record<string, unknown>, i: number) => {
            console.log(`[Procore] Contract[${i}]:`, {
              id: c.id, title: c.title, number: c.number,
              vendor: c.vendor, owner: c.owner, status: c.status,
            });
          });
          contracts = arr as ProcorePrimeContract[];
          break; // Found contracts, stop trying
        } else {
          console.log(`[Procore] ${ep.label} returned 0 contracts, trying next…`);
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        console.warn(`[Procore] ${ep.label} failed (${status || 'unknown'}):`, err);
      }
    }

    if (contracts.length === 0) {
      // Last resort: try the singular endpoint which may actually contain real data
      // in some Procore setups (the "Prime Contract" tool vs "Head Contracts" tool)
      try {
        console.log(`[Procore] All list endpoints returned 0. Trying singular prime_contract as last resort…`);
        const resp = await getApi().get('/rest/v1.0/prime_contract', {
          params: { project_id: projectId },
        });
        const raw = resp.data;
        console.log(`[Procore] Singular prime_contract response:`, {
          id: raw?.id, title: raw?.title, number: raw?.number,
          vendor: raw?.vendor, owner: raw?.owner,
          has_line_items: !!raw?.line_items?.length,
        });
        // Only include if it has real data (number, vendor, or line_items)
        if (raw && raw.id && (raw.number || raw.vendor?.name || raw.line_items?.length > 0)) {
          contracts = [raw as ProcorePrimeContract];
          console.log(`[Procore] Singular endpoint has real contract data, using it`);
        } else {
          console.log(`[Procore] Singular endpoint returned template/empty data, skipping`);
        }
      } catch {
        console.warn(`[Procore] Singular prime_contract also failed`);
      }
    }

    // Filter out template entries — real contracts typically have a number
    const filtered = contracts.filter((c) => {
      const isTemplate = /template/i.test(c.title || '') && !c.number && !c.vendor?.name;
      if (isTemplate) console.log(`[Procore] Skipping template contract:`, c.id, c.title);
      return !isTemplate;
    });
    console.log(`[Procore] ${filtered.length} actual contracts (filtered ${contracts.length - filtered.length} templates)`);

    // Only cache non-empty results so we can retry on failure
    if (filtered.length > 0) {
      setCache(cacheKey, filtered);
    }
    return filtered;
  },

  /** Get full details for a single prime contract (includes vendor, line_items, etc.).
   *  Uses v1.1 and v1.0 SHOW endpoints — NOT the v1.0 singular template endpoint. */
  async getPrimeContractDetail(projectId: number, contractId: number): Promise<ProcorePrimeContract | null> {
    const cacheKey = `prime_contract_detail_${contractId}`;
    const cached = getCached<ProcorePrimeContract | null>(cacheKey);
    if (cached) return cached;

    // Try multiple endpoint patterns — root-level with query param AND nested
    const urls = [
      `/rest/v1.0/prime_contracts/${contractId}?project_id=${projectId}`,
      `/rest/v1.1/prime_contracts/${contractId}?project_id=${projectId}`,
      `/rest/v1.1/projects/${projectId}/prime_contracts/${contractId}`,
      `/rest/v1.0/projects/${projectId}/prime_contracts/${contractId}`,
    ];

    for (const url of urls) {
      try {
        console.log(`[Procore] Trying contract detail: ${url}`);
        const resp = await getApi().get(url);
        const raw = resp.data;
        if (raw && typeof raw === 'object' && raw.id) {
          // Verify we got the actual contract, not the template
          if (raw.id !== contractId) {
            console.warn(`[Procore] Detail returned wrong contract id ${raw.id} (wanted ${contractId}), skipping`);
            continue;
          }
          console.log(`[Procore] Contract detail ${contractId} via ${url}:`, {
            id: raw.id, title: raw.title, number: raw.number,
            vendor: raw.vendor, owner: raw.owner,
            contractor: raw.contractor, bill_to: raw.bill_to,
            line_items_count: raw.line_items?.length ?? 'n/a',
          });
          console.log(`[Procore] Contract detail keys:`, Object.keys(raw));
          const result = raw as ProcorePrimeContract;
          setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        console.warn(`[Procore] Contract detail ${contractId} via ${url} failed:`, err);
      }
    }

    console.warn(`[Procore] getPrimeContractDetail(${contractId}) — all endpoints failed`);
    // Don't cache failures so we can retry
    return null;
  },

  /** Get project vendors (companies in the project directory) */
  async getProjectVendors(projectId: number): Promise<Array<{ id: number; name: string; trade?: string; origin_code?: string; business?: string; [key: string]: unknown }>> {
    const cacheKey = `project_vendors_${projectId}`;
    type VendorRecord = { id: number; name: string; trade?: string; origin_code?: string; business?: string; [key: string]: unknown };
    const cached = getCached<VendorRecord[]>(cacheKey);
    if (cached) return cached;

    try {
      const resp = await getApi().get(`/rest/v1.0/projects/${projectId}/vendors`, {
        params: { per_page: 200 },
      });
      const raw = resp.data;
      const arr: VendorRecord[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
      console.log(`[Procore] Project ${projectId} vendors:`, arr.length);
      arr.forEach((v, i) => {
        console.log(`[Procore] Vendor[${i}]:`, { id: v.id, name: v.name, trade: v.trade, origin_code: v.origin_code, business: v.business });
      });
      setCache(cacheKey, arr);
      return arr;
    } catch (err) {
      console.warn(`[Procore] getProjectVendors failed:`, err);
      return [];
    }
  },

  /** Get company directory users (all people in the company) */
  async getCompanyUsers(): Promise<ProcoreUser[]> {
    const cacheKey = 'company_users';
    const cached = getCached<ProcoreUser[]>(cacheKey);
    if (cached) return cached;

    const resp = await getApi().get(
      `/rest/v1.0/companies/${procoreConfig.companyId}/users`,
      { params: { per_page: 500, 'filters[is_active]': true } },
    );
    const users = resp.data as ProcoreUser[];
    console.log(`[Procore API] Retrieved ${users.length} active users from company directory`);
    setCache(cacheKey, users);
    return users;
  },

  /** Get project directory users */
  async getDirectoryUsers(projectId: number): Promise<ProcoreUser[]> {
    const cacheKey = `directory_${projectId}`;
    const cached = getCached<ProcoreUser[]>(cacheKey);
    if (cached) return cached;

    const resp = await getApi().get(`/rest/v1.0/projects/${projectId}/directory`, {
      params: { per_page: 300 },
    });
    const users = resp.data as ProcoreUser[];
    setCache(cacheKey, users);
    return users;
  },

  /** Get company equipment register (v2.1 API) */
  async getEquipment(): Promise<EquipmentItem[]> {
    const cacheKey = 'equipment';
    const cached = getCached<EquipmentItem[]>(cacheKey);
    if (cached) {
      console.log(`[Procore] Equipment from cache: ${cached.length} items`);
      return cached;
    }

    const url = `/rest/v2.1/companies/${procoreConfig.companyId}/equipment_register`;
    console.log(`[Procore] Fetching equipment from ${url}`);
    const resp = await getApi().get(url, { params: { per_page: 300 } });
    const raw = resp.data;
    // v2.1 may return { data: [...] } wrapper or a plain array
    const arr = Array.isArray(raw) ? raw : (raw?.data ?? []);
    console.log(`[Procore] Equipment API response:`, resp.status, `${arr.length} items`, arr.slice(0, 2));
    const items = arr as EquipmentItem[];
    setCache(cacheKey, items);
    return items;
  },

  /**
   * Create a Daily Log note in Procore for the given project & date.
   * Procore REST v1.0: POST /rest/v1.0/projects/{project_id}/notes_logs
   */
  async createDailyLogNote(
    projectId: number,
    date: string,
    subject: string,
    plan: {
      projectNumber?: string;
      subjobCode?: string;
      client?: string;
      location?: string;
      weather?: string;
      crewAssignments?: Array<{ name: string; roles: string[]; startPoint?: string; startTime?: string; plant?: string }>;
      qaRequirements?: Array<{ tool: string; item: string; assignedTo: string; completed: boolean }>;
      plannedWork?: string;
      materials?: string;
      notes?: string;
    },
  ): Promise<void> {
    const body = buildDailyLogComment(subject, plan);

    // POST to notes_logs endpoint
    const url = `/rest/v1.0/projects/${projectId}/notes_logs`;
    console.log(`[Procore] Creating notes log: ${url} for date ${date}`);

    await getApi().post(url, {
      notes_log: {
        date: date,           // YYYY-MM-DD
        comment: body,
      },
    });
  },

  /** Get inspections for a project with optional template filter */
  async getProjectInspections(projectId: number, templateName?: string): Promise<ProcoreInspection[]> {
    const cacheKey = `inspections_${projectId}_${templateName || 'all'}`;
    const cached = getCached<ProcoreInspection[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = `/rest/v1.0/projects/${projectId}/inspections`;
      const resp = await getApi().get(url, { params: { per_page: 200 } });
      let inspections = resp.data as ProcoreInspection[];

      // Filter by template name if provided
      if (templateName) {
        inspections = inspections.filter(i => 
          i.inspection_template?.name?.toLowerCase().includes(templateName.toLowerCase())
        );
      }

      setCache(cacheKey, inspections);
      return inspections;
    } catch (err: any) {
      // 404 means inspections not enabled for this project - return empty array silently
      if (err?.response?.status === 404) {
        return [];
      }
      // Log other errors
      throw err;
    }
  },

  /** Get all inspections across active projects matching a template name */
  async getInspectionsByTemplate(templateName: string): Promise<ProcoreInspection[]> {
    const cacheKey = `inspections_template_${templateName}`;
    const cached = getCached<ProcoreInspection[]>(cacheKey);
    if (cached) return cached;

    // Get active projects first
    const projects = await this.getProjects();
    const activeProjects = projects.filter(p => p.active);

    // Fetch inspections for each active project (silently skip projects without inspections)
    const allInspections: ProcoreInspection[] = [];
    for (const project of activeProjects) {
      try {
        const inspections = await this.getProjectInspections(project.id, templateName);
        allInspections.push(...inspections);
      } catch (err: any) {
        // Only log unexpected errors (404s are already handled in getProjectInspections)
        if (err?.response?.status !== 404) {
          console.warn(`[Procore] Failed to fetch inspections for project ${project.id}:`, err.message);
        }
      }
    }

    setCache(cacheKey, allInspections);
    return allInspections;
  },

  /** Clear cached data (force re-fetch) */
  clearCache() {
    cache.clear();
  },
};
