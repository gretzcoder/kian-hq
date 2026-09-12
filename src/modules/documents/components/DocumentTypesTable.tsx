'use client';

import React, { useState } from 'react';
import { DocumentTypeItem } from '../documentTypes';
import { DocumentTypeManagerModal } from './DocumentTypeManagerModal';
import { deleteDocumentTypeAction } from '../documentTypeActions';
import { useRouter } from 'next/navigation';

interface DocumentTypesTableProps {
  types: DocumentTypeItem[];
  canManage: boolean;
}

export const DocumentTypesTable: React.FC<DocumentTypesTableProps> = ({
  types: initialTypes = [],
  canManage = false,
}) => {
  const router = useRouter();
  const [types, setTypes] = useState<DocumentTypeItem[]>(initialTypes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const filteredTypes = types.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDelete = async (t: DocumentTypeItem) => {
    if (!confirm(`Hapus jenis dokumen "${t.name}" (${t.code})?`)) return;

    setIsDeletingId(t.id);
    try {
      const res = await deleteDocumentTypeAction(t.id);
      if (res.success) {
        setTypes((prev) => prev.filter((item) => item.id !== t.id));
        router.refresh();
      } else {
        alert(res.error || 'Gagal menghapus jenis dokumen.');
      }
    } catch (e: any) {
      alert(e.message || 'Terjadi kesalahan.');
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari jenis dokumen..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
          />
          <span className="absolute left-3 top-2.5 text-xs text-zinc-400">🔍</span>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <span>+</span> Tambah / Kelola Jenis Dokumen
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Jenis Dokumen</th>
                <th className="px-4 py-3">Kode Dokumen</th>
                <th className="px-4 py-3">Formula Penomoran</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium text-zinc-800 dark:text-zinc-200">
              {filteredTypes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-zinc-400">
                    <p className="text-sm font-semibold">Tidak ada jenis dokumen ditemukan.</p>
                    <p className="text-xs mt-1">Klik &quot;+ Tambah / Kelola Jenis Dokumen&quot; untuk mendaftarkan jenis baru.</p>
                  </td>
                </tr>
              ) : (
                filteredTypes.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg shrink-0">
                          {t.icon || '📄'}
                        </span>
                        <div>
                          <span>{t.name}</span>
                          {t.description && (
                            <p className="text-[11px] text-zinc-400 font-normal line-clamp-1 mt-0.5">
                              {t.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-mono font-bold text-[11px]">
                        {t.code}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      {t.numbering_format}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.is_active
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                        }`}
                      >
                        {t.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsModalOpen(true)}
                              className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 font-bold transition-all text-xs"
                              title="Edit Jenis Dokumen"
                            >
                              ⚙️ Kelola
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(t)}
                              disabled={isDeletingId === t.id}
                              className="p-1.5 rounded-xl hover:bg-red-500/10 text-red-500 text-xs font-bold transition-all disabled:opacity-50"
                              title="Hapus Jenis Dokumen"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <DocumentTypeManagerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          router.refresh();
        }}
        onTypesUpdated={() => {
          router.refresh();
        }}
      />
    </div>
  );
};
