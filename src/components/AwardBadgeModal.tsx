'use client';

import { useState, useEffect, useTransition } from 'react';
import { BadgeItem } from '@/modules/badges/badgeTypes';
import { awardBadgeToUsersAction, getBadgeRequirementOptions } from '@/modules/badges/badgeActions';

interface AwardBadgeModalProps {
  badge: BadgeItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AwardBadgeModal({
  badge,
  isOpen,
  onClose,
  onSuccess,
}: AwardBadgeModalProps) {
  const [users, setUsers] = useState<{ id: string; name: string; email: string; userType: string | null; roleNames: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getBadgeRequirementOptions().then((res) => {
        setUsers(res.users);
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const handleSelectByRole = (roleType: 'TROOPER' | 'MENTOR' | 'STAFF' | 'ALL') => {
    if (roleType === 'ALL') {
      setSelectedUserIds(users.map((u) => u.id));
      return;
    }
    const matched = users.filter((u) => {
      if (roleType === 'STAFF') return u.userType === 'STAFF';
      if (roleType === 'MENTOR') return u.roleNames.includes('MENTOR') || u.roleNames.includes('Mentor');
      if (roleType === 'TROOPER') return u.userType === 'OJT' || !u.userType || u.userType === 'EXTERNAL';
      return false;
    }).map((u) => u.id);

    setSelectedUserIds(matched);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      setError('Pilih setidaknya 1 user penerima badge.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await awardBadgeToUsersAction(badge.id, selectedUserIds);
      if (res.success) {
        onSuccess();
        onClose();
        if (typeof window !== 'undefined') window.location.reload();
      } else {
        setError(res.error || 'Gagal memberikan badge.');
      }
    });
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.userType && u.userType.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎁</span>
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                Berikan Badge ke User
              </h3>
              <p className="text-[10px] text-zinc-500 font-bold dark:text-zinc-400">
                Pilih user atau role penerima badge <strong>{badge.name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center text-xs font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
              ⚠️ {error}
            </div>
          )}

          {/* Quick Select by Role */}
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1.5">
              Pilih Cepat berdasarkan Role
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleSelectByRole('TROOPER')}
                className="px-2.5 py-1 text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-xl transition-all"
              >
                🔥 Semua Troopers
              </button>
              <button
                type="button"
                onClick={() => handleSelectByRole('MENTOR')}
                className="px-2.5 py-1 text-[10px] font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-xl transition-all"
              >
                🎓 Semua Mentors
              </button>
              <button
                type="button"
                onClick={() => handleSelectByRole('STAFF')}
                className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl transition-all"
              >
                ⚙️ Staff / Admin
              </button>
              <button
                type="button"
                onClick={() => setSelectedUserIds([])}
                className="px-2.5 py-1 text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl transition-all"
              >
                ✕ Clear Choice
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                Daftar User ({selectedUserIds.length} dipilih)
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama/email/role..."
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-xs rounded-xl text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {loading ? (
              <p className="text-center py-6 text-zinc-400 font-bold">Memuat daftar user...</p>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                {filteredUsers.map((u) => {
                  const isChecked = selectedUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center justify-between py-2 px-2 hover:bg-purple-500/5 rounded-xl cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{u.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {u.userType || 'User'} • {u.email}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleUser(u.id)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Submit Buttons */}
          <div className="flex gap-2 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 py-2.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-400"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pending || selectedUserIds.length === 0}
              className="flex-1 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {pending ? 'Proses...' : `🎁 Berikan ke ${selectedUserIds.length} User`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
