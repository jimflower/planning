/* ── Planning domain types ─────────────────────────── */

export interface PlanningEmail {
  id: string;
  date: string; // ISO date string
  projectNumber: string;
  subjobCode: string;
  client: string;
  location: string;
  weather: string;
  qaRequirements: QARequirement[];
  plannedWork: string; // HTML or plain text
  crewAssignments: CrewMember[];
  materials: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  lastModified: string;
  sentAt?: string;
  procoreSyncStatus?: 'pending' | 'synced' | 'error';
  procoreDiaryId?: string;
}

export interface CrewMember {
  id: string;
  name: string;
  procoreUserId?: string;
  startPoint: string;
  startTime: string;
  plant: string;
  procoreEquipmentId?: string;
  roles: string[];
}

export interface QARequirement {
  id: string;
  tool: string;
  item: string;
  assignedTo: string;
  completed: boolean;
}

export interface PlanningTemplate {
  id: string;
  name: string;
  category: string;
  template: Partial<PlanningEmail>;
  createdAt: string;
}

export type Season = 'Dec-Feb' | 'Mar-May' | 'Jun-Aug' | 'Sep-Nov';
