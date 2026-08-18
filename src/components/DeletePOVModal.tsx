'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeletePOVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  submitting?: boolean;
}

export function DeletePOVModal({
  isOpen,
  onClose,
  onConfirm,
  title = '⚠️ Konfirmasi Hapus (POV Saya)',
  message = 'Apakah Anda yakin ingin menghapus percakapan/pesan ini? Percakapan/pesan ini HANYA akan dihapus dari tampilan Anda. Lawan bicara tetap dapat melihatnya.',
  submitting = false,
}: DeletePOVModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-sm bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-5 space-y-4 overflow-hidden text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center text-xl shrink-0">
              🗑️
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 leading-tight">
                {title}
              </h3>
              <span className="text-[10px] font-extrabold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full inline-block mt-0.5">
                Hanya Hapus untuk Saya
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
            {message}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-2xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="px-4 py-2 rounded-2xl text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Menghapus...' : 'Hapus untuk Saya'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
