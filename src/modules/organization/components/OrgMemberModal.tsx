'use client';

import React, { useState, useEffect } from 'react';
import { OrgNodeItem } from '../orgTypes';
import { assignOrgMemberAction, removeOrgMemberAction, searchUsersForOrgAction } from '../orgActions';
import { useUI } from '@/components/ui/UIProvider';
import UserAvatar from '@/components/ui/UserAvatar';

interface OrgMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  node: OrgNodeItem;
}

export const OrgMemberModal: React.FC<OrgMemberModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  node,
}) => {
  const { toast } = useUI();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // New member form
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [roleTitle, setRoleTitle] = useState('Staff / Member');
  const [isLead, setIsLead] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const timer = setTimeout(async () => {
        setIsSearching(true);
        try {
          const res = await searchUsersForOrgAction(searchQuery);
          setSearchResults(res);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearching(false);
        }
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      toast('Pilih user terlebih dahulu', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await assignOrgMemberAction(
        node.id,
        selectedUser.id,
        roleTitle.trim() || 'Member',
        isLead
      );
      if (res.success) {
        toast(`Berhasil menambahkan ${selectedUser.name} ke ${node.name}!`, 'success');
        setSelectedUser(null);
        setSearchQuery('');
        setRoleTitle('Staff / Member');
        setIsLead(false);
        onSuccess();
      } else {
        toast(res.error || 'Gagal menambahkan personil', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal menambahkan personil', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string, userName: string) => {
    if (!confirm(`Hapus ${userName} dari ${node.name}?`)) return;

    setLoading(true);
    try {
      const res = await removeOrgMemberAction(node.id, userId);
      if (res.success) {
        toast(`Personil ${userName} telah dihapus dari divisi.`, 'success');
        onSuccess();
      } else {
        toast(res.error || 'Gagal menghapus personil', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus personil', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLead = async (userId: string, currentLead: boolean, role: string) => {
    setLoading(true);
    try {
      const res = await assignOrgMemberAction(node.id, userId, role, !currentLead);
      if (res.success) {
        toast('Status kepemimpinan berhasil diubah!', 'success');
        onSuccess();
      } else {
        toast(res.error || 'Gagal mengubah status', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal mengubah status', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{node.icon}</span>
            <div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                Kelola Anggota: {node.name}
              </h2>
              <p className="text-xs text-zinc-500">
                Total {node.members?.length || 0} personil terdaftar di divisi ini.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-2 text-sm rounded-xl"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add Member Section */}
          <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/15 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
              <span>➕</span> Tambah Personil ke Divisi
            </h3>

            <form onSubmit={handleAssign} className="space-y-3">
              {/* User search / selected user */}
              {selectedUser ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-800 border border-purple-500/30">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={selectedUser.name} src={selectedUser.avatar_url} size="sm" />
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{selectedUser.name}</p>
                      <p className="text-[10px] text-zinc-500">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="text-xs text-red-500 font-bold hover:underline"
                  >
                    Ganti
                  </button>
                </div>
              ) : (
                <div className="space-y-1 relative">
                  <input
                    type="text"
                    placeholder="Ketik nama atau email user..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                  />
                  {isSearching && (
                    <p className="text-[10px] text-zinc-400 absolute right-3 top-2.5">Mencari...</p>
                  )}

                  {searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl max-h-40 overflow-y-auto shadow-xl z-20 divide-y divide-zinc-100 dark:divide-zinc-700">
                      {searchResults.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setSelectedUser(u);
                            setSearchResults([]);
                          }}
                          className="p-2.5 flex items-center justify-between hover:bg-purple-50 dark:hover:bg-purple-950/30 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar name={u.name} src={u.avatar_url} size="xs" />
                            <div>
                              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{u.name}</p>
                              <p className="text-[10px] text-zinc-500">{u.email}</p>
                            </div>
                          </div>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                            {u.user_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Role Title & Lead checkbox */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    Jabatan / Peran di Divisi
                  </label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="Contoh: Senior UI Designer, Lead"
                    className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                  />
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLead}
                      onChange={(e) => setIsLead(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600"
                    />
                    <span>👑 Ketua / Koordinator Divisi</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading || !selectedUser}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs"
                >
                  {loading ? 'Menambahkan...' : '+ Masukkan ke Divisi'}
                </button>
              </div>
            </form>
          </div>

          {/* Current Members List */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Daftar Anggota Saat Ini ({node.members?.length || 0})
            </h3>

            {(!node.members || node.members.length === 0) ? (
              <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 text-xs">
                Belum ada anggota yang ditugaskan di divisi ini.
              </div>
            ) : (
              <div className="space-y-2">
                {node.members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex items-center justify-between gap-3 hover:border-purple-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar name={m.name} src={m.avatar_url} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{m.name}</p>
                          {m.is_lead && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              👑 Lead Divisi
                            </span>
                          )}
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            {m.user_type}
                          </span>
                        </div>
                        <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                          {m.role_title || 'Member'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleLead(m.user_id, m.is_lead, m.role_title)}
                        title={m.is_lead ? 'Batalkan status Ketua Divisi' : 'Jadikan Ketua Divisi'}
                        className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                          m.is_lead
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {m.is_lead ? '👑 Lead' : 'Set Lead'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemove(m.user_id, m.name)}
                        className="text-red-500 hover:text-red-700 p-1.5 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Hapus dari divisi"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
