import React from 'react';
import { usePlanningStore } from '@/store/planningStore';

export function MaterialsSection() {
  const { currentPlan, setField } = usePlanningStore();

  return (
    <div className="section-card">
      <h2 className="section-header">Materials</h2>
      <div className="p-4">
        <textarea
          rows={4}
          value={currentPlan.materials}
          onChange={(e) => setField('materials', e.target.value)}
          placeholder="List materials required for the day&#10;&#10;• Item — Qty — Supplier"
          className="input-field resize-y text-sm"
        />
      </div>
    </div>
  );
}
