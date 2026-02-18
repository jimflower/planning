import React from 'react';
import { getSeason } from '@/lib/utils/dateHelpers';
import { SEASON_STYLES } from '@/lib/constants';
import { usePlanningStore } from '@/store/planningStore';
import { cn } from '@/lib/utils/cn';

const TAG_GROUPS: Record<string, string[]> = {
  'Dec-Feb': ['UV / Sun Protection', 'Hydration', 'Heat Stress Plan', 'Bushfire Risk', 'Storm Season Prep'],
  'Mar-May': ['Wet Weather PPE', 'Early Darkness', 'Fog / Visibility', 'Cool Start Protocol'],
  'Jun-Aug': ['Cold Start Protocol', 'Frost / Ice', 'Short Daylight', 'Wet Ground', 'Warm Layers PPE'],
  'Sep-Nov': ['Allergy / Hay Fever', 'Variable Weather', 'Increasing UV', 'Wind Gusts', 'Spring Storms'],
};

export function TagsSection() {
  const { currentPlan } = usePlanningStore();
  const season = getSeason(currentPlan.date);
  const tags = TAG_GROUPS[season] ?? [];
  const style = SEASON_STYLES[season];

  return (
    <div className="section-card">
      <h2 className="section-header-green">Check Your Tags</h2>
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn('rounded-full px-3 py-1 text-xs font-bold', style.bg, style.text)}>
            {season}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Season-specific safety tags for today&apos;s plan
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700 ring-1 ring-inset ring-success-600/20 dark:bg-success-900/20 dark:text-success-300 dark:ring-success-500/30"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
