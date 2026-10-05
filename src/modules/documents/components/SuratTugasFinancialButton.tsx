'use client';

import React, { useState } from 'react';
import { SuratTugasFinancialModal } from './SuratTugasFinancialModal';

interface SuratTugasFinancialButtonProps {
  documentId: string;
  variant?: 'compact' | 'full' | 'banner';
  className?: string;
}

export const SuratTugasFinancialButton: React.FC<SuratTugasFinancialButtonProps> = ({
  documentId,
  variant = 'compact',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === 'compact' && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={
            className ||
            'px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs transition-all flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer'
          }
          title="Detail Keuangan Petugas (Rekening Bank & E-Wallet)"
        >
          <span>💳</span>
          <span className="hidden xl:inline">Keuangan</span>
        </button>
      )}

      {variant === 'full' && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={
            className ||
            'px-3.5 py-2.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer'
          }
          title="Lihat & Salin Detail Rekening Bank & E-Wallet Seluruh Petugas"
        >
          <span>💳</span>
          <span>Detail Keuangan Petugas</span>
        </button>
      )}

      {variant === 'banner' && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={
            className ||
            'px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95'
          }
          title="Lihat & Salin Detail Rekening Bank & E-Wallet Seluruh Petugas"
        >
          <span>💳</span>
          <span>Salin Data Keuangan Petugas →</span>
        </button>
      )}

      {isOpen && (
        <SuratTugasFinancialModal
          documentId={documentId}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
