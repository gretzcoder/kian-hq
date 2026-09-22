'use client';

import { useState, useEffect } from 'react';
import UserAvatar from '@/components/ui/UserAvatar';
import { UserProfileSnapshot } from '../availabilityTypes';
import { ExclusionSettings } from '../useAvailabilityExclusions';

interface ExclusionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings: ExclusionSettings;
  onSave: (settings: ExclusionSettings) => void;
  onReset: () => void;
  allUsers: UserProfileSnapshot[];
  distinctRoles: { name: string; count: number }[];
}

export default function ExclusionSettingsModal({
  isOpen,
  onClose,
  initialSettings,
  onSave,
  onReset,
  allUsers,
  distinctRoles,
}: ExclusionSettingsModalProps) {
  const [tempSettings, setTempSettings] = useState<ExclusionSettings>(initialSettings);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTempSettings(initialSettings);
      setSearchQuery('');
    }
  }, [isOpen, initialSettings]);

  if (!isOpen) return null;

  const filteredUsers = allUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.roleName || '').toLowerCase().includes(q) ||
      (u.university || '').toLowerCase().includes(q) ||
      (u.studentIdNumber || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                Pengaturan Koordinator
              </span>
            </div>
            <h3 className="text-lg font-black text-zinc-900 dark:text-white mt-1">
              Pengaturan Pengecualian Personil & Role
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Kecualikan role tertentu (misal Executive/Koordinator) atau user tertentu agar tidak muncul di daftar tugas harian, direktori, & matriks.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Pengecualian Berdasarkan Role */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>1. Pengecualian Berdasarkan Role</span>
              </h4>
              <span className="text-[10px] text-zinc-400">
                Centang role yang ingin <strong>disembunyikan</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {distinctRoles.map((r) => {
                const isChecked = tempSettings.excludedRoles.some(
                  (role) => role.toLowerCase() === r.name.toLowerCase()
                );

                return (
                  <label
                    key={r.name}
                    className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-950 dark:text-amber-200'
                        : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTempSettings({
                              ...tempSettings,
                              excludedRoles: [...tempSettings.excludedRoles, r.name],
                            });
                          } else {
                            setTempSettings({
                              ...tempSettings,
                              excludedRoles: tempSettings.excludedRoles.filter(
                                (role) => role.toLowerCase() !== r.name.toLowerCase()
                              ),
                            });
                          }
                        }}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold">{r.name}</span>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {r.count} Orang
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 2. Pengecualian User Spesifik */}
          <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                <span>👤</span>
                <span>2. Pengecualian Personil Spesifik</span>
              </h4>
              <span className="text-[10px] text-zinc-400">
                {tempSettings.excludedUserIds.length} personil terpilih
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama personil untuk dikecualikan..."
                className="w-full pl-8 pr-3 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <span className="absolute left-2.5 top-2.5 text-xs text-zinc-400">🔍</span>
            </div>

            {/* User selection list */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {filteredUsers.map((u) => {
                const isUserExcluded = tempSettings.excludedUserIds.includes(u.id);
                const isRoleExcluded = tempSettings.excludedRoles.some(
                  (r) => r.toLowerCase() === (u.roleName || 'Trooper').toLowerCase()
                );

                return (
                  <label
                    key={u.id}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      isUserExcluded
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isUserExcluded}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTempSettings({
                              ...tempSettings,
                              excludedUserIds: [...tempSettings.excludedUserIds, u.id],
                            });
                          } else {
                            setTempSettings({
                              ...tempSettings,
                              excludedUserIds: tempSettings.excludedUserIds.filter(
                                (id) => id !== u.id
                              ),
                            });
                          }
                        }}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 shrink-0"
                      />
                      <UserAvatar src={u.avatarUrl} name={u.name} size="xs" square />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {u.name}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate">
                          {u.roleName || 'Trooper'} • {u.university || 'Kian HQ'}
                        </p>
                      </div>
                    </div>

                    {isRoleExcluded && (
                      <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                        Otomatis (Role)
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
          <button
            type="button"
            onClick={() => {
              setTempSettings({ excludedRoles: [], excludedUserIds: [] });
              onReset();
            }}
            className="text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline"
          >
            Kosongkan Semua Pengecualian
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => onSave(tempSettings)}
              className="px-5 py-2 rounded-2xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md transition-all active:scale-95"
            >
              Terapkan & Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
