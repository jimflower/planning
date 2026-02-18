import React from 'react';
import { usePlanningStore } from '@/store/planningStore';
import { ROLE_OPTIONS } from '@/lib/constants';
import { Trash2 } from 'lucide-react';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import type { ProcoreUser } from '@/types/procore.types';

interface CrewRowProps {
  id: string;
  index: number;
  userOptions: ProcoreUser[];
  equipmentOptions: { id: number; label: string }[];
}

export function CrewRow({ id, index, userOptions, equipmentOptions }: CrewRowProps) {
  const { currentPlan, updateCrew, removeCrewRow } = usePlanningStore();
  const crew = currentPlan.crewAssignments.find((c) => c.id === id);
  if (!crew) return null;

  const toggleRole = (role: string) => {
    const next = crew.roles.includes(role)
      ? crew.roles.filter((r) => r !== role)
      : [...crew.roles, role];
    updateCrew(id, 'roles', next);
  };

  return (
    <tr className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50">
      <td className="px-2 py-2 text-center text-xs text-gray-400">{index + 1}</td>
      <td className="px-2 py-2">
        <SearchableSelect
          value={crew.name}
          onChange={(val) => updateCrew(id, 'name', val)}
          placeholder="Select employee…"
          options={userOptions.map((u) => ({ value: u.name, label: u.name }))}
          className="text-sm"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={crew.startPoint}
          onChange={(e) => updateCrew(id, 'startPoint', e.target.value)}
          className="input-field text-sm"
          placeholder="Start point"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="time"
          value={crew.startTime}
          onChange={(e) => updateCrew(id, 'startTime', e.target.value)}
          className="input-field text-sm"
        />
      </td>
      <td className="px-2 py-2">
        <SearchableSelect
          value={crew.plant}
          onChange={(val) => updateCrew(id, 'plant', val)}
          placeholder="Select equipment…"
          options={equipmentOptions.map((eq) => ({ value: eq.label, label: eq.label }))}
          className="text-sm"
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap gap-1">
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                crew.roles.includes(role)
                  ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300 dark:bg-primary-900/30 dark:text-primary-300 dark:ring-primary-500/40'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        <button
          onClick={() => removeCrewRow(id)}
          className="text-gray-400 hover:text-danger-600 transition-colors"
          aria-label="Remove crew member"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
