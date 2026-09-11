'use client';

import React, { useState, useEffect } from 'react';
import { OrgAuthoritiesConfig, OrgNodeItem, OrgNodeType } from '../orgTypes';
import { createOrgNodeAction, updateOrgNodeAction } from '../orgActions';
import { useUI } from '@/components/ui/UIProvider';

interface OrgNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialNode?: OrgNodeItem | null;
  parentOptions: { id: string; name: string }[];
  defaultParentId?: string | null;
}

const COLOR_OPTIONS = [
  { value: 'purple', label: 'Purple', bg: 'bg-purple-500' },
  { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-500' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-500' },
  { value: 'emerald', label: 'Emerald', bg: 'bg-emerald-500' },
  { value: 'amber', label: 'Amber', bg: 'bg-amber-500' },
  { value: 'rose', label: 'Rose', bg: 'bg-rose-500' },
  { value: 'cyan', label: 'Cyan', bg: 'bg-cyan-500' },
];

const TYPE_OPTIONS: { value: OrgNodeType; label: string }[] = [
  { value: 'DIRECTORATE', label: 'Direktorat / Pimpinan (Directorate)' },
  { value: 'DIVISION', label: 'Divisi Utama (Division)' },
  { value: 'DEPARTMENT', label: 'Departemen (Department)' },
  { value: 'TEAM', label: 'Tim / Unit Khusus (Team)' },
  { value: 'POSITION', label: 'Posisi / Jabatan Spesifik (Position)' },
];

