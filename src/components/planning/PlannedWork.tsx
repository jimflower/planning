import React from 'react';
import { usePlanningStore } from '@/store/planningStore';

export function PlannedWork() {
  const { currentPlan, setField } = usePlanningStore();

  return (
    <div className="section-card">
      <h2 className="section-header">Planned Work</h2>
      <div className="p-4">
        <textarea
          rows={6}
          value={currentPlan.plannedWork}
          onChange={(e) => setField('plannedWork', e.target.value)}
          placeholder="Describe the planned work activities for the day&#10;&#10;• Task 1 — description&#10;• Task 2 — description"
          className="input-field resize-y font-mono text-sm"
        />
      </div>
    </div>
  );
}
