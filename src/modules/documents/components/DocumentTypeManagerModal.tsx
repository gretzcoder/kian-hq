'use client';

import React, { useState, useEffect } from 'react';
import { DocumentTypeItem } from '../documentTypes';
import {
  getDocumentTypesAction,
  createDocumentTypeAction,
  updateDocumentTypeAction,
  deleteDocumentTypeAction,
} from '../documentTypeActions';

interface DocumentTypeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType?: (typeId: string) => void;
  onTypesUpdated?: () => void;
}

const COMMON_EMOJIS = ['📋', '✉️', '📜', '📝', '📁', '📑', '🎖️', '🏢', '🔖', '📌', '⚖️', '🏷️'];

export const DocumentTypeManagerModal: React.FC<DocumentTypeManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectType,
  onTypesUpdated,
}) => {
  const [types, setTypes] = useState<DocumentTypeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [numberingFormat, setNumberingFormat] = useState('{sequence}/KIAN/TROOPERS/{roman_month}/{year}');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📄');
  const [isActive, setIsActive] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTypes = async () => {
    setIsLoading(true);
    try {
      const data = await getDocumentTypesAction(true);
      setTypes(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTypes();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingId(null);
    setIsAddingNew(true);
    setName('');
    setCode('');
    setNumberingFormat('{sequence}/KIAN/TROOPERS/{roman_month}/{year}');
    setDescription('');
    setIcon('📄');
    setIsActive(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleStartEdit = (t: DocumentTypeItem) => {
    setIsAddingNew(false);
    setEditingId(t.id);
    setName(t.name);
    setCode(t.code);
    setNumberingFormat(t.numbering_format || '{sequence}/KIAN/TROOPERS/{roman_month}/{year}');
    setDescription(t.description || '');
    setIcon(t.icon || '📄');
    setIsActive(t.is_active);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama jenis dokumen wajib diisi.');
      return;
    }
    if (!code.trim()) {
      setErrorMsg('Kode jenis dokumen wajib diisi.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingId) {
        const res = await updateDocumentTypeAction(editingId, {
          name,
          code,
          numbering_format: numberingFormat,
          description,
          icon,
          is_active: isActive,
        });

        if (res.success && res.item) {
          setSuccessMsg(`Jenis dokumen "${res.item.name}" berhasil diperbarui!`);
          setEditingId(null);
          await fetchTypes();
          if (onTypesUpdated) onTypesUpdated();
        } else {
          setErrorMsg(res.error || 'Gagal menyimpan perubahan.');
        }
      } else {
        const res = await createDocumentTypeAction({
          name,
          code,
          numbering_format: numberingFormat,
          description,
          icon,
          is_active: isActive,
        });

        if (res.success && res.item) {
          setSuccessMsg(`Jenis dokumen baru "${res.item.name}" berhasil ditambahkan!`);
          setIsAddingNew(false);
          await fetchTypes();
          if (onSelectType) onSelectType(res.item.id);
          if (onTypesUpdated) onTypesUpdated();
        } else {
          setErrorMsg(res.error || 'Gagal menambah jenis dokumen.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (t: DocumentTypeItem) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus jenis dokumen "${t.name}" (${t.code})?`)) {
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await deleteDocumentTypeAction(t.id);
      if (res.success) {
        setSuccessMsg(`Jenis dokumen "${t.name}" berhasil dihapus.`);
        await fetchTypes();
        if (onTypesUpdated) onTypesUpdated();
      } else {
        setErrorMsg(res.error || 'Gagal menghapus jenis dokumen.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSaving(false);
    }
  };

  // Live Formula Preview
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const curMonthRoman = romanMonths[new Date().getMonth()];
  const curYear = new Date().getFullYear();
  const previewDocNumber = numberingFormat
    .replace(/\{sequence\}/g, '1')
    .replace(/\{roman_month\}/g, curMonthRoman)
    .replace(/\{month\}/g, String(new Date().getMonth() + 1).padStart(2, '0'))
    .replace(/\{year\}/g, String(curYear))
    .replace(/\{type\}/g, code || 'SURAT');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📁</span>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                Kelola Jenis Dokumen (Document Types)
              </h2>
              <p className="text-[11px] text-zinc-500">
                Atur master jenis surat, format penomoran otomatis, dan ikon kategori.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-xs font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-500">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-500">
            {successMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Add / Edit Form Card */}
          {(isAddingNew || editingId) && (
            <form
              onSubmit={handleSave}
              className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl space-y-4 animate-in slide-in-from-top-2"
            >
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                <h3 className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>{editingId ? '✏️' : '➕'}</span>
                  <span>{editingId ? 'Edit Jenis Dokumen' : 'Tambah Jenis Dokumen Baru'}</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 font-bold"
                >
                  Batal
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Icon selector */}
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    Ikon Emoji
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      maxLength={4}
                      className="w-12 text-center text-lg px-2 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                    <div className="flex flex-wrap gap-1 max-w-[120px]">
                      {COMMON_EMOJIS.slice(0, 6).map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setIcon(em)}
                          className="text-xs p-0.5 hover:scale-125 transition-transform"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    Nama Jenis Dokumen <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (isAddingNew && !code) {
                        setCode(e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''));
                      }
                    }}
                    placeholder="Contoh: Surat Undangan"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold"
                  />
                </div>

                {/* Code */}
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    Kode Unik <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''))}
                    placeholder="SURAT_UNDANGAN"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Numbering Format formula */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    Format Penomoran Surat Otomatis
                  </label>
                  <span className="text-[10px] text-zinc-400">
                    Tag: <code className="text-purple-600 font-mono">&#123;sequence&#125;</code>, <code className="text-purple-600 font-mono">&#123;roman_month&#125;</code>, <code className="text-purple-600 font-mono">&#123;year&#125;</code>
                  </span>
                </div>
                <input
                  type="text"
                  value={numberingFormat}
                  onChange={(e) => setNumberingFormat(e.target.value)}
                  placeholder="{sequence}/KIAN/TROOPERS/{roman_month}/{year}"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                />
                <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[10.5px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>Pratinjau Nomor Surat:</span>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                    {previewDocNumber}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  Deskripsi / Keterangan Penggunaan
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Penjelasan singkat tujuan jenis dokumen ini..."
                  className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>

              {/* Status active */}
              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Aktif (Tersedia saat pembuatan template &amp; dokumen)</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-500/20">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-3.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                >
                  {isSaving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : '+ Tambahkan Jenis'}
                </button>
              </div>
            </form>
          )}

          {/* List of types */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Daftar Master Jenis Dokumen ({types.length})
              </span>
              {!isAddingNew && !editingId && (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs flex items-center gap-1"
                >
                  <span>+</span> Tambah Jenis Baru
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                Memuat jenis dokumen...
              </div>
            ) : types.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl">
                Belum ada jenis dokumen terdaftar.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
                {types.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 flex items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                        {t.icon || '📄'}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                            {t.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            {t.code}
                          </span>
                          {!t.is_active && (
                            <span className="px-1.5 py-0.2 text-[9px] rounded font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                              Non-aktif
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                            {t.description}
                          </p>
                        )}
                        <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
                          Format: {t.numbering_format}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onSelectType && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectType(t.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 hover:bg-purple-200 text-xs font-bold"
                        >
                          Pilih
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(t)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs font-bold"
                        title="Edit Jenis Dokumen"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        className="p-1 rounded-lg hover:bg-red-500/10 text-red-500 text-xs font-bold"
                        title="Hapus Jenis Dokumen"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 font-bold text-xs transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
