/* ── Procore API domain types ──────────────────────── */

export interface ProcoreUser {
  id: number;
  name: string;
  email_address: string;
  job_title: string;
  trade: string;
  is_employee: boolean;
  vendor?: {
    id: number;
    name: string;
  };
  origin_data?: {
    employee_id?: string;
  };
}

export interface EquipmentItem {
  id: number;
  equipment_number: string;
  name: string;
  description: string;
  equipment_type?: {
    id: number;
    name: string;
  };
  status?: string;
  location?: string;
  model_name?: string;
  serial_number?: string;
}

export interface ProcoreCacheItem {
  id: string;
  projectId: string;
  cacheType: 'equipment' | 'directory';
  data: ProcoreUser[] | EquipmentItem[];
  timestamp: string;
  expiresAt: string;
}

export interface ProcoreProject {
  id: number;
  name: string;
  project_number: string;
  company: { id: number; name: string };
  active: boolean;
  parent_id?: number | null;
  code?: string;
  address?: string;
  city?: string;
  state_code?: string;
  description?: string;
  owner?: { id: number; name: string } | null;
  office?: { id: number; name: string } | null;
  phone?: string;
}

export interface ProcorePrimeContract {
  id: number;
  title: string;
  number?: string;
  status?: string;
  contractor?: { id: number; name: string } | null;
  vendor?: { id: number; name: string } | null;
  // The actual client/owner fields
  owner?: { id: number; name: string } | null;
  bill_to?: string | null;
  architect?: { id: number; name: string } | null;
  grand_total?: string;
  description?: string;
  sub_job_id?: number | null;
  sub_job?: { id: number; name: string; code?: string } | null;
  line_items?: Array<{
    id: number;
    cost_code?: { id: number; code: string; name: string } | null;
    sub_job?: { id: number; name: string; code?: string } | null;
  }>;
  // Catch-all for any extra fields
  [key: string]: unknown;
}

export interface ProcoreInspection {
  id: number;
  number: string;
  name: string;
  status: string;
  inspection_date?: string;
  project: { id: number; name: string };
  inspection_template: { id: number; name: string };
  created_at: string;
  updated_at: string;
}

export enum ProcoreErrorType {
  AUTHENTICATION = 'auth_error',
  NETWORK = 'network_error',
  NOT_FOUND = 'not_found',
  PERMISSION = 'permission_denied',
  RATE_LIMIT = 'rate_limit',
  SERVER_ERROR = 'server_error',
}
