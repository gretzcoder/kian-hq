'use client';

import { useState } from 'react';
import { updateSparks } from '@/modules/tasks/actions';
import { getSparkMeta } from '@/app/dashboard/review/components/ReviewActions';
import { useUI } from '@/components/ui/UIProvider';

interface EditSparksModalProps {
  assignmentId: string;
  assigneeName: string;
  currentSparks: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditSparksModal({
  assignmentId,
  assigneeName,
  currentSparks,
  isOpen,
  onClose,
}: EditSparksModalProps) {
  const [sparks, setSparks] = useState<number>(currentSparks || 8);
  const [loading, setLoading] = useState(false);
  const { toast } = useUI();

  if (!isOpen) return null;

  const sparkMeta = getSparkMeta(sparks);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await updateSparks(assignmentId, sparks);
      if (res.success) {
        toast(`Poin Sparks untuk ${assigneeName} berhasil diubah menjadi ${sparks} ✨!`, 'success');
        onClose();
      } else {
        toast(res.error ?? 'Gagal memperbarui Sparks.', 'error');
      }
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span>✨ Edit Creative Sparks</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Ubah apresiasi poin karya untuk <strong className="text-zinc-800 dark:text-zinc-200">{assigneeName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-bold flex items-center justify-center text-xs transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Selected Spark Badge */}
        <div className="text-center py-2 bg-purple-500/5 rounded-2xl border border-purple-500/10">
          <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border ${sparkMeta.color}`}>
            <span>{sparkMeta.emoji}</span>
            <span>{sparkMeta.label} ({sparks}/10)</span>
          </span>
        </div>

        {/* 1 - 10 Selector Grid */}
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
            const isSelected = sparks === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setSparks(num)}
                className={`py-2.5 rounded-xl text-xs font-black transition-all ${
                  isSelected
                    ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 scale-105 ring-2 ring-purple-500/40'
                    : 'bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs font-bold py-2.5 rounded-xl transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Menyimpan...' : 'Simpan Sparks'}
          </button>
        </div>
      </div>
    </div>
  );
}
