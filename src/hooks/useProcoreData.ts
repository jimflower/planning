import { useState, useEffect } from 'react';
import { procoreService } from '@/services/procore.service';
import type { ProcoreUser, EquipmentItem, ProcoreProject } from '@/types/procore.types';

/** Reactive hook for Procore data — returns cached users, equipment, projects */
export function useProcoreData(projectId?: number) {
  const [users, setUsers] = useState<ProcoreUser[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [projects, setProjects] = useState<ProcoreProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = procoreService.isConfigured() && procoreService.isAuthenticated();

  useEffect(() => {
    if (!connected) return;

    setLoading(true);
    setError(null);

    const promises: Promise<void>[] = [];

    // Always fetch company users (employees only) + equipment
    promises.push(
      procoreService.getCompanyUsers()
        .then((all) => {
          // API already filters for is_employee: true via params
          // Just log and use all returned users
          console.log(`[Procore] Loaded ${all.length} active employees from company directory`);
          setUsers(all);
        })
        .catch((err) => console.error('[Procore] Failed to fetch users:', err)),
      procoreService.getEquipment()
        .then((items) => {
          console.log(`[Procore] Loaded ${items.length} equipment items`, items.slice(0, 3));
          setEquipment(items);
        })
        .catch((err) => console.error('[Procore] Failed to fetch equipment:', err)),
      procoreService.getProjects()
        .then(setProjects)
        .catch((err) => console.error('[Procore] Failed to fetch projects:', err)),
    );

    // Also fetch project-specific directory if provided
    if (projectId) {
      promises.push(
        procoreService.getDirectoryUsers(projectId)
          .then((projUsers) => setUsers((prev) => {
            const ids = new Set(prev.map((u) => u.id));
            return [...prev, ...projUsers.filter((u) => !ids.has(u.id))];
          }))
          .catch((err) => console.error('[Procore] Failed to fetch project users:', err)),
      );
    }

    Promise.allSettled(promises)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load Procore data'))
      .finally(() => setLoading(false));
  }, [connected, projectId]);

  return { users, equipment, projects, loading, error, connected };
}
