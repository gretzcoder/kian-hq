'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { addWorkspaceMembersBulk, updateWorkspaceMemberRoles, removeWorkspaceMember } from '@/modules/workspaces/actions';

interface Member {
  userId: string;
  userName: string | null;
  userEmail: string;
  userType: string;
  accountRoles: string[];
  teamRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[];
}

interface OjtUser {
  id: string;
  name: string;
  email: string;
  userType?: string;
  roleNames?: string | null;
  roleIds?: string | null;
}

const ROLE_CATEGORIES = [
  { id: 'ALL', label: 'Semua Role', icon: '👥' },
  { id: 'DESIGNER', label: 'Designer', icon: '🎨' },
  { id: 'EDITOR', label: 'Video Editor', icon: '🎬' },
  { id: 'PLANNER', label: 'Planner', icon: '📋' },
  { id: 'RESEARCHER', label: 'Researcher', icon: '🔍' },
  { id: 'TROOPERS', label: 'Troopers / OJT', icon: '👤' },
  { id: 'MENTOR', label: 'Mentor', icon: '🎓' },
];

const userMatchesRoleCategory = (u: OjtUser, catId: string): boolean => {
  if (catId === 'ALL') return true;
  const rolesUpper = `${u.roleNames || ''} ${u.roleIds || ''} ${u.userType || ''}`.toUpperCase();

  if (catId === 'DESIGNER') return rolesUpper.includes('DESIGNER');
  if (catId === 'EDITOR') return rolesUpper.includes('EDITOR') || rolesUpper.includes('VIDEO');
  if (catId === 'PLANNER') return rolesUpper.includes('PLANNER');
  if (catId === 'RESEARCHER') return rolesUpper.includes('RESEARCHER');
  if (catId === 'TROOPERS') return rolesUpper.includes('TROOPER') || rolesUpper.includes('OJT') || rolesUpper.includes('JOB') || rolesUpper.includes('TRAINING');
  if (catId === 'MENTOR') return rolesUpper.includes('MENTOR');
  return true;
};

const roleConfig: Record<'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR', { label: string; activeColor: string; inactiveColor: string }> = {
  LEADER: {
    label: 'Ketua Tim',
    activeColor: 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/40 border-purple-200 dark:border-purple-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-purple-300 dark:hover:border-purple-800/40',
  },
  RESEARCHER: {
    label: 'Researcher',
    activeColor: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-blue-300 dark:hover:border-blue-800/40',
  },
  PLANNER: {
    label: 'Planner',
    activeColor: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-emerald-300 dark:hover:border-emerald-800/40',
  },
  CREATOR: {
    label: 'Creator',
    activeColor: 'text-pink-700 bg-pink-100 dark:text-pink-300 dark:bg-pink-900/40 border-pink-200 dark:border-pink-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-pink-300 dark:hover:border-pink-800/40',
  },
};

