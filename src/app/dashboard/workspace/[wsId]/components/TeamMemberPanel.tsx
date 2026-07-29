'use client';

import { useState, useEffect, useRef } from 'react';
import { addWorkspaceMember, updateWorkspaceMemberRoles, removeWorkspaceMember } from '@/modules/workspaces/actions';

interface Member {
  userId: string;
  userName: string | null;
  userEmail: string;
  teamRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[];
}

const roleConfig: Record<'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR', { label: string; activeColor: string; inactiveColor: string }> = {
  LEADER: {
    label: 'Ketua Tim',
    activeColor: 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/40 border-purple-200 dark:border-purple-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-purple-300 dark:hover:border-purple-800/40'
  },
  RESEARCHER: {
    label: 'Researcher',
    activeColor: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-blue-300 dark:hover:border-blue-800/40'
  },
  PLANNER: {
    label: 'Planner',
    activeColor: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-emerald-300 dark:hover:border-emerald-800/40'
  },
  CREATOR: {
    label: 'Creator',
    activeColor: 'text-pink-700 bg-pink-100 dark:text-pink-300 dark:bg-pink-900/40 border-pink-200 dark:border-pink-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-pink-300 dark:hover:border-pink-800/40'
  },
};

export default function TeamMemberPanel({
  workspaceId,
  members,
  canManageMembers,
  isMentor,
  ojtUsers = [],
}: {
  workspaceId: string;
  members: Member[];
  canManageMembers: boolean;
  isMentor: boolean;
  ojtUsers?: { id: string; name: string; email: string }[];
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await addWorkspaceMember(workspaceId, search.trim()); // Defaults to MEMBER
      if (res.success) {
        setSearch('');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(res.error ?? 'Failed to add team member.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const filteredOjt = ojtUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleRole = async (
    userId: string,
    currentRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[],
    roleToToggle: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR'
  ) => {
    setUpdating(userId);
    let newRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[];
    
    // Toggle the role in the array
    if (currentRoles.includes(roleToToggle)) {
      newRoles = currentRoles.filter((r) => r !== roleToToggle);
    } else {
      newRoles = [...currentRoles, roleToToggle];
    }

    try {
      const res = await updateWorkspaceMemberRoles(workspaceId, userId, newRoles);
      if (!res.success) alert(res.error ?? 'Failed to update roles.');
    } catch (err: any) {
      alert(err.message || 'Failed to update roles.');
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (userId: string, name: string | null) => {
    if (!confirm(`Remove ${name || 'member'} from the team?`)) return;

    setUpdating(userId);
    try {
      const res = await removeWorkspaceMember(workspaceId, userId);
      if (!res.success) alert(res.error ?? 'Failed to remove member.');
    } catch (err: any) {
      alert(err.message || 'Failed to remove member.');
    } finally {
      setUpdating(null);
    }
  };

  const canToggleRole = (roleToToggle: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR') => {
    if (!canManageMembers) return false;
    if (roleToToggle === 'LEADER') {
      return isMentor; // Only mentor can assign/remove team leader
    }
    // OJT roles can be toggled by either Mentor or Team Leader (via canManageMembers)
    return true;
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Anggota Tim Workspace</h2>
        <p className="text-zinc-500 dark:text-zinc-500 text-xs mt-0.5">
          Kelola penugasan anggota tim dan perannya untuk workspace ini.
        </p>
      </div>

      {/* Error & Success Messages */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3">
          ✓ Anggota tim berhasil ditambahkan!
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form Tambah Member (1/3 Width) */}
        {canManageMembers && (
          <div className="lg:col-span-1 bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              + Undang Anggota Tim
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="relative" ref={containerRef}>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Email Anggota
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setIsOpen(true);
                  }}
                  onFocus={() => setIsOpen(true)}
                  placeholder="Ketik email (misal: intern@kian.co)"
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all"
                />
                {isOpen && (
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-20 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {filteredOjt.length === 0 ? (
                      <p className="p-3 text-xs text-zinc-400 dark:text-zinc-500 italic">
                        Tidak ada email OJT yang cocok
                      </p>
                    ) : (
                      filteredOjt.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSearch(u.email);
                            setIsOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 transition-colors font-medium flex flex-col"
                        >
                          <span className="font-bold">{u.email}</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                            {u.name}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all disabled:opacity-60 active:scale-[0.98]"
              >
                {loading ? 'Menambahkan...' : '+ Tambahkan ke Tim'}
              </button>
            </form>
          </div>
        )}

        {/* Right Column: Member List Cards (2/3 Width) */}
        <div className={`space-y-4 ${canManageMembers ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Daftar Anggota Aktif ({members.length})
            </h3>
          </div>

          {members.length === 0 ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center bg-white dark:bg-transparent">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                Belum ada anggota tim yang ditambahkan ke workspace ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {members.map((m) => {
                const isSelfUpdating = updating === m.userId;

                return (
                  <div
                    key={m.userId}
                    className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 rounded-2xl p-4 space-y-3 shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {m.userName || 'Unknown User'}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono truncate">
                          {m.userEmail}
                        </p>
                      </div>

                      {canManageMembers && (
                        <button
                          onClick={() => handleRemove(m.userId, m.userName)}
                          disabled={isSelfUpdating}
                          className="text-[10px] text-red-500 hover:text-red-600 font-bold px-2 py-1 rounded-lg hover:bg-red-500/5 transition-all shrink-0"
                          title="Hapus anggota"
                        >
                          ✕ Hapus
                        </button>
                      )}
                    </div>

                    {/* Roles Selector / Display */}
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                      {(['LEADER', 'RESEARCHER', 'PLANNER', 'CREATOR'] as const).map((r) => {
                        const hasRole = m.teamRoles.includes(r);
                        const cfg = roleConfig[r];
                        const clickable = canToggleRole(r);
                        const classes = `text-[9px] font-black uppercase px-2 py-0.5 rounded-full border transition-all ${
                          hasRole ? cfg.activeColor : cfg.inactiveColor
                        } ${
                          clickable && !isSelfUpdating
                            ? 'cursor-pointer active:scale-95'
                            : 'pointer-events-none opacity-50'
                        }`;

                        return (
                          <button
                            key={r}
                            type="button"
                            disabled={isSelfUpdating || !clickable}
                            onClick={() => handleToggleRole(m.userId, m.teamRoles, r)}
                            className={classes}
                          >
                            {hasRole ? '✓ ' : ''}
                            {cfg.label}
                          </button>
                        );
                      })}
                      {isSelfUpdating && (
                        <span className="text-[9px] text-zinc-400 animate-pulse font-bold self-center">
                          Menyimpan...
                        </span>
                      )}
                    </div>
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
