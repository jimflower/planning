import React, { useState, useEffect } from 'react';
import { PlanningForm } from '@/components/planning/PlanningForm';
import { procoreService } from '@/services/procore.service';
import { AlertTriangle } from 'lucide-react';

export default function HomePage() {
  const [procoreConnected, setProcoreConnected] = useState(procoreService.isAuthenticated());

  useEffect(() => {
    setProcoreConnected(procoreService.isAuthenticated());
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {!procoreConnected && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-600 dark:bg-yellow-900/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-500" />
          <div>
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-400">
              Procore Not Connected
            </h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              Connect to Procore in{' '}
              <a href="/settings" className="font-medium underline hover:no-underline">
                Settings
              </a>{' '}
              to load the company directory and access crew, equipment, and project data.
            </p>
          </div>
        </div>
      )}
      <PlanningForm />
    </main>
  );
}
