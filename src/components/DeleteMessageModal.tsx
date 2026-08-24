'use client';

import React from 'react';

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmEveryone?: () => void;
  onConfirmPOV: () => void;
  canDeleteEveryone: boolean;
  submitting?: boolean;
  selectedCount?: number;
}

export function DeleteMessageModal({
  isOpen,
  onClose,
  onConfirmEveryone,
  onConfirmPOV,
  canDeleteEveryone,
  submitting = false,
  selectedCount = 1,
}: DeleteMessageModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center animate-in zoom-in-95 duration-150 space-y-4"
      >
        {/* WhatsApp Icon Header */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center text-3xl shadow-xs">
          💬
        </div>

        {/* Modal Title & Text */}
        <div className="space-y-1">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {selectedCount > 1 ? `Hapus ${selectedCount} pesan?` : 'Hapus pesan?'}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {selectedCount > 1
              ? 'Pilih tindakan untuk menghapus pesan terpilih.'
              : 'Pilih opsi penghapusan untuk pesan ini.'}
          </p>
        </div>

        {/* Action Buttons Stack (WhatsApp Web Style) */}
        <div className="space-y-2 pt-2">
          {canDeleteEveryone && onConfirmEveryone && (
            <button
              type="button"
              disabled={submitting}
              onClick={onConfirmEveryone}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-md hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Memproses...' : 'Hapus untuk semua orang'}
            </button>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={onConfirmPOV}
            className="w-full py-2.5 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Memproses...' : 'Hapus untuk saya'}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold text-xs rounded-2xl transition-all cursor-pointer"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
