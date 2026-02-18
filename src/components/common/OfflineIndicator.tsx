import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-danger-600 px-4 py-2 text-sm font-medium text-white shadow-elevated print:hidden">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4" />
        You are offline — changes saved locally
      </div>
    </div>
  );
}
