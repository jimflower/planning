import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlanningEmail, CrewMember, QARequirement } from '@/types/planning.types';
import { DEFAULT_QA_REQUIREMENTS } from '@/lib/constants';
import { todayISO, uuid } from '@/lib/utils/dateHelpers';
import { planApi } from '@/services/plan.service';

/* ── Empty crew row factory ───────────────────────── */
function emptyCrewRow(): CrewMember {
  return {
    id: uuid(),
    name: '',
    startPoint: '',
    startTime: '06:30',
    plant: '',
    roles: [],
  };
}

/* ── Empty planning email factory ─────────────────── */
function emptyPlanningEmail(): PlanningEmail {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    date: todayISO(),
    projectNumber: '',
    subjobCode: '',
    client: '',
    location: '',
    weather: '',
    qaRequirements: DEFAULT_QA_REQUIREMENTS.map((q) => ({ ...q, id: uuid() })),
    plannedWork: '',
    crewAssignments: Array.from({ length: 10 }, () => emptyCrewRow()),
    materials: '',
    notes: '',
    createdBy: '',
    createdAt: now,
    lastModified: now,
  };
}

/* ── Store shape ──────────────────────────────────── */
interface PlanningState {
  currentPlan: PlanningEmail;
  history: PlanningEmail[];
  isDirty: boolean;
  apiConnected: boolean;

  // Header / top-level
  setField: <K extends keyof PlanningEmail>(key: K, value: PlanningEmail[K]) => void;

  // QA
  toggleQA: (id: string) => void;
  addQARow: () => void;
  updateQARow: (id: string, field: keyof QARequirement, value: string | boolean) => void;
  removeQARow: (id: string) => void;

  // Crew
  updateCrew: (id: string, field: keyof CrewMember, value: string | string[]) => void;
  addCrewRow: () => void;
  removeCrewRow: (id: string) => void;

  // Lifecycle
  resetPlan: () => void;
  savePlan: () => Promise<boolean>; // returns true if saved to cloud
  loadPlan: (id: string) => void;
  deletePlan: (id: string) => void;

  // API sync
  syncWithApi: () => Promise<void>;
  loadFromApi: () => Promise<void>;
}

