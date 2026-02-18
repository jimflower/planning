import React, { useState } from 'react';
import { usePlanningStore } from '@/store/planningStore';
import { HeaderSection } from './HeaderSection';
import { QARequirements } from './QARequirements';
import { TagsSection } from './TagsSection';
import { PlannedWork } from './PlannedWork';
import { CrewTable } from './CrewTable';
import { MaterialsSection } from './MaterialsSection';
import { NotesSection } from './NotesSection';
import { SendEmailDialog } from './SendEmailDialog';
import { Save, RotateCcw, Send, FilePlus, Cloud, HardDrive, Mail } from 'lucide-react';

export function PlanningForm() {
  const { savePlan, resetPlan, isDirty } = usePlanningStore();
  const [toast, setToast] = useState<{ message: string; type: 'cloud' | 'local' | 'email' } | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const showToast = (message: string, type: 'cloud' | 'local' | 'email') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleNew = () => {
    if (isDirty) {
      const save = confirm('You have unsaved changes. Save before creating a new plan?');
      if (save) savePlan();
    }
    resetPlan();
  };

  const handleSave = async () => {
    const cloud = await savePlan();
    if (cloud) {
      showToast('Plan saved to cloud', 'cloud');
    } else {
      showToast('Plan saved locally', 'local');
    }
  };

  const handleSend = async () => {
    await savePlan();
    setSendDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed right-4 top-20 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'email'
              ? 'bg-primary-600 text-white'
              : toast.type === 'cloud'
                ? 'bg-green-600 text-white'
                : 'bg-amber-500 text-white'
          }`}
        >
          {toast.type === 'email' ? (
            <Mail className="h-4 w-4" />
          ) : toast.type === 'cloud' ? (
            <Cloud className="h-4 w-4" />
          ) : (
            <HardDrive className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Daily Planning Worksheet
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={handleNew} className="btn-secondary flex items-center gap-1.5">
            <FilePlus className="h-4 w-4" />
            New Plan
          </button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-1.5">
            <Save className="h-4 w-4" />
            Save{isDirty ? ' *' : ''}
          </button>
          <button onClick={handleSend} className="btn-secondary flex items-center gap-1.5">
            <Send className="h-4 w-4" />
            Send
          </button>
          <button onClick={resetPlan} className="btn-danger flex items-center gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Form sections */}
      <HeaderSection />
      <QARequirements />
      <TagsSection />
      <PlannedWork />
      <CrewTable />
      <MaterialsSection />
      <NotesSection />

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        onSent={() => showToast('Email sent successfully!', 'email')}
      />
    </div>
  );
}
