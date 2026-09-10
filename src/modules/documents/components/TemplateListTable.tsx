'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DocumentTemplateItem } from '../documentTypes';
import {
  duplicateTemplateAction,
  setTemplateStatusAction,
} from '../templateActions';

interface TemplateListTableProps {
  templates: DocumentTemplateItem[];
  canManage: boolean;
}

export const TemplateListTable: React.FC<TemplateListTableProps> = ({
  templates = [],
  canManage = false,
}) => {
  const router = useRouter();
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  const handleDuplicate = async (id: string, name: string) => {
    const newName = prompt('Masukkan nama untuk template hasil duplikasi:', `${name} (Copy)`);
    if (!newName) return;

    setIsProcessingId(id);
    try {
      const res = await duplicateTemplateAction(id, newName);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || 'Gagal menduplikasi template.');
      }
    } catch (e: any) {
      alert(e.message || 'Terjadi kesalahan.');
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleToggleStatus = async (
    id: string,
    currentStatus: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  ) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    setIsProcessingId(id);
    try {
      const res = await setTemplateStatusAction(id, nextStatus);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || 'Gagal mengubah status template.');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessingId(null);
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Nama Template</th>
              <th className="px-4 py-3">Jenis Dokumen</th>
              <th className="px-4 py-3 text-center">Versi Aktif</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3">Terakhir Diperbarui</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium text-zinc-800 dark:text-zinc-200">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-zinc-400">
                  <p className="text-sm font-semibold">Belum ada template terdaftar.</p>
                  <p className="text-xs mt-1">Klik &quot;+ Buat Template Baru&quot; untuk merancang template dokumen.</p>
                </td>
              </tr>
            ) : (
              templates.map((tpl) => {
                const dateStr = new Date(tpl.updated_at * 1000).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <tr key={tpl.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                      <div>
                        <span>{tpl.name}</span>
                        {tpl.description && (
                          <p className="text-[10px] text-zinc-400 font-normal line-clamp-1 mt-0.5">
                            {tpl.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-[11px]">
                        {tpl.type_name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 font-mono font-bold text-[11px]">
                        v{tpl.current_version}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          tpl.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : tpl.status === 'DRAFT'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                        }`}
                      >
                        {tpl.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-zinc-500 text-[11px]">
                      {dateStr}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Use template to create document */}
                        <Link
                          href={`/dashboard/documents/create?templateId=${tpl.id}`}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all text-xs flex items-center gap-1 shadow-sm shadow-purple-500/20"
                        >
                          <span>✍️</span> Buat Surat
                        </Link>

                        {canManage && (
                          <>
                            <Link
                              href={`/dashboard/documents/templates/${tpl.id}/edit`}
                              className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 font-bold transition-all text-xs"
                              title="Edit / Designer"
                            >
                              ⚙️ Builder
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(tpl.id, tpl.name)}
                              disabled={isProcessingId === tpl.id}
                              className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 font-bold transition-all text-xs"
                              title="Duplikat Template"
                            >
                              📋 Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(tpl.id, tpl.status)}
                              disabled={isProcessingId === tpl.id}
                              className="p-1.5 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs"
                              title={tpl.status === 'ACTIVE' ? 'Arsipkan Template' : 'Aktifkan Template'}
                            >
                              {tpl.status === 'ACTIVE' ? '📦' : '🟢'}
                            </button>
                          </>
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
  );
};
