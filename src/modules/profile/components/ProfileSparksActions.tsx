'use client';

import { useState } from 'react';
import SparksHistoryModal from '@/modules/leaderboard/components/SparksHistoryModal';

interface ProfileSparksActionsProps {
  targetUserId: string;
  targetUserName: string;
  canManageSparks: boolean;
  totalSparks: number;
}

export default function ProfileSparksActions({
  targetUserId,
  targetUserName,
  canManageSparks,
  totalSparks,
}: ProfileSparksActionsProps) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  return (
    <div className="flex flex-col items-center sm:items-end gap-2 shrink-0">
      {/* Clickable Total Sparks Badge Card */}
      <button
        type="button"
        onClick={() => setShowHistoryModal(true)}
        className="flex items-center justify-center gap-2 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl shrink-0 transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-xs cursor-pointer group"
        title="Klik untuk melihat riwayat lengkap & kelola Sparks"
      >
        <span className="text-lg sm:text-xl group-hover:rotate-12 transition-transform">✨</span>
        <div className="text-center sm:text-left">
          <p className="text-base sm:text-lg font-black text-purple-700 dark:text-purple-300 leading-none">
            {totalSparks} Sparks
          </p>
          <p className="text-[8px] sm:text-[9px] text-purple-600/80 dark:text-purple-400/80 font-bold uppercase tracking-wider flex items-center gap-0.5 mt-0.5">
            <span>{canManageSparks ? 'Kelola & Log Sparks' : 'Total Terkumpul'}</span>
            <span className="text-[9px] font-mono group-hover:translate-x-0.5 transition-transform">↗</span>
          </p>
        </div>
      </button>

      {/* Sparks History & Management Modal (Single Source Design) */}
      <SparksHistoryModal
        userId={targetUserId}
        userName={targetUserName}
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        period="all"
        canManageSparks={canManageSparks}
      />
    </div>
  );
}