export const usePlanningStore = create<PlanningState>()(
  persist(
    (set, get) => ({
      currentPlan: emptyPlanningEmail(),
      history: [],
      isDirty: false,
      apiConnected: false,

      /* ── generic field setter ─────────────────── */
      setField: (key, value) =>
        set((s) => ({
          currentPlan: { ...s.currentPlan, [key]: value, lastModified: new Date().toISOString() },
          isDirty: true,
        })),

      /* ── QA helpers ───────────────────────────── */
      toggleQA: (id) =>
        set((s) => ({
          currentPlan: {
            ...s.currentPlan,
            qaRequirements: s.currentPlan.qaRequirements.map((q) =>
              q.id === id ? { ...q, completed: !q.completed } : q,
            ),
            lastModified: new Date().toISOString(),
          },
          isDirty: true,
        })),

      addQARow: () =>
        set((s) => ({
          currentPlan: {
            ...s.currentPlan,
            qaRequirements: [
              ...s.currentPlan.qaRequirements,
              { id: uuid(), tool: '', item: '', assignedTo: '', completed: false },
            ],
            lastModified: new Date().toISOString(),
          },
          isDirty: true,
        })),

      updateQARow: (id, field, value) =>
        set((s) => ({
          currentPlan: {
            ...s.currentPlan,
            qaRequirements: s.currentPlan.qaRequirements.map((q) =>
              q.id === id ? { ...q, [field]: value } : q,
            ),
            lastModified: new Date().toISOString(),
          },
          isDirty: true,
        })),

      removeQARow: (id) =>
        set((s) => ({
          currentPlan: {
            ...s.currentPlan,
            qaRequirements: s.currentPlan.qaRequirements.filter((q) => q.id !== id),
            lastModified: new Date().toISOString(),
          },
          isDirty: true,
        })),

      /* ── Crew helpers ─────────────────────────── */
      updateCrew: (id, field, value) =>
        set((s) => ({
          currentPlan: {
            ...s.currentPlan,
            crewAssignments: s.currentPlan.crewAssignments.map((c) =>
              c.id === id ? { ...c, [field]: value } : c,
            ),
            lastModified: new Date().toISOString(),
          },
          isDirty: true,
        })),

      addCrewRow: () =>
        set((s) => ({
          currentPlan: {
            ...s.currentPlan,
            crewAssignments: [...s.currentPlan.crewAssignments, emptyCrewRow()],
            lastModified: new Date().toISOString(),
          },
          isDirty: true,
        })),

      removeCrewRow: (id) =>
        set((s) => ({
          currentPlan: {
            ...s.currentPlan,
            crewAssignments: s.currentPlan.crewAssignments.filter((c) => c.id !== id),
            lastModified: new Date().toISOString(),
          },
          isDirty: true,
        })),

      /* ── Lifecycle ────────────────────────────── */
      resetPlan: () => set({ currentPlan: emptyPlanningEmail(), isDirty: false }),

      savePlan: async () => {
        const { currentPlan, history } = get();
        const exists = history.findIndex((h) => h.id === currentPlan.id);
        const updated =
          exists >= 0
            ? history.map((h) => (h.id === currentPlan.id ? currentPlan : h))
            : [...history, currentPlan];
        set({ history: updated, isDirty: false });

        // Try to persist to API
        try {
          await planApi.save(currentPlan);
          set({ apiConnected: true });
          return true;
        } catch (err) {
          console.warn('[Store] API save failed (data saved locally):', (err as Error).message);
          return false;
        }
      },

      loadPlan: (id) => {
        const { history } = get();
        const found = history.find((h) => h.id === id);
        if (found) set({ currentPlan: { ...found }, isDirty: false });
      },

      deletePlan: (id) => {
        set((s) => ({ history: s.history.filter((h) => h.id !== id) }));

        // Delete from API in background
        planApi.delete(id).catch((err) =>
          console.warn('[Store] API delete failed:', err.message),
        );
      },

      /* ── API sync ─────────────────────────────── */
      /** Push all localStorage plans to the API (one-time migration) */
      syncWithApi: async () => {
        try {
          const { history } = get();
          if (history.length === 0) return;
          const count = await planApi.bulkSync(history);
          set({ apiConnected: true });
          console.log(`[Store] Synced ${count} plans to API`);
        } catch (err) {
          console.warn('[Store] API sync failed:', err);
        }
      },

      /** Load plans from API into the store (merges with localStorage) */
      loadFromApi: async () => {
        try {
          const available = await planApi.isAvailable();
          if (!available) {
            set({ apiConnected: false });
            return;
          }
          set({ apiConnected: true });

          const apiPlans = await planApi.getAll();
          const { history } = get();

          // Merge: API is source of truth, but keep any local plans not in API
          const apiIds = new Set(apiPlans.map((p) => p.id));
          const localOnly = history.filter((h) => !apiIds.has(h.id));

          // Push local-only plans to API
          if (localOnly.length > 0) {
            await planApi.bulkSync(localOnly).catch(() => {});
          }

          // Merge: for plans in both, use the one with the latest lastModified
          const merged = new Map<string, PlanningEmail>();
          for (const p of apiPlans) merged.set(p.id, p);
          for (const p of history) {
            const existing = merged.get(p.id);
            if (!existing || p.lastModified > existing.lastModified) {
              merged.set(p.id, p);
            }
          }

          const allPlans = [...merged.values()].sort(
            (a, b) => b.lastModified.localeCompare(a.lastModified),
          );
          set({ history: allPlans });
          console.log(`[Store] Loaded ${allPlans.length} plans (${apiPlans.length} from API, ${localOnly.length} local-only)`);
        } catch (err) {
          console.warn('[Store] Failed to load from API:', err);
          set({ apiConnected: false });
        }
      },
    }),
    { name: 'daily-planning-hub' },
  ),
);
