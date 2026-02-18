import React from 'react';
import { usePlanningStore } from '@/store/planningStore';
import { useProcoreData } from '@/hooks/useProcoreData';
import { Plus, Trash2 } from 'lucide-react';
import { SearchableSelect } from '@/components/common/SearchableSelect';

export function QARequirements() {
  const { currentPlan, toggleQA, addQARow, updateQARow, removeQARow } = usePlanningStore();
  const { users } = useProcoreData();
  const qa = currentPlan.qaRequirements;

  // Sort users alphabetically for the dropdown
  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="section-card">
      <div className="flex items-center justify-between">
        <h2 className="section-header flex-1">QA Requirements</h2>
        <button
          onClick={addQARow}
          className="mr-4 mt-2 flex items-center gap-1 rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add Row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              <th className="w-10 px-3 py-2 text-center">✓</th>
              <th className="px-3 py-2">Procore Tool</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Assigned To</th>
              <th className="w-10 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {qa.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
              >
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={row.completed}
                    onChange={() => toggleQA(row.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.tool}
                    onChange={(e) => updateQARow(row.id, 'tool', e.target.value)}
                    className="input-field text-sm"
                    placeholder="Tool"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.item}
                    onChange={(e) => updateQARow(row.id, 'item', e.target.value)}
                    className="input-field text-sm"
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-2">
                  <SearchableSelect
                    value={row.assignedTo}
                    onChange={(val) => updateQARow(row.id, 'assignedTo', val)}
                    placeholder="Select employee…"
                    options={sortedUsers.map((u) => ({ value: u.name, label: u.name }))}
                    className="text-sm"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => removeQARow(row.id)}
                    className="text-gray-400 hover:text-danger-600 transition-colors"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
