'use client';

import { useState } from 'react';
import { updateProjectCoordinators } from '../actions';
import { useUI } from '@/components/ui/UIProvider';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export default function ProjectCoordinatorsManager({
  projectId,
  currentCoordinators,
  availableUsers,
}: {
  projectId: string;
  currentCoordinators: UserOption[];
  availableUsers: UserOption[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    currentCoordinators.map((c) => c.id)
  );
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useUI();

  const handleToggleUser = (userId: string) => {
    if (selectedIds.includes(userId)) {
      if (selectedIds.length === 1) {
        toast('Proyek harus memiliki minimal 1 Koordinator / Mentor.', 'warning');
        return;
      }
      setSelectedIds(selectedIds.filter((id) => id !== userId));
    } else {
      setSelectedIds([...selectedIds, userId]);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await updateProjectCoordinators(projectId, selectedIds);
      if (res.success) {
        toast('Koordinator proyek berhasil diperbarui!', 'success');
        setIsEditing(false);
      } else {
        toast(res.error ?? 'Gagal memperbarui koordinator.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = availableUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            👨‍🏫 Koordinator / Mentor Proyek
          </h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            Pengguna yang bertanggung jawab membimbing dan memimpin tim di proyek ini.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsEditing((p) => !p);
            setSearch('');
          }}
          className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl transition-all active:scale-[0.97]"
        >
          {isEditing ? 'Batal' : '⚙️ Kelola Koordinator'}
        </button>
      </div>

      {!isEditing ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {currentCoordinators.length === 0 ? (
            <span className="text-xs text-zinc-400 italic">Belum ada koordinator ditugaskan.</span>
          ) : (
            currentCoordinators.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/15 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-xl text-xs font-bold"
              >
                <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-black uppercase">
                  {c.name.substring(0, 2)}
                </div>
                <span>{c.name}</span>
                <span className="text-[10px] text-purple-400 font-normal">({c.email})</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          {/* Quick Search Input */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email koordinator..."
              className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {filteredUsers.length === 0 ? (
              <p className="col-span-full text-xs text-zinc-400 italic text-center py-4">
                Tidak ada pengguna yang cocok dengan pencarian.
              </p>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleToggleUser(u.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs text-left transition-all ${
                      isSelected
                        ? 'bg-purple-500/10 border-purple-500/40 text-purple-700 dark:text-purple-300 font-bold shadow-sm'
                        : 'bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate">{u.name}</p>
                      <p className="text-[10px] text-zinc-400 font-normal truncate">{u.email}</p>
                    </div>
                    <span className="text-sm shrink-0">{isSelected ? '✓' : '+'}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={loading}
              className="text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-4 py-2 rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Menyimpan...' : 'Simpan Koordinator'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
