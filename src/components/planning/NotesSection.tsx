import React from 'react';
import { usePlanningStore } from '@/store/planningStore';

export function NotesSection() {
  const { currentPlan, setField } = usePlanningStore();

  return (
    <div className="section-card">
      <h2 className="section-header">Notes</h2>
      <div className="p-4">
        <textarea
          rows={4}
          value={currentPlan.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Additional notes, reminders, safety briefing points…"
          className="input-field resize-y text-sm"
        />
      </div>
    </div>
  );
}
