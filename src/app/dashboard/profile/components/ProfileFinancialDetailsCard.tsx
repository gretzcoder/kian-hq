'use client';

import { useState } from 'react';
import type { BankAccount, EwalletAccount } from '@/modules/profile/actions';

interface ProfileFinancialDetailsCardProps {
  bankAccounts: BankAccount[];
  ewalletAccounts: EwalletAccount[];
  isSelf: boolean;
  canView: boolean;
}

export default function ProfileFinancialDetailsCard({
  bankAccounts = [],
  ewalletAccounts = [],
  isSelf,
  canView,
}: ProfileFinancialDetailsCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // If user does not have permission to view, hide completely
  if (!canView) {
    return null;
  }

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    }
  };

  return (
    <div className="bg-white dark:bg-[#09090b]/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <span className="text-xl">💳</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                Detail Keuangan (Rekening Bank & E-Wallet)
              </h3>
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                🔒 Privat
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Informasi pembayaran & disbursement resmi
            </p>
          </div>
        </div>

        {isSelf && (
          <span className="text-[10px] text-zinc-400 font-medium self-start sm:self-auto">
            Hanya Anda & Pimpinan/Admin yang dapat melihat data ini
          </span>
        )}
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* REKENING BANK */}
        <div className="bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🏦</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                REKENING BANK ({bankAccounts.length})
              </span>
            </div>
          </div>

          {bankAccounts.length === 0 ? (
            <p className="text-xs text-zinc-400 italic py-2">
              Tidak ada rekening bank.
            </p>
          ) : (
            <div className="space-y-2.5">
              {bankAccounts.map((acc, idx) => {
                const copyKey = `bank-${idx}`;
                const isCopied = copiedKey === copyKey;
                return (
                  <div
                    key={acc.id || idx}
                    className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-xs hover:border-purple-500/30 transition-all"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 inline-block mb-1">
                        {acc.bank_name || 'BANK'}
                      </span>
                      <div className="text-sm sm:text-base font-black font-mono text-zinc-900 dark:text-zinc-100 tracking-wider truncate">
                        {acc.account_number}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                        a.n. <span className="font-semibold text-zinc-700 dark:text-zinc-200">{acc.account_holder || '-'}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(acc.account_number, copyKey)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 active:scale-95"
                      title="Salin Nomor Rekening"
                    >
                      {isCopied ? '✓ Tersalin' : '📋 Salin'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* E-WALLET */}
        <div className="bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">📱</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                E-WALLET ({ewalletAccounts.length})
              </span>
            </div>
          </div>

          {ewalletAccounts.length === 0 ? (
            <p className="text-xs text-zinc-400 italic py-2">
              Tidak ada e-wallet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {ewalletAccounts.map((ew, idx) => {
                const copyKey = `ewallet-${idx}`;
                const isCopied = copiedKey === copyKey;
                return (
                  <div
                    key={ew.id || idx}
                    className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-xs hover:border-emerald-500/30 transition-all"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 inline-block mb-1">
                        {ew.wallet_type || 'E-WALLET'}
                      </span>
                      <div className="text-sm sm:text-base font-black font-mono text-zinc-900 dark:text-zinc-100 tracking-wider truncate">
                        {ew.phone_number}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                        a.n. <span className="font-semibold text-zinc-700 dark:text-zinc-200">{ew.account_holder || '-'}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(ew.phone_number, copyKey)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 active:scale-95"
                      title="Salin Nomor E-Wallet"
                    >
                      {isCopied ? '✓ Tersalin' : '📋 Salin'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
