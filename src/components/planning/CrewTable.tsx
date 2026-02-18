import React from 'react';
import { usePlanningStore } from '@/store/planningStore';
import { useProcoreData } from '@/hooks/useProcoreData';
import { CrewRow } from './CrewRow';
import { Plus, Loader2 } from 'lucide-react';

export function CrewTable() {
  const { currentPlan, addCrewRow } = usePlanningStore();
  const { users, equipment, loading, connected } = useProcoreData();

  // Sort users alphabetically
  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));
  // Build equipment options
  const equipmentOptions = [...equipment]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map((e) => ({
      id: e.id,
      label: e.equipment_number ? `${e.name} (${e.equipment_number})` : (e.name || `Equipment #${e.id}`),
    }));

  return (
    <div className="section-card">
      <div className="flex items-center justify-between">
        <h2 className="section-header flex-1">Crew Assignments</h2>
        <button
          onClick={addCrewRow}
          className="mr-4 mt-2 flex items-center gap-1 rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add Row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              <th className="w-8 px-2 py-2 text-center">#</th>
              <th className="min-w-[140px] px-2 py-2">Name</th>
              <th className="min-w-[120px] px-2 py-2">Start Point</th>
              <th className="w-24 px-2 py-2">Time</th>
              <th className="min-w-[160px] px-2 py-2">Plant / Equipment</th>
              <th className="min-w-[240px] px-2 py-2">Roles</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {currentPlan.crewAssignments.map((crew, index) => (
              <CrewRow
                key={crew.id}
                id={crew.id}
                index={index}
                userOptions={sortedUsers}
                equipmentOptions={equipmentOptions}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-100 p-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {currentPlan.crewAssignments.length} crew member(s)
        {connected && (
          <span className="ml-2">
            {loading ? (
              <span className="inline-flex items-center gap-1 text-primary-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading Procore data…
              </span>
            ) : (
              <span className="text-success-600">· Procore: {sortedUsers.length} users, {equipmentOptions.length} equipment</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
