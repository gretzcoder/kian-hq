'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { stopImpersonatingUser } from '../impersonationActions';

interface ImpersonationBannerProps {
  impersonatedName: string;
  impersonatedEmail: string;
  realAdminName?: string;
}

export default function ImpersonationBanner({
  impersonatedName,
  impersonatedEmail,
  realAdminName,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleExit = () => {
    startTransition(async () => {
      await stopImpersonatingUser();
      router.refresh();
    });
  };

  return (
    <div className="sticky top-0 z-[9999] w-full bg-gradient-to-r from-purple-600/95 via-indigo-600/95 to-blue-600/95 border-b border-purple-500/40 backdrop-blur-md px-4 py-2.5 sm:px-8 text-xs sm:text-sm font-medium flex flex-wrap items-center justify-between gap-3 shadow-xl transition-all animate-in fade-in duration-300">
      <div className="flex items-center gap-2.5 text-white">
        <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-500 animate-pulse text-sm">
          🎭
        </div>
        <div>
          <span className="font-semibold text-white">
            Impersonating User:
          </span>{' '}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-white/20 text-white border border-white/30 ml-1">
            {impersonatedName} ({impersonatedEmail})
          </span>
          {realAdminName && (
            <span className="hidden sm:inline-block text-purple-200 ml-2 text-xs">
              (Admin: {realAdminName})
            </span>
          )}
        </div>
      </div>

      <button
        disabled={isPending}
        onClick={handleExit}
        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 shadow-sm disabled:opacity-50 ml-auto sm:ml-0"
        title="Exit Impersonation mode and return to your admin account"
      >
        <span>✕</span>
        <span>Exit Impersonation</span>
      </button>
    </div>
  );
}