export const OrgNodeModal: React.FC<OrgNodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialNode,
  parentOptions,
  defaultParentId,
}) => {
  const { toast } = useUI();
  const [loading, setLoading] = useState(false);

  const [parentId, setParentId] = useState<string>(
    initialNode?.parent_id || defaultParentId || ''
  );
  const [name, setName] = useState(initialNode?.name || '');
  const [code, setCode] = useState(initialNode?.code || '');
  const [type, setType] = useState<OrgNodeType>(initialNode?.type || 'DIVISION');
  const [description, setDescription] = useState(initialNode?.description || '');
  const [color, setColor] = useState(initialNode?.color || 'purple');
  const [icon, setIcon] = useState(initialNode?.icon || '🏢');
  const [orderIndex, setOrderIndex] = useState(initialNode?.order_index ?? 0);

  // Authority configurations
  const [canReviewTasks, setCanReviewTasks] = useState(
    initialNode?.authorities?.can_review_tasks || false
  );
  const [reviewScope, setReviewScope] = useState<'ALL' | 'MATCH_LABEL' | 'MATCH_ROLE'>(
    initialNode?.authorities?.review_scope || 'MATCH_LABEL'
  );
  const [reviewLabelsStr, setReviewLabelsStr] = useState(
    initialNode?.authorities?.review_labels?.join(', ') || 'design, creative, visual, ui/ux, graphic'
  );
  const [crossWorkspace, setCrossWorkspace] = useState(
    initialNode?.authorities?.cross_workspace ?? true
  );
  const [preventSelfReview, setPreventSelfReview] = useState(
    initialNode?.authorities?.prevent_self_review ?? true
  );
  const [canManageBriefs, setCanManageBriefs] = useState(
    initialNode?.authorities?.can_manage_briefs || false
  );
  const [canManageDocuments, setCanManageDocuments] = useState(
    initialNode?.authorities?.can_manage_documents || false
  );
  const [canManageSparks, setCanManageSparks] = useState(
    initialNode?.authorities?.can_manage_sparks || false
  );
  const [canViewAllWorkspaces, setCanViewAllWorkspaces] = useState(
    initialNode?.authorities?.can_view_all_workspaces || false
  );

  useEffect(() => {
    if (initialNode) {
      setParentId(initialNode.parent_id || '');
      setName(initialNode.name);
      setCode(initialNode.code);
      setType(initialNode.type);
      setDescription(initialNode.description || '');
      setColor(initialNode.color);
      setIcon(initialNode.icon);
      setOrderIndex(initialNode.order_index ?? 0);

      const auth = initialNode.authorities || {};
      setCanReviewTasks(auth.can_review_tasks || false);
      setReviewScope(auth.review_scope || 'MATCH_LABEL');
      setReviewLabelsStr(auth.review_labels?.join(', ') || 'design, creative, visual');
      setCrossWorkspace(auth.cross_workspace ?? true);
      setPreventSelfReview(auth.prevent_self_review ?? true);
      setCanManageBriefs(auth.can_manage_briefs || false);
      setCanManageDocuments(auth.can_manage_documents || false);
      setCanManageSparks(auth.can_manage_sparks || false);
      setCanViewAllWorkspaces(auth.can_view_all_workspaces || false);
    } else {
      setParentId(defaultParentId || '');
      setName('');
      setCode('');
      setType('DIVISION');
      setDescription('');
      setColor('purple');
      setIcon('🏢');
      setOrderIndex(0);
      setCanReviewTasks(false);
      setReviewScope('MATCH_LABEL');
      setReviewLabelsStr('design, creative, visual');
      setCrossWorkspace(true);
      setPreventSelfReview(true);
      setCanManageBriefs(false);
      setCanManageDocuments(false);
      setCanManageSparks(false);
      setCanViewAllWorkspaces(false);
    }
  }, [initialNode, defaultParentId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Nama struktur/divisi wajib diisi', 'error');
      return;
    }

    const labels = reviewLabelsStr
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const authoritiesPayload: OrgAuthoritiesConfig = {
      can_review_tasks: canReviewTasks,
      review_scope: canReviewTasks ? reviewScope : undefined,
      review_labels: canReviewTasks && reviewScope === 'MATCH_LABEL' ? labels : undefined,
      cross_workspace: canReviewTasks ? crossWorkspace : false,
      prevent_self_review: preventSelfReview,
      can_manage_briefs: canManageBriefs,
      can_manage_documents: canManageDocuments,
      can_manage_sparks: canManageSparks,
      can_view_all_workspaces: canViewAllWorkspaces,
    };

    setLoading(true);
    try {
      if (initialNode) {
        const res = await updateOrgNodeAction(initialNode.id, {
          parent_id: parentId || null,
          code: code.trim() || name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          color,
          icon,
          order_index: Number(orderIndex) || 0,
          authorities: authoritiesPayload,
        });
        if (res.success) {
          toast('Struktur organisasi berhasil diperbarui!', 'success');
          onSuccess();
          onClose();
        } else {
          toast(res.error || 'Gagal memperbarui struktur', 'error');
        }
      } else {
        const res = await createOrgNodeAction({
          parent_id: parentId || null,
          code: code.trim() || name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          color,
          icon,
          order_index: Number(orderIndex) || 0,
          authorities: authoritiesPayload,
        });
        if (res.success) {
          toast('Struktur organisasi berhasil ditambahkan!', 'success');
          onSuccess();
          onClose();
        } else {
          toast(res.error || 'Gagal menambahkan struktur', 'error');
        }
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                {initialNode ? 'Edit Struktur Organisasi' : 'Tambah Divisi / Struktur Baru'}
              </h2>
              <p className="text-xs text-zinc-500">
                Atur informasi hierarki dan wewenang khusus yang didelegasikan ke divisi ini.
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
              1. Informasi Hierarki & Identitas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Parent Node */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Induk Hierarki (Parent)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                >
                  <option value="">-- Puncak Organisasi (Root / Tanpa Parent) --</option>
                  {parentOptions
                    .filter((p) => !initialNode || p.id !== initialNode.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Node Type */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Tipe Struktur
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as OrgNodeType)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Name & Code */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Nama Divisi / Jabatan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Divisi Creative Design"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Kode Divisi
                </label>
                <input
                  type="text"
                  placeholder="DIV_CREATIVE"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono font-bold uppercase"
                />
              </div>
            </div>

            {/* Icon, Color, Order */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Icon (Emoji)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-16 text-center text-lg py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                  <div className="flex gap-1">
                    {['🎨', '🎬', '💻', '📋', '👑', '📢', '🛡️'].map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setIcon(em)}
                        className="text-sm p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Warna Tema
                </label>
                <div className="flex items-center gap-1.5">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`w-6 h-6 rounded-full ${c.bg} transition-all ${
                        color === c.value
                          ? 'ring-2 ring-offset-2 ring-purple-500 scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Urutan Tampil (Sort Order)
                </label>
                <input
                  type="number"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Deskripsi & Tanggung Jawab
              </label>
              <textarea
                rows={2}
                placeholder="Jelaskan peran divisi dan lingkup tanggung jawab tim ini..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs resize-y"
              />
            </div>
          </div>

          {/* Delegated Authorities (Hak Khusus Fungsional) */}
          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <span>⚡</span> 2. Hak Khusus & Pendelegasian Wewenang (Authority Overlay)
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Anggota di divisi ini akan otomatis mendapatkan hak fungsional berikut tanpa harus mengubah role global RBAC mereka.
              </p>
            </div>

            {/* Feature 1: Delegated QC / Review */}
            <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/15 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canReviewTasks}
                      onChange={(e) => setCanReviewTasks(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>🎨 Delegasi Quality Control (QC) & Review Tugas</span>
                  </label>
                  <p className="text-[11px] text-zinc-500 mt-0.5 pl-6">
                    Izinkan anggota divisi ini melakukan evaluasi/approve/revisi terhadap tugas peserta.
                  </p>
                </div>
              </div>

              {canReviewTasks && (
                <div className="pl-6 space-y-3 pt-2 border-t border-purple-500/10 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                        Lingkup Tugas (Scope)
                      </label>
                      <select
                        value={reviewScope}
                        onChange={(e) => setReviewScope(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                      >
                        <option value="MATCH_LABEL">Sesuai Kata Kunci / Label (Rekomendasi)</option>
                        <option value="ALL">Semua Jenis Tugas (Full Takeover)</option>
                      </select>
                    </div>

                    {reviewScope === 'MATCH_LABEL' && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                          Label / Kata Kunci Tugas (Pisahkan Koma)
                        </label>
                        <input
                          type="text"
                          value={reviewLabelsStr}
                          onChange={(e) => setReviewLabelsStr(e.target.value)}
                          placeholder="design, creative, visual, ui/ux, graphic"
                          className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={crossWorkspace}
                        onChange={(e) => setCrossWorkspace(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-purple-600"
                      />
                      <span>Lintas Workspace (Tanpa perlu jadi member tiap workspace)</span>
                    </label>

                    <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preventSelfReview}
                        onChange={(e) => setPreventSelfReview(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-purple-600"
                      />
                      <span>Cegah Review Karya Sendiri (Integritas QC)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Other Delegated Permissions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canManageBriefs}
                  onChange={(e) => setCanManageBriefs(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <div>
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">📄 Kelola Content Briefs</p>
                  <p className="text-[10px] text-zinc-500">Bisa membuat & mereview ajuan brief</p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canManageDocuments}
                  onChange={(e) => setCanManageDocuments(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <div>
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">📑 Dokumen & Surat Tugas</p>
                  <p className="text-[10px] text-zinc-500">Bisa generate & kelola surat resmi KIAN</p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canManageSparks}
                  onChange={(e) => setCanManageSparks(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <div>
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">✨ Sparks & Reward Management</p>
                  <p className="text-[10px] text-zinc-500">Bisa kelola multiplier & sparks</p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canViewAllWorkspaces}
                  onChange={(e) => setCanViewAllWorkspaces(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <div>
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">🌐 Supervisi Seluruh Workspace</p>
                  <p className="text-[10px] text-zinc-500">Dapat memantau seluruh ruang kerja</p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-500/20 active:scale-95 transition-all"
            >
              {loading ? 'Menyimpan...' : initialNode ? 'Simpan Perubahan' : 'Tambah Struktur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
