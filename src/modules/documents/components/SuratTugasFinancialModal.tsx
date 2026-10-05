'use client';

import React, { useState, useEffect } from 'react';
import {
  getSuratTugasFinancialDetailsAction,
  OfficerFinancialInfo,
  SuratTugasFinancialDetailsResult,
} from '../documentActions';

interface SuratTugasFinancialModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SuratTugasFinancialModal: React.FC<SuratTugasFinancialModalProps> = ({
  documentId,
  isOpen,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SuratTugasFinancialDetailsResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen || !documentId) return;

    let isMounted = true;
    setIsLoading(true);

    getSuratTugasFinancialDetailsAction(documentId)
      .then((res) => {
        if (!isMounted) return;
        setData(res);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handleCopyTsv = () => {
    if (!data?.officers) return;
    let tsv = 'No\tNama Petugas\tPeran\tNIM/NIP\tKategori\tNama Bank/Provider\tNomor Rekening/HP\tAtas Nama\n';
    let rowNum = 1;
    data.officers.forEach((off) => {
      if (!off.hasDetails) {
        tsv += `${rowNum++}\t${off.name}\t${off.role}\t${off.nimOrNip}\tBelum Ada\t-\t-\t-\n`;
      } else {
        off.bankAccounts.forEach((b) => {
          tsv += `${rowNum++}\t${off.name}\t${off.role}\t${off.nimOrNip}\tRekening Bank\t${b.bank_name}\t'${b.account_number}\t${b.account_name}\n`;
        });
        off.ewallets.forEach((e) => {
          tsv += `${rowNum++}\t${off.name}\t${off.role}\t${off.nimOrNip}\tE-Wallet\t${e.provider}\t'${e.account_number}\t${e.account_name}\n`;
        });
      }
    });
    handleCopy(tsv, 'all_tsv');
  };

  const officers = data?.officers || [];
  const filteredOfficers = officers.filter((off) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      off.name.toLowerCase().includes(q) ||
      off.role.toLowerCase().includes(q) ||
      off.nimOrNip.toLowerCase().includes(q) ||
      off.bankAccounts.some((b) => b.bank_name.toLowerCase().includes(q) || b.account_number.includes(q)) ||
      off.ewallets.some((e) => e.provider.toLowerCase().includes(q) || e.account_number.includes(q))
    );
  });

  const totalOfficers = officers.length;
  const completeOfficers = officers.filter((o) => o.hasDetails).length;
  const incompleteOfficers = totalOfficers - completeOfficers;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[1050] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[92vh] flex flex-col z-[1051] transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
              💳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                  Detail Keuangan Petugas
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[10px] font-bold font-mono">
                  {data?.documentNumber || 'Surat Tugas'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {data?.eventName || 'Pencairan honorarium, transport, & logistik petugas resmi KIAN'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-bold flex items-center justify-center text-sm transition-all shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-400 font-bold">Memuat data rekening & e-wallet petugas...</p>
          </div>
        ) : !data?.success ? (
          <div className="p-6 text-center bg-red-500/10 border border-red-500/20 rounded-2xl space-y-2">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">
              {data?.error || 'Gagal memuat detail keuangan.'}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-xs font-bold"
            >
              Tutup
            </button>
          </div>
        ) : (
          <>
            {/* Top Stats & Quick Copy Bar */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold">
                  👥 {totalOfficers} Petugas
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                  ✅ {completeOfficers} Lengkap
                </span>
                {incompleteOfficers > 0 && (
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold">
                    ⚠️ {incompleteOfficers} Belum Isi
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleCopyTsv}
                  className={`flex-1 md:flex-none px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border active:scale-95 cursor-pointer ${
                    copiedKey === 'all_tsv'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/80'
                  }`}
                  title="Salin dalam format tabel yang langsung dapat di-paste ke Excel / Google Sheets"
                >
                  <span>{copiedKey === 'all_tsv' ? '✅' : '📊'}</span>
                  <span>{copiedKey === 'all_tsv' ? 'Format Excel Tersalin!' : 'Salin Format Excel'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(data.recapText || '', 'all_text')}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer ${
                    copiedKey === 'all_text'
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20'
                  }`}
                  title="Salin rekap ringkas seluruh petugas untuk WhatsApp / Catatan"
                >
                  <span>{copiedKey === 'all_text' ? '✅' : '📋'}</span>
                  <span>{copiedKey === 'all_text' ? 'Rekap Tersalin!' : 'Salin Semua Rekap (WA)'}</span>
                </button>
              </div>
            </div>

            {/* Filter Search Input */}
            {officers.length > 3 && (
              <div className="relative shrink-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama petugas, peran, bank, atau nomor rekening..."
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 rounded-xl px-3.5 py-2 pl-9 focus:outline-none focus:border-emerald-500 transition-all placeholder:text-zinc-400 font-medium"
                />
                <span className="absolute left-3 top-2.5 text-xs text-zinc-400">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Officer Cards List */}
            <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0">
              {filteredOfficers.length === 0 ? (
                <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 text-xs">
                  Tidak ada petugas yang cocok dengan pencarian &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredOfficers.map((off, idx) => {
                  const singleOfficerRecap = (() => {
                    let txt = `${off.name} (${off.role})\n`;
                    if (!off.hasDetails) {
                      txt += `- (Belum mengisi rekening bank / e-wallet)\n`;
                    } else {
                      off.bankAccounts.forEach((b) => {
                        txt += `- Rek. ${b.bank_name}: ${b.account_number} (a.n. ${b.account_name})\n`;
                      });
                      off.ewallets.forEach((e) => {
                        txt += `- E-Wallet ${e.provider}: ${e.account_number} (a.n. ${e.account_name})\n`;
                      });
                    }
                    return txt.trim();
                  })();

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-emerald-500/30 transition-all space-y-3"
                    >
                      {/* Officer Info Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-zinc-200/60 dark:border-zinc-800">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-xs shrink-0">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                                {off.name}
                              </h4>
                              <span className="px-2 py-0.5 rounded-lg bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-black uppercase tracking-wider">
                                {off.role}
                              </span>
                              {off.nimOrNip && off.nimOrNip !== '-' && (
                                <span className="text-[10px] font-mono text-zinc-400">
                                  NIM: {off.nimOrNip}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick single officer copy button */}
                        {off.hasDetails && (
                          <button
                            type="button"
                            onClick={() => handleCopy(singleOfficerRecap, `off_${idx}`)}
                            className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                          >
                            <span>{copiedKey === `off_${idx}` ? '✅' : '📋'}</span>
                            <span>{copiedKey === `off_${idx}` ? 'Info Disalin!' : 'Salin Info Petugas'}</span>
                          </button>
                        )}
                      </div>

                      {/* Financial Detail Grid */}
                      {!off.hasDetails ? (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
                            <span>⚠️</span>
                            <span>Petugas belum melengkapi rekening bank atau e-wallet di profil akunnya.</span>
                          </div>
                          {off.whatsappNumber && (
                            <a
                              href={`https://wa.me/${off.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                `Halo ${off.name}, mohon segera lengkapi detail rekening bank/e-wallet di profil platform KIAN HQ untuk keperluan pencairan event "${data.eventName}". Terima kasih!`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all"
                            >
                              <span>💬</span>
                              <span>Ingatkan via WA</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Rekening Bank */}
                          {off.bankAccounts.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                                <span>🏦</span> Rekening Bank ({off.bankAccounts.length})
                              </p>
                              <div className="space-y-1.5">
                                {off.bankAccounts.map((b, bIdx) => {
                                  const copyId = `b_${idx}_${bIdx}`;
                                  return (
                                    <div
                                      key={bIdx}
                                      className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">
                                            {b.bank_name}
                                          </span>
                                          <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                                            {b.account_number}
                                          </span>
                                        </div>
                                        <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate">
                                          a.n. {b.account_name}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleCopy(b.account_number, copyId)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                                          copiedKey === copyId
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                                        }`}
                                        title="Salin nomor rekening saja"
                                      >
                                        <span>{copiedKey === copyId ? '✅' : '📋'}</span>
                                        <span>{copiedKey === copyId ? 'Disalin' : 'Salin'}</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* E-Wallets */}
                          {off.ewallets.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                                <span>📱</span> E-Wallet ({off.ewallets.length})
                              </p>
                              <div className="space-y-1.5">
                                {off.ewallets.map((e, eIdx) => {
                                  const copyId = `e_${idx}_${eIdx}`;
                                  return (
                                    <div
                                      key={eIdx}
                                      className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                                            {e.provider}
                                          </span>
                                          <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                                            {e.account_number}
                                          </span>
                                        </div>
                                        <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate">
                                          a.n. {e.account_name}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleCopy(e.account_number, copyId)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                                          copiedKey === copyId
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                                        }`}
                                        title="Salin nomor e-wallet saja"
                                      >
                                        <span>{copiedKey === copyId ? '✅' : '📋'}</span>
                                        <span>{copiedKey === copyId ? 'Disalin' : 'Salin'}</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
