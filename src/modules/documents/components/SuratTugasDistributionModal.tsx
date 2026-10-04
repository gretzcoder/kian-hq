'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getSuratTugasSparksDistributionInfoAction,
  distributeSuratTugasSparksAndBadgesAction,
  MatchedAssigneeInfo,
  SuratTugasSparksInfoResult,
} from '../documentActions';

interface SuratTugasDistributionModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SuratTugasDistributionModal: React.FC<SuratTugasDistributionModalProps> = ({
  documentId,
  isOpen,
  onClose,
}) => {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Loaded distribution info
  const [docInfo, setDocInfo] = useState<SuratTugasSparksInfoResult | null>(null);
  const [defaultSparks, setDefaultSparks] = useState<number>(60);
  const [assignees, setAssignees] = useState<MatchedAssigneeInfo[]>([]);
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; name: string; email: string; student_id_number: string | null; user_type: string | null }>
  >([]);

  // Badge configuration
  const [createBadge, setCreateBadge] = useState<boolean>(true);
  const [badgeTitle, setBadgeTitle] = useState<string>('');
  const [badgeDescription, setBadgeDescription] = useState<string>('');
  const [selectedBadgeIcon, setSelectedBadgeIcon] = useState<string>('🌟');

  const BADGE_ICONS = [
    { label: 'Bintang Event', icon: '🌟' },
    { label: 'Piala Prestasi', icon: '🏆' },
    { label: 'Petir Sparks', icon: '⚡' },
    { label: 'Panggung & Acara', icon: '🎪' },
    { label: 'Kamera / Media', icon: '🎬' },
    { label: 'Garda Tugas', icon: '🛡️' },
    { label: 'Mikrofon / Host', icon: '🎙️' },
    { label: 'Sound / Audio', icon: '🎧' },
  ];

  useEffect(() => {
    if (!isOpen || !documentId) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    getSuratTugasSparksDistributionInfoAction(documentId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setDocInfo(res);
          setDefaultSparks(res.defaultSparks || 60);
          setAssignees(res.assignees || []);
          setAvailableUsers(res.availableUsers || []);
          setBadgeTitle(res.eventName || res.title || 'Event KIAN Troopers');
          setBadgeDescription(
            `Lencana penugasan event ${res.eventName || res.title || ''} (${res.documentNumber || ''})`
          );
        } else {
          setErrorMsg(res.error || 'Gagal memuat data penugasan.');
        }
      })
      .catch((e: any) => {
        if (!isMounted) return;
        setErrorMsg(e.message || 'Terjadi kesalahan sistem.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  // Toggle all assignees attendance
  const allIncluded = assignees.length > 0 && assignees.every((a) => a.included);
  const handleToggleSelectAll = () => {
    const nextState = !allIncluded;
    setAssignees((prev) => prev.map((a) => ({ ...a, included: nextState })));
  };

  // Toggle single assignee
  const handleToggleAssignee = (index: number) => {
    setAssignees((prev) =>
      prev.map((a, i) => (i === index ? { ...a, included: !a.included } : a))
    );
  };

  // Change individual sparks
  const handleChangeSparks = (index: number, val: number) => {
    setAssignees((prev) =>
      prev.map((a, i) => (i === index ? { ...a, sparks: Math.max(0, val) } : a))
    );
  };

  // Change mapped user account for assignee
  const handleChangeMappedUser = (index: number, newUserId: string) => {
    const selected = availableUsers.find((u) => u.id === newUserId);
    setAssignees((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        if (!selected) {
          return { ...a, userId: null, isMatched: false };
        }
        return {
          ...a,
          userId: selected.id,
          userName: selected.name,
          userEmail: selected.email,
          userType: selected.user_type,
          isMatched: true,
        };
      })
    );
  };

  // Apply default sparks to all
  const handleApplyDefaultSparksToAll = () => {
    setAssignees((prev) => prev.map((a) => ({ ...a, sparks: defaultSparks })));
  };

  const includedCount = assignees.filter((a) => a.included && a.userId).length;
  const totalSparksToDistribute = assignees
    .filter((a) => a.included && a.userId)
    .reduce((sum, a) => sum + (Number(a.sparks) || 0), 0);

  const handleSubmit = async () => {
    if (includedCount === 0) {
      setErrorMsg('Pilih setidaknya 1 petugas yang hadir (tercentang) dan terhubung dengan akun KIAN.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        documentId,
        defaultSparks,
        createBadge,
        badgeTitle: createBadge ? badgeTitle.trim() : undefined,
        badgeDescription: createBadge ? badgeDescription.trim() : undefined,
        badgeIconUrl: createBadge ? selectedBadgeIcon : undefined,
        recipients: assignees.map((a) => ({
          userId: a.userId || '',
          name: a.userName || a.rawName,
          nip: a.rawNip,
          role: a.rawRole,
          sparks: a.sparks,
          included: a.included && !!a.userId,
        })),
      };

      const res = await distributeSuratTugasSparksAndBadgesAction(payload);

      if (res.success) {
        setSuccessMsg(
          `✨ Berhasil mendistribusikan ${res.totalSparks} Sparks kepada ${res.recipientCount} petugas! ${
            res.badgeCreated ? `🎖️ Badge '${res.badgeName}' berhasil disematkan.` : ''
          }`
        );
        setTimeout(() => {
          onClose();
          router.refresh();
        }, 1500);
      } else {
        setErrorMsg(res.error || 'Gagal mendistribusikan Sparks.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500 font-bold text-sm">
                ⚡
              </span>
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                  Distribusi Sparks &amp; Badge Penugasan
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  {docInfo?.documentNumber || 'Surat Tugas'}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-lg text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-500">Memuat data personil dan penugasan...</p>
          </div>
        ) : (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Alerts */}
            {errorMsg && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-2xl flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-2xl flex items-center gap-2">
                <span>✓</span>
                <span>{successMsg}</span>
              </div>
            )}

            {docInfo?.existingDistribution && (
              <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300">
                  <span>ℹ️</span>
                  <span>Sparks pernah didistribusikan sebelumnya</span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Total {docInfo.existingDistribution.total_sparks} Sparks telah diberikan kepada{' '}
                  {docInfo.existingDistribution.total_recipients} personil oleh{' '}
                  <strong>{docInfo.existingDistribution.distributed_by_name || 'Admin'}</strong>.
                  Anda dapat mendistribusikan kembali jika ada penambahan / revisi.
                </p>
              </div>
            )}

            {/* Event Summary Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>🎪</span> {docInfo?.eventName}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                  Surat Tugas
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200/50 dark:border-zinc-700/50">
                <div>
                  <span className="text-zinc-400 block">Jadwal / Waktu:</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {docInfo?.eventDays || '-'} ({docInfo?.eventTime})
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Lokasi:</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block">
                    {docInfo?.eventLocation || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Default Sparks Config Bar */}
            <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>✨</span> Besaran Default Sparks
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Standar penugasan: <strong>60 Sparks</strong> per personil (bisa disesuaikan per individu).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={defaultSparks}
                    onChange={(e) => setDefaultSparks(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-20 px-2.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-black text-center text-amber-600 dark:text-amber-400 focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyDefaultSparksToAll}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-xs active:scale-95 transition-all"
                  >
                    Terapkan Semua
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-amber-500/10 text-[10px]">
                <span className="text-zinc-400">Preset Cepat:</span>
                {[30, 50, 60, 80, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setDefaultSparks(val);
                      setAssignees((prev) => prev.map((a) => ({ ...a, sparks: val })));
                    }}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-colors ${
                      defaultSparks === val
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {val} Sparks
                  </button>
                ))}
              </div>
            </div>

            {/* Assignees Verification & Attendance List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Daftar Petugas &amp; Kehadiran Hari H
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold">
                    {includedCount} dari {assignees.length} Hadir
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  {allIncluded ? 'Batalkan Semua' : 'Pilih Semua Hadir'}
                </button>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-200 dark:divide-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                {assignees.map((assignee, idx) => {
                  const isIncluded = assignee.included && !!assignee.userId;

                  return (
                    <div
                      key={idx}
                      className={`p-3 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        !assignee.included
                          ? 'bg-zinc-50 dark:bg-zinc-900/40 opacity-60'
                          : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* Checkbox & Name info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          id={`assignee-${idx}`}
                          checked={assignee.included}
                          onChange={() => handleToggleAssignee(idx)}
                          className="mt-1 w-4 h-4 rounded-md text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <label
                              htmlFor={`assignee-${idx}`}
                              className="font-bold text-xs text-zinc-900 dark:text-zinc-100 cursor-pointer hover:underline"
                            >
                              {assignee.rawName}
                            </label>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono">
                              NIP: {assignee.rawNip}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
                              {assignee.rawRole}
                            </span>
                          </div>

                          {/* Account matching */}
                          <div className="flex items-center gap-1 text-[11px]">
                            {assignee.isMatched ? (
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                                <span>✓ Akun:</span>
                                <strong>{assignee.userName}</strong>
                                {assignee.userEmail && <span className="text-zinc-400">({assignee.userEmail})</span>}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                <span>⚠️ Akun belum terhubung:</span>
                                <select
                                  value={assignee.userId || ''}
                                  onChange={(e) => handleChangeMappedUser(idx, e.target.value)}
                                  className="px-2 py-0.5 text-[10px] rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                                >
                                  <option value="">Pilih Akun User...</option>
                                  {availableUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({u.email})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sparks Amount Input */}
                      <div className="flex items-center justify-end gap-2 pl-7 sm:pl-0">
                        {assignee.included ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-zinc-400">Sparks:</span>
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              value={assignee.sparks}
                              onChange={(e) => handleChangeSparks(idx, parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-center text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-purple-500"
                            />
                            <span className="text-xs">✨</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-400 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                            ❌ Tidak Hadir (0 Sparks)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Badge Shortcut Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-pink-500/5 border border-purple-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎖️</span>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Shortcut Buat Badge Event Otomatis
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Lencana kategori <strong>EVENT</strong> akan otomatis dibuat dan disematkan ke profil petugas yang hadir.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="create-badge-toggle"
                  checked={createBadge}
                  onChange={(e) => setCreateBadge(e.target.checked)}
                  className="w-4 h-4 rounded-md text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>

              {createBadge && (
                <div className="space-y-3 pt-2 border-t border-purple-500/10 text-xs">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                      Nama Badge Event:
                    </label>
                    <input
                      type="text"
                      value={badgeTitle}
                      onChange={(e) => setBadgeTitle(e.target.value)}
                      placeholder="Nama Badge..."
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                      Pilih Ikon Lencana:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {BADGE_ICONS.map((b) => (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => setSelectedBadgeIcon(b.icon)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-all flex items-center gap-1 ${
                            selectedBadgeIcon === b.icon
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-300'
                          }`}
                        >
                          <span>{b.icon}</span>
                          <span>{b.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                      Kategori: EVENT
                    </span>
                    <span>• Langsung terpasang di profil personil.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Summary & Action */}
        {!isLoading && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-zinc-500">
              Total Distribusi:{' '}
              <strong className="text-zinc-900 dark:text-zinc-100 font-black text-sm text-amber-500">
                {totalSparksToDistribute} ✨ Sparks
              </strong>{' '}
              ({includedCount} Petugas Hadir)
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || includedCount === 0}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses Distribusi...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Konfirmasi &amp; Distribusikan Sparks</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
