import { WifiOff } from 'lucide-react';

export default function OfflineBlock() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-stone-400">
      <WifiOff size={48} strokeWidth={1.5} />
      <p className="text-lg font-semibold text-stone-600">System is in offline mode</p>
      <p className="text-sm text-center max-w-xs">
        This section requires a live connection. Please wait until the internet is back online.
      </p>
    </div>
  );
}
