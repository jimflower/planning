import type { QARequirement } from '@/types/planning.types';
import { uuid } from '@/lib/utils/dateHelpers';

/** Default QA checklist rows */
export const DEFAULT_QA_REQUIREMENTS: QARequirement[] = [
  { id: uuid(), tool: 'Site Diary', item: 'Site Diary - Crew member', assignedTo: 'Crew member', completed: false },
  { id: uuid(), tool: 'Timesheets', item: 'Timesheet – Crew member', assignedTo: 'Crew member', completed: false },
  { id: uuid(), tool: 'Forms', item: 'Site Risk Assessment – Crew member', assignedTo: 'Crew member', completed: false },
  { id: uuid(), tool: 'Daywork Sheets', item: 'Daywork Sheet and Site Photos - Crew member', assignedTo: 'Crew member', completed: false },
  { id: uuid(), tool: 'Inspections', item: 'Daily Crew Prestart - Crew member', assignedTo: 'Crew member', completed: false },
  { id: uuid(), tool: 'Inspections', item: 'Vehicle Pre-Start – Drivers', assignedTo: 'Drivers', completed: false },
  { id: uuid(), tool: 'Inspections', item: 'QA – (Inspections) – Crew member', assignedTo: 'Crew member', completed: false },
];

/** Preset role options */
export const ROLE_OPTIONS = [
  'Operator',
  'Laborer',
  'Traffic Controller',
  'Lead Hand',
  'Supervisor',
  'Driver',
  'Spotter',
  'Crew Member',
] as const;

/** Season colors (Tailwind classes) */
export const SEASON_STYLES = {
  'Dec-Feb': { bg: 'bg-red-500', text: 'text-white' },
  'Mar-May': { bg: 'bg-green-500', text: 'text-white' },
  'Jun-Aug': { bg: 'bg-blue-500', text: 'text-white' },
  'Sep-Nov': { bg: 'bg-yellow-400', text: 'text-gray-900' },
} as const;