export default function TeamMemberPanel({
  workspaceId,
  members,
  canManageMembers,
  isMentor,
  ojtUsers = [],
  isAssessment = false,
  mentorId = null,
}: {
  workspaceId: string;
  members: Member[];
  canManageMembers: boolean;
  isMentor: boolean;
  ojtUsers?: OjtUser[];
  isAssessment?: boolean;
  mentorId?: string | null;
}) {
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ id?: string; email: string; name?: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter displayMembers for Assessment mode so staff/mentors are excluded from active list & count
  const displayMembers = isAssessment
    ? members.filter((m) => {
        const isStaffOrMentor =
          m.userType === 'STAFF' ||
          (m.accountRoles || []).some(
            (r) =>
              r.toUpperCase().includes('MENTOR') ||
              r.toUpperCase().includes('COORDINATOR') ||
              r.toUpperCase().includes('EXECUTIVE') ||
              r === 'role_mentor_troopers' ||
              r === 'role_coordinator' ||
              r === 'role_executive'
          ) ||
          m.userId === mentorId;
        return !isStaffOrMentor;
      })
    : members;

  const [selectedRoleCategory, setSelectedRoleCategory] = useState<string>('ALL');

  // Existing member emails set for filtering out already added users
  const existingEmails = new Set(displayMembers.map((m) => m.userEmail.toLowerCase()));

  // Filter available OJT users not yet in the workspace
  const availableOjt = ojtUsers.filter((u) => !existingEmails.has(u.email.toLowerCase()));

  const availableOjtForCategory = availableOjt.filter((u) => userMatchesRoleCategory(u, selectedRoleCategory));

  const filteredOjt = availableOjtForCategory.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectAllInCategory = (catId: string) => {
    const candidates = availableOjt.filter((u) => userMatchesRoleCategory(u, catId));
    const newItems = [...selectedItems];
    for (const u of candidates) {
      if (!newItems.some((item) => item.email.toLowerCase() === u.email.toLowerCase())) {
        newItems.push({ id: u.id, email: u.email, name: u.name });
      }
    }
    setSelectedItems(newItems);
  };

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

  const toggleSelectItem = (user: { id: string; email: string; name: string }) => {
    setSelectedItems((prev) => {
      const exists = prev.some((item) => item.email.toLowerCase() === user.email.toLowerCase());
      if (exists) {
        return prev.filter((item) => item.email.toLowerCase() !== user.email.toLowerCase());
      }
      return [...prev, user];
    });
  };

  const removeSelectedItem = (email: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.email.toLowerCase() !== email.toLowerCase()));
  };

  const handleAddManualInput = () => {
    if (!search.trim()) return;
    // Support comma or whitespace separated values
    const parts = search.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
    const newItems = [...selectedItems];

    for (const p of parts) {
      if (!newItems.some((item) => item.email.toLowerCase() === p.toLowerCase())) {
        const found = ojtUsers.find((u) => u.email.toLowerCase() === p.toLowerCase());
        newItems.push({
          id: found?.id,
          email: p,
          name: found?.name,
        });
      }
    }
    setSelectedItems(newItems);
    setSearch('');
    setIsOpen(false);
  };

  const handleSelectAllAvailableOjt = () => {
    const allAvailable = availableOjt.map((u) => ({ id: u.id, email: u.email, name: u.name }));
    setSelectedItems(allAvailable);
  };

  const handleClearAllSelected = () => {
    setSelectedItems([]);
    setSearch('');
  };

  const handleAddBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If there's uncommitted text in search input, add it to selectedItems
    let itemsToSubmit = [...selectedItems];
    if (search.trim()) {
      const parts = search.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        if (!itemsToSubmit.some((item) => item.email.toLowerCase() === p.toLowerCase())) {
          itemsToSubmit.push({ email: p });
        }
      }
    }

    if (itemsToSubmit.length === 0) {
      setError('Pilih atau ketik minimal 1 email anggota.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const emailsOrIds = itemsToSubmit.map((i) => i.id || i.email);

    try {
      const res = await addWorkspaceMembersBulk(workspaceId, emailsOrIds);
      if (res.success) {
        setSelectedItems([]);
        setSearch('');
        setSuccess(res.message || `${itemsToSubmit.length} anggota berhasil ditambahkan!`);
        setTimeout(() => setSuccess(null), 4000);
      } else {
        setError(res.error ?? 'Gagal menambahkan anggota tim.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (
    userId: string,
    currentRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[],
    roleToToggle: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR'
  ) => {
    setUpdating(userId);
    let newRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[];

    if (currentRoles.includes(roleToToggle)) {
      newRoles = currentRoles.filter((r) => r !== roleToToggle);
    } else {
      newRoles = [...currentRoles, roleToToggle];
    }

    try {
      const res = await updateWorkspaceMemberRoles(workspaceId, userId, newRoles);
      if (!res.success) alert(res.error ?? 'Gagal memperbarui peran.');
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui peran.');
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (userId: string, name: string | null) => {
    if (!confirm(`Hapus ${name || 'anggota'} dari tim workspace?`)) return;

    setUpdating(userId);
    try {
      const res = await removeWorkspaceMember(workspaceId, userId);
      if (!res.success) alert(res.error ?? 'Gagal menghapus anggota.');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus anggota.');
    } finally {
      setUpdating(null);
    }
  };

  const canToggleRole = (roleToToggle: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR') => {
    if (!canManageMembers) return false;
    if (roleToToggle === 'LEADER') {
      return isMentor || canManageMembers;
    }
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
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 font-semibold">
          ⚠️ {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3 font-semibold">
          ✓ {success}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form Tambah Member Fleksibel (1/3 Width) */}
        {canManageMembers && (
          <div className="lg:col-span-1 bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                + Undang Anggota Tim
              </h3>
              {availableOjt.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllAvailableOjt}
                  className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Pilih Semua ({availableOjt.length})
                </button>
              )}
            </div>

            <form onSubmit={handleAddBulkSubmit} className="space-y-4">
              {/* Selected Member Chips / Tags */}
              {selectedItems.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Terpilih ({selectedItems.length})</span>
                    <button
                      type="button"
                      onClick={handleClearAllSelected}
                      className="text-red-500 hover:underline"
                    >
                      Bersihkan All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                    {selectedItems.map((item) => (
                      <span
                        key={item.email}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                      >
                        <span className="truncate max-w-[140px]">
                          {item.name ? `${item.name} (${item.email})` : item.email}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSelectedItem(item.email)}
                          className="text-purple-400 hover:text-purple-700 dark:hover:text-purple-200 font-bold ml-0.5"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Role Category Filter & Quick Selection Pills */}
              <div className="space-y-1.5 pb-1">
                <div className="flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                  <span>Pilih Berdasarkan Kategori Role</span>
                  {selectedRoleCategory !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => handleSelectAllInCategory(selectedRoleCategory)}
                      className="text-purple-600 dark:text-purple-400 hover:underline font-bold text-[10px]"
                    >
                      Pilih Semua ({availableOjt.filter((u) => userMatchesRoleCategory(u, selectedRoleCategory)).length})
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {ROLE_CATEGORIES.map((cat) => {
                    const count = availableOjt.filter((u) => userMatchesRoleCategory(u, cat.id)).length;
                    const isActive = selectedRoleCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedRoleCategory(cat.id);
                          setIsOpen(true);
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                          isActive
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-300'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                        <span className={`text-[9px] px-1 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input Box with Multi-select Autocomplete Dropdown */}
              <div className="relative" ref={containerRef}>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Cari / Ketik Email Anggota (Bisa Lebih Dari Satu)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    autoComplete="off"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setIsOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddManualInput();
                      }
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Pilih pengguna atau ketik email (pisahkan koma)"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all"
                  />
                  {search.trim() && (
                    <button
                      type="button"
                      onClick={handleAddManualInput}
                      className="bg-zinc-200 dark:bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors"
                      title="Tambah email ke daftar pilihan"
                    >
                      + Tambah
                    </button>
                  )}
                </div>

                {/* Dropdown Selection List */}
                {isOpen && (
                  <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-20 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase">
                      <span>Daftar Pengguna Aktif</span>
                      <span>{filteredOjt.length} tersedia</span>
                    </div>

                    {filteredOjt.length === 0 ? (
                      <p className="p-3 text-xs text-zinc-400 dark:text-zinc-500 italic">
                        {search ? 'Tidak ada pengguna yang cocok dengan kata kunci' : 'Semua pengguna sudah ditambahkan'}
                      </p>
                    ) : (
                      filteredOjt.map((u) => {
                        const isChecked = selectedItems.some((item) => item.email.toLowerCase() === u.email.toLowerCase());
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleSelectItem(u)}
                            className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors font-medium flex items-center justify-between ${
                              isChecked
                                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold'
                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                            }`}
                          >
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="font-bold truncate">{u.name || u.email}</span>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-zinc-400 font-mono truncate">
                                  {u.email}
                                </span>
                                {u.roleNames && (
                                  <span className="text-[8px] font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.2 rounded-md">
                                    {u.roleNames}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0 ${
                              isChecked
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                            }`}>
                              {isChecked ? '✓' : ''}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || (selectedItems.length === 0 && !search.trim())}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Menambahkan...</span>
                ) : (
                  <span>
                    + Tambahkan {selectedItems.length > 0 ? `${selectedItems.length} Anggota` : 'ke Tim'}
                  </span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Right Column: Member List Cards (2/3 Width) */}
        <div className={`space-y-4 ${canManageMembers ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Daftar Anggota Aktif ({displayMembers.length})
            </h3>
          </div>

          {displayMembers.length === 0 ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center bg-white dark:bg-transparent">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                Belum ada anggota tim yang ditambahkan ke workspace ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayMembers.map((m) => {
                  const isSelfUpdating = updating === m.userId;

                  return (
                    <div
                      key={m.userId}
                      className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 rounded-2xl p-4 space-y-3 shadow-sm flex flex-col justify-between"
                    >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href="/dashboard/profile"
                          className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate hover:text-purple-600 dark:hover:text-purple-400 hover:underline block"
                          title={`Lihat profil ${m.userName}`}
                        >
                          {m.userName || 'Unknown User'}
                        </Link>
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
                      {isAssessment ? (
                        /* Assessment mode: show real account role badges */
                        <AccountRoleBadges member={m} mentorId={mentorId} />
                      ) : (
                        /* Regular workspace mode: role toggles */
                        <>
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
                        </>
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

function getAccountRoleBadge(roleStr: string): { label: string; color: string } {
  const norm = roleStr.toUpperCase();
  if (norm.includes('EXECUTIVE')) {
    return { label: `👑 ${roleStr}`, color: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700/50' };
  }
  if (norm.includes('COORDINATOR') || norm.includes('KOORDINATOR')) {
    return { label: `📋 ${roleStr}`, color: 'text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700/50' };
  }
  if (norm.includes('MENTOR')) {
    return { label: `🎓 ${roleStr}`, color: 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700/50' };
  }
  if (norm.includes('TROOPER') || norm.includes('OJT')) {
    return { label: `👤 ${roleStr}`, color: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700/50' };
  }
  if (norm.includes('CREATOR')) {
    return { label: `🎨 ${roleStr}`, color: 'text-pink-700 bg-pink-100 dark:text-pink-300 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700/50' };
  }
  if (norm.includes('COLLABORATOR') || norm.includes('KOLABORATOR')) {
    return { label: `🤝 ${roleStr}`, color: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700/50' };
  }

  return { label: roleStr, color: 'text-zinc-600 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600' };
}

function AccountRoleBadges({ member, mentorId }: { member: Member; mentorId?: string | null }) {
  const badges: { label: string; color: string }[] = [];

  if (member.accountRoles.length > 0) {
    for (const role of member.accountRoles) {
      badges.push(getAccountRoleBadge(role));
    }
  } else if (member.userType === 'OJT') {
    badges.push(getAccountRoleBadge('TROOPERS'));
  } else if (member.userId === mentorId) {
    badges.push(getAccountRoleBadge('MENTOR TROOPERS'));
  } else {
    badges.push({ label: '👤 Staff', color: 'text-zinc-600 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600' });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span
          key={b.label}
          className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${b.color}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
