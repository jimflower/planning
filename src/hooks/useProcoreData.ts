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
          // Filter to GNB Energy employees only
          // Include: is_employee = true AND (no vendor OR vendor contains "gnb")
          const employees = all.filter((u) =>
            u.is_employee === true &&
            (!u.vendor || /gnb/i.test(u.vendor.name))
          );
          console.log(`[Procore] Loaded ${all.length} users, filtered to ${employees.length} GNB employees`);
          
          // Debug: log filtered out users to find missing ones
          const filtered = all.filter((u) => {
            const keep = u.is_employee === true && (!u.vendor || /gnb/i.test(u.vendor.name));
            return !keep;
          });
          if (filtered.length > 0) {
            console.log(`[Procore] Filtered out ${filtered.length} non-GNB users:`, 
              filtered.slice(0, 5).map(u => ({ name: u.name, is_employee: u.is_employee, vendor: u.vendor?.name }))
            );
          }
          
          setUsers(employees);
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
