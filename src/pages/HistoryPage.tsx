import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanningStore } from '@/store/planningStore';
import { formatDate } from '@/lib/utils/dateHelpers';
import { Trash2, FileText } from 'lucide-react';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { history, loadPlan, deletePlan } = usePlanningStore();

  const handleLoad = (id: string) => {
    loadPlan(id);
    navigate('/');
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Planning History</h1>

      {history.length === 0 ? (
        <div className="section-card p-8 text-center text-gray-500 dark:text-gray-400">
          <FileText className="mx-auto mb-3 h-12 w-12 opacity-40" />
          <p>No saved plans yet. Create and save your first daily plan!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history
            .slice()
            .sort((a, b) => b.lastModified.localeCompare(a.lastModified))
            .map((plan) => (
              <div
                key={plan.id}
                className="section-card flex items-center justify-between p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {plan.projectNumber || 'Untitled'} — {plan.client || 'No client'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(plan.date)} · {plan.location || 'No location'} ·{' '}
                    {plan.crewAssignments.filter((c) => c.name).length} crew
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLoad(plan.id)}
                    className="btn-primary text-xs"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this saved plan?')) deletePlan(plan.id);
                    }}
                    className="text-gray-400 hover:text-danger-600 transition-colors"
                    aria-label="Delete plan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </main>
  );
}
