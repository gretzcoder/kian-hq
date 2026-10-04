'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GeneratedDocumentItem } from '../documentTypes';
import {
  deleteDocumentAction,
  approveAndIssueDocumentAction,
  rejectDocumentAction,
  submitForApprovalAction,
  duplicateDocumentAction,
} from '../documentActions';
import { SuratTugasDistributionModal } from './SuratTugasDistributionModal';

interface DocumentListTableProps {
  documents: GeneratedDocumentItem[];
  canManage: boolean;
}

export const DocumentListTable: React.FC<DocumentListTableProps> = ({
  documents = [],
  canManage = false,
}) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatusTab, setActiveStatusTab] = useState<'ALL' | 'ISSUED' | 'PENDING' | 'DRAFT'>('ALL');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isDuplicatingId, setIsDuplicatingId] = useState<string | null>(null);

  // Approval modal state
  const [selectedDocForApproval, setSelectedDocForApproval] = useState<GeneratedDocumentItem | null>(null);
  const [approvalCustomNumber, setApprovalCustomNumber] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sparks & Badge Distribution Modal state
  const [selectedDocForDistribution, setSelectedDocForDistribution] = useState<GeneratedDocumentItem | null>(null);

  const pendingCount = documents.filter((d) => d.status === 'PENDING_APPROVAL').length;
  const issuedCount = documents.filter((d) => d.status === 'ISSUED' || d.status === 'GENERATED' || d.status === 'SIGNED').length;
  const draftCount = documents.filter((d) => d.status === 'DRAFT' || d.status === 'REJECTED').length;

  const handleDuplicate = async (docId: string) => {
    setIsDuplicatingId(docId);
    try {
      const res = await duplicateDocumentAction(docId);
      if (res.success && res.newDocumentId) {
        router.push(`/dashboard/documents/${res.newDocumentId}`);
      } else {
        alert(res.error || 'Gagal menduplikasi dokumen.');
      }
    } catch (e: any) {
      alert(e.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsDuplicatingId(null);
    }
  };

  const filtered = documents.filter((doc) => {
    // Status Tab Filter
    if (activeStatusTab === 'ISSUED') {
      if (doc.status !== 'ISSUED' && doc.status !== 'GENERATED' && doc.status !== 'SIGNED') return false;
    } else if (activeStatusTab === 'PENDING') {
      if (doc.status !== 'PENDING_APPROVAL') return false;
    } else if (activeStatusTab === 'DRAFT') {
      if (doc.status !== 'DRAFT' && doc.status !== 'REJECTED') return false;
    }

    // Search Query Filter
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      doc.document_number.toLowerCase().includes(q) ||
      doc.title.toLowerCase().includes(q) ||
      (doc.template_name && doc.template_name.toLowerCase().includes(q)) ||
      (doc.created_by_name && doc.created_by_name.toLowerCase().includes(q))
    );
  });

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`Hapus arsip dokumen "${num}"? Aksi ini tidak dapat dibatalkan.`)) return;

    setIsDeletingId(id);
    try {
      const res = await deleteDocumentAction(id);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || 'Gagal menghapus dokumen.');
      }
    } catch (e: any) {
      alert(e.message || 'Error saat menghapus.');
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedDocForApproval) return;
    setIsProcessingApproval(true);
    setActionError(null);

    try {
      const res = await approveAndIssueDocumentAction({
        documentId: selectedDocForApproval.id,
        custom_number: approvalCustomNumber.trim() || undefined,
      });

      if (res.success) {
        setSelectedDocForApproval(null);
        setApprovalCustomNumber('');
        router.refresh();
      } else {
        setActionError(res.error || 'Gagal menyetujui dokumen.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDocForApproval) return;
    if (!rejectReason.trim()) {
      setActionError('Alasan penolakan / instruksi revisi wajib diisi.');
      return;
    }

    setIsProcessingApproval(true);
    setActionError(null);

    try {
      const res = await rejectDocumentAction({
        documentId: selectedDocForApproval.id,
        reason: rejectReason.trim(),
      });

      if (res.success) {
        setSelectedDocForApproval(null);
        setRejectReason('');
        setShowRejectForm(false);
        router.refresh();
      } else {
        setActionError(res.error || 'Gagal menolak dokumen.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleQuickSubmit = async (docId: string) => {
    if (!confirm('Ajukan dokumen ini untuk persetujuan Admin/Manajemen?')) return;
    try {
      const res = await submitForApprovalAction(docId);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || 'Gagal mengajukan dokumen.');
      }
    } catch (e: any) {
      alert(e.message || 'Error saat mengajukan.');
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ISSUED':
      case 'GENERATED':
      case 'SIGNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Resmi / Terbit
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Menunggu Persetujuan
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Ditolak / Revisi
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold border border-zinc-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            Draf
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs (Only for managers who handle drafts and approvals) */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveStatusTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeStatusTab === 'ALL'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <span>Semua</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 dark:bg-black/20 font-mono">
              {documents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStatusTab('ISSUED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeStatusTab === 'ISSUED'
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400'
            }`}
          >
            <span>📜 Dokumen Resmi</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono">
              {issuedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStatusTab('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeStatusTab === 'PENDING'
                ? 'bg-amber-600 text-white'
                : 'text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400'
            }`}
          >
            <span>⏳ Menunggu Persetujuan</span>
            {pendingCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500 text-white font-bold font-mono animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveStatusTab('DRAFT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeStatusTab === 'DRAFT'
                ? 'bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>💾 Draf &amp; Ditolak</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
              {draftCount}
            </span>
          </button>
        </div>
      )}

      {/* Search Bar & Counter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nomor surat, judul, pembuat..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
          />
          <span className="absolute left-3 top-2.5 text-zinc-400 text-xs">🔍</span>
        </div>

        <span className="text-xs text-zinc-500 self-end sm:self-center">
          Menampilkan <strong>{filtered.length}</strong> dari {documents.length} dokumen
        </span>
      </div>

      {/* Mobile Card List (sm:hidden) */}
      <div className="block sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-10 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400">
            <p className="text-sm font-semibold">Tidak ada dokumen pada kategori ini.</p>
            <p className="text-xs mt-1">Klik &quot;+ Buat Surat Baru&quot; untuk membuat dokumen baru.</p>
          </div>
        ) : (
          filtered.map((doc) => {
            const dateStr = new Date(doc.created_at * 1000).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            const isOfficial = doc.status === 'ISSUED' || doc.status === 'GENERATED' || doc.status === 'SIGNED';
            const isSuratTugas = doc.type_code === 'SURAT_TUGAS';
            const sparksDist = doc.form_data?.sparks_distribution;

            return (
              <div
                key={doc.id}
                className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/dashboard/documents/${doc.id}`}
                      className="font-bold font-mono text-purple-600 dark:text-purple-400 text-xs hover:underline block"
                    >
                      {doc.document_number}
                    </Link>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                      {doc.title}
                    </h3>
                  </div>
                  {renderStatusBadge(doc.status)}
                </div>

                {/* Sparks distributed badge */}
                {sparksDist && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
                    <span>✨</span>
                    <span>{sparksDist.total_sparks} Sparks Terdistribusi ({sparksDist.total_recipients} Petugas)</span>
                  </div>
                )}

                {doc.status === 'REJECTED' && doc.rejection_reason && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                    <strong>Catatan Revisi:</strong> {doc.rejection_reason}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                  <span>Oleh: {doc.created_by_name || 'Admin'}</span>
                  <span>{dateStr} WIB</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link
                    href={`/dashboard/documents/${doc.id}`}
                    className="flex-1 py-2 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 font-bold transition-all text-xs text-center flex items-center justify-center gap-1"
                  >
                    <span>👁️</span> Buka / PDF
                  </Link>

                  {/* Sparks distribution shortcut */}
                  {canManage && isSuratTugas && isOfficial && (
                    <button
                      type="button"
                      onClick={() => setSelectedDocForDistribution(doc)}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs active:scale-95"
                      title="Distribusi Sparks & Badge untuk Petugas"
                    >
                      <span>⚡</span>
                      <span>{sparksDist ? 'Distribusi Ulang' : 'Bagi Sparks'}</span>
                    </button>
                  )}

                  {canManage && doc.status === 'PENDING_APPROVAL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDocForApproval(doc);
                        setShowRejectForm(false);
                        setActionError(null);
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                    >
                      <span>⚖️</span> Tinjau
                    </button>
                  )}

                  {(doc.status === 'DRAFT' || doc.status === 'REJECTED') && (
                    <button
                      type="button"
                      onClick={() => handleQuickSubmit(doc.id)}
                      className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                    >
                      Ajukan
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDuplicate(doc.id)}
                    disabled={isDuplicatingId === doc.id}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                    title="Duplikasi Dokumen"
                  >
                    {isDuplicatingId === doc.id ? (
                      <span className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <span>📑</span>
                    )}
                  </button>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id, doc.document_number)}
                      disabled={isDeletingId === doc.id}
                      className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors"
                      title="Hapus Dokumen"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Responsive Table (fits within screen without forced horizontal scrolling) */}
      <div className="hidden sm:block border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider">
            <tr>
              <th className="px-3.5 py-3 w-[24%]">Nomor &amp; Jenis Surat</th>
              <th className="px-3.5 py-3 w-[28%]">Judul Dokumen</th>
              <th className="px-3.5 py-3 w-[16%]">Status</th>
              <th className="px-3.5 py-3 w-[14%]">Dibuat &amp; Tanggal</th>
              <th className="px-3.5 py-3 w-[18%] text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium text-zinc-800 dark:text-zinc-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-zinc-400">
                  <p className="text-sm font-semibold">Tidak ada dokumen pada kategori ini.</p>
                  <p className="text-xs mt-1">Klik &quot;+ Buat Surat Baru&quot; untuk membuat dokumen baru.</p>
                </td>
              </tr>
            ) : (
              filtered.map((doc) => {
                const dateStr = new Date(doc.created_at * 1000).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                const timeStr = new Date(doc.created_at * 1000).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const isOfficial = doc.status === 'ISSUED' || doc.status === 'GENERATED' || doc.status === 'SIGNED';
                const isSuratTugas = doc.type_code === 'SURAT_TUGAS';
                const sparksDist = doc.form_data?.sparks_distribution;
                const eventName = doc.form_data?.event_name;

                return (
                  <tr key={doc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    {/* Nomor & Jenis */}
                    <td className="px-3.5 py-3 align-top">
                      <div className="space-y-1">
                        <Link
                          href={`/dashboard/documents/${doc.id}`}
                          className="font-bold font-mono text-purple-600 dark:text-purple-400 text-xs hover:underline block leading-tight break-all"
                          title={doc.document_number}
                        >
                          {doc.document_number}
                        </Link>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium leading-none">
                          {doc.template_name || doc.type_code} (v{doc.template_version})
                        </span>
                      </div>
                    </td>

                    {/* Judul & Event Subtitle */}
                    <td className="px-3.5 py-3 align-top">
                      <div className="space-y-0.5">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 text-xs leading-snug">
                          {doc.title}
                        </div>
                        {eventName && (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                            📍 {eventName}
                          </p>
                        )}
                        {doc.status === 'REJECTED' && doc.rejection_reason && (
                          <span className="text-[10px] text-red-500 block line-clamp-1 mt-0.5" title={doc.rejection_reason}>
                            ⚠️ {doc.rejection_reason}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status & Sparks Indicator */}
                    <td className="px-3.5 py-3 align-top">
                      <div className="space-y-1.5">
                        <div>{renderStatusBadge(doc.status)}</div>
                        {sparksDist ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20"
                            title={`Sparks dibagikan kepada ${sparksDist.total_recipients} petugas`}
                          >
                            <span>✨</span>
                            <span>{sparksDist.total_sparks} Sparks</span>
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Dibuat & Tanggal */}
                    <td className="px-3.5 py-3 align-top text-zinc-600 dark:text-zinc-400">
                      <div className="text-[11px] space-y-0.5">
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {doc.created_by_name || 'Admin'}
                        </div>
                        <div className="text-zinc-400 dark:text-zinc-500 text-[10px] font-mono">
                          {dateStr}, {timeStr}
                        </div>
                      </div>
                    </td>

                    {/* Action Buttons (Compact & Fully Visible) */}
                    <td className="px-3.5 py-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Sparks Distribution Shortcut for Surat Tugas */}
                        {canManage && isSuratTugas && isOfficial && (
                          <button
                            type="button"
                            onClick={() => setSelectedDocForDistribution(doc)}
                            className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 shadow-xs active:scale-95 ${
                              sparksDist
                                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                            }`}
                            title={sparksDist ? 'Distribusi Ulang Sparks & Badge' : 'Bagi Sparks Otomatis untuk Petugas'}
                          >
                            <span>⚡</span>
                            <span className="hidden xl:inline">{sparksDist ? 'Sparks' : 'Bagi Sparks'}</span>
                          </button>
                        )}

                        {canManage && doc.status === 'PENDING_APPROVAL' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDocForApproval(doc);
                              setShowRejectForm(false);
                              setActionError(null);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all flex items-center gap-1 shadow-xs"
                          >
                            <span>⚖️</span> Review
                          </button>
                        )}

                        {(doc.status === 'DRAFT' || doc.status === 'REJECTED') && (
                          <button
                            type="button"
                            onClick={() => handleQuickSubmit(doc.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 font-bold transition-all text-xs"
                          >
                            Ajukan
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDuplicate(doc.id)}
                          disabled={isDuplicatingId === doc.id}
                          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                          title="Duplikasi Dokumen Ini"
                        >
                          {isDuplicatingId === doc.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <span>📑</span>
                          )}
                        </button>

                        <Link
                          href={`/dashboard/documents/${doc.id}`}
                          className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold transition-all text-xs flex items-center gap-1 shrink-0"
                          title="Buka Dokumen / Ekspor PDF"
                        >
                          <span>👁️</span> Buka
                        </Link>

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id, doc.document_number)}
                            disabled={isDeletingId === doc.id}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors"
                            title="Hapus Dokumen"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Review & Approval Modal for Admin */}
      {selectedDocForApproval && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Review &amp; Penerbitan Resmi
                </span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {selectedDocForApproval.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocForApproval(null)}
                className="text-zinc-400 hover:text-zinc-600 p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold rounded-xl">
                ⚠️ {actionError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
                <div>
                  <span className="text-zinc-500 block">Diajukan Oleh:</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {selectedDocForApproval.created_by_name}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Template:</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {selectedDocForApproval.template_name}
                  </span>
                </div>
              </div>

              {!showRejectForm ? (
                <div className="space-y-2">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block">
                    Nomor Surat Resmi (Opsional Custom)
                  </label>
                  <input
                    type="text"
                    value={approvalCustomNumber}
                    onChange={(e) => setApprovalCustomNumber(e.target.value)}
                    placeholder="Kosongkan untuk alokasi nomor otomatis sequential"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Ketika disetujui, nomor resmi akan dialokasikan dan status menjadi <strong>ISSUED (Resmi)</strong>. QR code verifikasi publik akan langsung aktif.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="font-bold text-red-600 dark:text-red-400 block">
                    Alasan Penolakan / Catatan Revisi <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Contoh: Mohon perbaiki tanggal pelaksanaan dan tambahkan divisi penempatan..."
                    className="w-full px-3 py-2 rounded-xl border border-red-300 dark:border-red-700 bg-white dark:bg-zinc-800 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <Link
                href={`/dashboard/documents/${selectedDocForApproval.id}`}
                target="_blank"
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
              >
                👁️ Lihat Preview Lengkap
              </Link>

              <div className="flex items-center gap-2">
                {!showRejectForm ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(true)}
                      className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 font-bold text-xs transition-all"
                    >
                      Tolak Pengajuan
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isProcessingApproval}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      {isProcessingApproval ? (
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>✓</span>
                      )}
                      <span>Setujui &amp; Terbitkan</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={isProcessingApproval}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      {isProcessingApproval ? (
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>✕</span>
                      )}
                      <span>Kirim Penolakan</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sparks & Badge Distribution Modal */}
      {selectedDocForDistribution && (
        <SuratTugasDistributionModal
          documentId={selectedDocForDistribution.id}
          isOpen={true}
          onClose={() => setSelectedDocForDistribution(null)}
        />
      )}
    </div>
  );
};

