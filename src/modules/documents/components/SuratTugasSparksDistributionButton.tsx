'use client';

import React, { useState } from 'react';
import { SuratTugasDistributionModal } from './SuratTugasDistributionModal';

interface SuratTugasSparksDistributionButtonProps {
  documentId: string;
  isOfficial: boolean;
  canManage: boolean;
  hasDistributed?: boolean;
  totalSparks?: number;
}

export const SuratTugasSparksDistributionButton: React.FC<SuratTugasSparksDistributionButtonProps> = ({
  documentId,
  isOfficial,
  canManage,
  hasDistributed = false,
  totalSparks,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!canManage || !isOfficial) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
          hasDistributed
            ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/20'
        }`}
        title="Distribusi Sparks Otomatis & Buat Badge Event untuk Petugas"
      >
        <span>⚡</span>
        <span>{hasDistributed ? `Distribusi Ulang (${totalSparks} ✨)` : 'Distribusi Sparks & Badge'}</span>
      </button>

      {isOpen && (
        <SuratTugasDistributionModal
          documentId={documentId}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
