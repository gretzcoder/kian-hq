'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GeneratedDocumentItem } from '../documentTypes';
import { deleteDocumentAction } from '../documentActions';

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
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const filtered = documents.filter((doc) => {
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

  return (
    <div className="space-y-4">
      {/* Search Bar */}
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
            <p className="text-sm font-semibold">Belum ada dokumen yang diterbitkan.</p>
            <p className="text-xs mt-1">Klik &quot;+ Buat Surat Baru&quot; untuk mulai membuat surat tugas atau dokumen resmi.</p>
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
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium shrink-0">
                    {doc.template_name || doc.type_code}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                  <span>Oleh: {doc.created_by_name || 'Admin'}</span>
                  <span>{dateStr} WIB</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/dashboard/documents/${doc.id}`}
                    className="flex-1 py-2 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 font-bold transition-all text-xs text-center flex items-center justify-center gap-1"
                  >
                    <span>👁️</span> Buka / Download PDF
                  </Link>
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

      {/* Desktop Table List (hidden sm:block) */}
      <div className="hidden sm:block border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Nomor Surat</th>
                <th className="px-4 py-3">Judul Dokumen</th>
                <th className="px-4 py-3">Template / Jenis</th>
                <th className="px-4 py-3">Diterbitkan Oleh</th>
                <th className="px-4 py-3">Tanggal Diterbitkan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium text-zinc-800 dark:text-zinc-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-zinc-400">
                    <p className="text-sm font-semibold">Belum ada dokumen yang diterbitkan.</p>
                    <p className="text-xs mt-1">Klik &quot;+ Buat Surat Baru&quot; untuk mulai membuat surat tugas atau dokumen resmi.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((doc) => {
                  const dateStr = new Date(doc.created_at * 1000).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={doc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3.5 font-bold font-mono text-purple-600 dark:text-purple-400 whitespace-nowrap">
                        <Link href={`/dashboard/documents/${doc.id}`} className="hover:underline">
                          {doc.document_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {doc.title}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[11px] font-medium">
                          {doc.template_name || doc.type_code} (v{doc.template_version})
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                        {doc.created_by_name || 'Admin'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-zinc-500 font-mono text-[11px]">
                        {dateStr} WIB
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/documents/${doc.id}`}
                            className="px-3 py-1.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 font-bold transition-all text-xs"
                          >
                            👁️ Buka / PDF
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
      </div>
    </div>
  );
};
