'use client';

import React, { useState } from 'react';
import { OrgNodeItem } from '../orgTypes';
import { OrgHierarchyTreeView } from './OrgHierarchyTreeView';
import { OrgNodeCard } from './OrgNodeCard';
import { OrgNodeModal } from './OrgNodeModal';
import { OrgMemberModal } from './OrgMemberModal';
import { deleteOrgNodeAction } from '../orgActions';
import { useUI } from '@/components/ui/UIProvider';
import { useRouter } from 'next/navigation';

interface OrganizationManagerProps {
  treeNodes: OrgNodeItem[];
  flatNodes: OrgNodeItem[];
  canManage: boolean;
}

export const OrganizationManager: React.FC<OrganizationManagerProps> = ({
  treeNodes,
  flatNodes,
  canManage,
}) => {
  const router = useRouter();
  const { toast } = useUI();

  const [viewMode, setViewMode] = useState<'TREE' | 'GRID'>('TREE');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgNodeItem | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedMemberNode, setSelectedMemberNode] = useState<OrgNodeItem | null>(null);

  const handleOpenCreateRoot = () => {
    setEditingNode(null);
    setDefaultParentId(null);
    setIsNodeModalOpen(true);
  };

  const handleAddChild = (parentId: string) => {
    setEditingNode(null);
    setDefaultParentId(parentId);
    setIsNodeModalOpen(true);
  };

  const handleEditNode = (node: OrgNodeItem) => {
    setEditingNode(node);
    setDefaultParentId(node.parent_id);
    setIsNodeModalOpen(true);
  };

  const handleManageMembers = (node: OrgNodeItem) => {
    setSelectedMemberNode(node);
    setIsMemberModalOpen(true);
  };

  const handleDeleteNode = async (id: string, name: string) => {
    if (!confirm(`Hapus struktur "${name}"? Sub-divisi di bawahnya akan otomatis dipindahkan ke induk atasnya.`)) {
      return;
    }

    try {
      const res = await deleteOrgNodeAction(id);
      if (res.success) {
        toast(`Struktur "${name}" berhasil dihapus.`, 'success');
        router.refresh();
      } else {
        toast(res.error || 'Gagal menghapus struktur', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus struktur', 'error');
    }
  };

  const handleRefresh = () => {
    router.refresh();
  };

  // Stats calculation
  const totalDivisions = flatNodes.length;
  const totalAssignedMembers = flatNodes.reduce(
    (acc, node) => acc + (node.members?.length || 0),
    0
  );
  const delegatedReviewDivisions = flatNodes.filter(
    (n) => n.authorities?.can_review_tasks
  ).length;

  // Filtered nodes for grid search
  const filteredGridNodes = flatNodes.filter((node) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchName = node.name.toLowerCase().includes(q);
    const matchCode = node.code.toLowerCase().includes(q);
    const matchDesc = (node.description || '').toLowerCase().includes(q);
    const matchMember = (node.members || []).some((m) =>
      m.name.toLowerCase().includes(q)
    );
    return matchName || matchCode || matchDesc || matchMember;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🏛️</span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
              Struktur Organisasi
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Hierarki divisi resmi KIAN Troopers, manajemen personil, dan pendelegasian wewenang fungsional (QC & Supervisi).
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateRoot}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <span>➕</span>
              <span>Tambah Struktur Baru</span>
            </button>
          </div>
        )}
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center text-xl">
            🏢
          </div>
          <div>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Divisi / Unit</p>
            <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{totalDivisions}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-xl">
            👥
          </div>
          <div>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Personil Ditempatkan</p>
            <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{totalAssignedMembers}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xl">
            🎨
          </div>
          <div>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Delegasi QC Aktif</p>
            <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">
              {delegatedReviewDivisions} Divisi
            </p>
          </div>
        </div>
      </div>

      {/* View Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('TREE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'TREE'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span>🌳</span>
            <span>Diagram Pohon (Hierarchy Tree)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('GRID')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'GRID'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span>📋</span>
            <span>Daftar Kartu (Grid Cards)</span>
          </button>
        </div>

        {viewMode === 'GRID' && (
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Cari divisi atau nama personil..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
            />
          </div>
        )}
      </div>

      {/* Main Hierarchy Content Area */}
      <div className="bg-white/50 dark:bg-[#09090b]/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 min-h-[400px]">
        {viewMode === 'TREE' ? (
          <OrgHierarchyTreeView
            nodes={treeNodes}
            canManage={canManage}
            onEdit={handleEditNode}
            onDelete={handleDeleteNode}
            onManageMembers={handleManageMembers}
            onAddChild={handleAddChild}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredGridNodes.map((node) => (
              <OrgNodeCard
                key={node.id}
                node={node}
                canManage={canManage}
                onEdit={handleEditNode}
                onDelete={handleDeleteNode}
                onManageMembers={handleManageMembers}
                onAddChild={handleAddChild}
              />
            ))}
          </div>
        )}
      </div>

      {/* Node Create / Edit Modal */}
      <OrgNodeModal
        isOpen={isNodeModalOpen}
        onClose={() => setIsNodeModalOpen(false)}
        onSuccess={handleRefresh}
        initialNode={editingNode}
        parentOptions={flatNodes.map((n) => ({ id: n.id, name: `${n.icon} ${n.name}` }))}
        defaultParentId={defaultParentId}
      />

      {/* Member Management Modal */}
      {selectedMemberNode && (
        <OrgMemberModal
          isOpen={isMemberModalOpen}
          onClose={() => {
            setIsMemberModalOpen(false);
            setSelectedMemberNode(null);
          }}
          onSuccess={handleRefresh}
          node={selectedMemberNode}
        />
      )}
    </div>
  );
};
