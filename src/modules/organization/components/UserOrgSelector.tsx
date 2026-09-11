'use client';

import React, { useState } from 'react';
import { assignOrgMemberAction, removeOrgMemberAction } from '../orgActions';
import { useUI } from '@/components/ui/UIProvider';
import { useRouter } from 'next/navigation';

interface UserOrgSelectorProps {
  userId: string;
  userName: string;
  currentOrg?: {
    nodeId: string;
    nodeName: string;
    nodeIcon: string;
    roleTitle: string;
    isLead: boolean;
  } | null;
  availableNodes: { id: string; name: string; icon: string }[];
}

export const UserOrgSelector: React.FC<UserOrgSelectorProps> = ({
  userId,
  userName,
  currentOrg,
  availableNodes,
}) => {
  const router = useRouter();
  const { toast } = useUI();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(currentOrg?.nodeId || '');
  const [roleTitle, setRoleTitle] = useState(currentOrg?.roleTitle || 'Member');
  const [isLead, setIsLead] = useState(currentOrg?.isLead || false);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (!selectedNodeId) {
        // If current org exists, remove member
        if (currentOrg?.nodeId) {
          await removeOrgMemberAction(currentOrg.nodeId, userId);
          toast(`Personil ${userName} telah dikeluarkan dari divisi.`, 'success');
        }
      } else {
        // If changing from old node to new node, remove from old node first
        if (currentOrg?.nodeId && currentOrg.nodeId !== selectedNodeId) {
          await removeOrgMemberAction(currentOrg.nodeId, userId);
        }
        const res = await assignOrgMemberAction(
          selectedNodeId,
          userId,
          roleTitle.trim() || 'Member',
          isLead
        );
        if (res.success) {
          toast(`Divisi untuk ${userName} berhasil disimpan!`, 'success');
        } else {
          toast(res.error || 'Gagal mengubah divisi', 'error');
        }
      }
      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan divisi', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[200px] p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-purple-500/30 animate-in fade-in">
        <select
          value={selectedNodeId}
          onChange={(e) => setSelectedNodeId(e.target.value)}
          className="w-full px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
        >
          <option value="">-- Tanpa Divisi --</option>
          {availableNodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.icon} {n.name}
            </option>
          ))}
        </select>

        {selectedNodeId && (
          <>
            <input
              type="text"
              placeholder="Jabatan (e.g. Lead Designer)"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[11px]"
            />
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isLead}
                onChange={(e) => setIsLead(e.target.checked)}
                className="w-3 h-3 text-purple-600 rounded"
              />
              <span>👑 Ketua Divisi</span>
            </label>
          </>
        )}

        <div className="flex items-center justify-end gap-1 pt-1">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={loading}
            className="px-2 py-0.5 rounded text-[10px] font-bold text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold"
          >
            {loading ? '...' : 'Simpan'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer group flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all text-xs"
      title="Klik untuk menetapkan / ubah divisi organisasi"
    >
      {currentOrg ? (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm shrink-0">{currentOrg.nodeIcon || '🏢'}</span>
          <div className="min-w-0">
            <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-[11px]">
              {currentOrg.nodeName}
            </p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium truncate">
              {currentOrg.isLead ? '👑 ' : ''}{currentOrg.roleTitle}
            </p>
          </div>
        </div>
      ) : (
        <span className="text-zinc-400 dark:text-zinc-500 text-[11px] italic">
          + Set Divisi
        </span>
      )}
      <span className="text-[10px] text-zinc-400 group-hover:text-purple-500">✏️</span>
    </div>
  );
};
