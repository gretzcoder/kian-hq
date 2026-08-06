'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startImpersonatingUser, stopImpersonatingUser, ImpersonateUserItem } from '../impersonationActions';

interface ImpersonationBannerProps {
  impersonatedName: string;
  impersonatedEmail: string;
  realAdminName?: string;
  currentUserId?: string;
  availableUsers?: ImpersonateUserItem[];
}

export default function ImpersonationBanner({
  impersonatedName,
  impersonatedEmail,
  realAdminName,
  currentUserId,
  availableUsers = [],
}: ImpersonationBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleExit = () => {
    startTransition(async () => {
      await stopImpersonatingUser();
      router.refresh();
    });
  };

  const handleUserChange = (userId: string) => {
    startTransition(async () => {
      if (userId === 'EXIT') {
        await stopImpersonatingUser();
      } else {
        await startImpersonatingUser(userId);
      }
      router.refresh();
    });
  };

  return (
    <div className="sticky top-0 z-[9999] w-full bg-gradient-to-r from-purple-700/95 via-indigo-700/95 to-blue-700/95 border-b border-purple-500/40 backdrop-blur-md px-4 py-2.5 sm:px-8 text-xs sm:text-sm font-medium flex flex-wrap items-center justify-between gap-3 shadow-xl transition-all animate-in fade-in duration-300">
      <div className="flex items-center gap-2.5 text-white flex-wrap">
        <div className="p-1 rounded-lg bg-white/20 text-white animate-pulse text-sm">
          🎭
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-white">
            Impersonating Account:
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-white/20 text-white border border-white/30">
            {impersonatedName} ({impersonatedEmail})
          </span>
          {realAdminName && (
            <span className="hidden md:inline-block text-purple-200 text-xs">
              (Real Account: {realAdminName})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 ml-auto sm:ml-0">
        {/* User Switcher Dropdown */}
        {availableUsers.length > 0 && (
          <div className="relative">
            <select
              disabled={isPending}
              value={currentUserId || ''}
              onChange={(e) => handleUserChange(e.target.value)}
              className="appearance-none bg-white/15 hover:bg-white/25 text-white border border-white/30 rounded-xl px-3 py-1.5 pr-8 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
            >
              <option value="" disabled className="bg-zinc-900 text-white">
                Switch User...
              </option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id} className="bg-zinc-900 text-white">
                  Switch to: {u.name} ({u.roleName})
                </option>
              ))}
              <option value="EXIT" className="bg-zinc-900 text-red-400 font-bold">
                🚫 Exit Impersonation
              </option>
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/80 text-[10px]">
              {isPending ? '⏳' : '▼'}
            </div>
          </div>
        )}

        {/* Exit Button */}
        <button
          disabled={isPending}
          onClick={handleExit}
          className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-200 active:scale-95 shadow-md disabled:opacity-50"
          title="Exit Impersonation mode and return to your real account"
        >
          <span>✕</span>
          <span>Exit Impersonation</span>
        </button>
      </div>
    </div>
  );
}
