'use client';

import { useState, useTransition } from 'react';
import { updateTaskSparksMultiplierAction } from '@/modules/sparks/multiplierActions';
import { useUI } from '@/components/ui/UIProvider';

interface EditTaskMultiplierModalProps {
  taskId: string;
  taskTitle: string;
  currentMultiplier?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditTaskMultiplierModal({
  taskId,
  taskTitle,
  currentMultiplier = 1.0,
  isOpen,
  onClose,
  onSuccess,
}: EditTaskMultiplierModalProps) {
  const [multiplier, setMultiplier] = useState<number>(currentMultiplier);
  const [customValue, setCustomValue] = useState<string>(String(currentMultiplier));
  const [isPending, startTransition] = useTransition();
  const { toast } = useUI();

  if (!isOpen) return null;

  const presets = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(0.5, Math.min(10.0, Number(customValue) || multiplier || 1.0));

    startTransition(async () => {
      const res = await updateTaskSparksMultiplierAction(taskId, val);
      if (res.success) {
        toast(res.message || `Sparks multiplier berhasil diubah menjadi ${val}x`, 'success');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast(res.error || 'Gagal mengubah multiplier', 'error');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              ⚡
            </span>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">Set Task Sparks Multiplier</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[240px]">
                {taskTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
            Multiplier ini akan diaplikasikan <strong className="text-purple-600 dark:text-purple-400">khusus untuk tugas ini</strong> saat kalkulasi Sparks intern/member yang menyelesaikan tugas.
          </p>

          {/* Presets */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider">
              Pilihan Multiplier Presets:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {presets.map((p) => {
                const isSelected = Number(customValue) === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setMultiplier(p);
                      setCustomValue(String(p));
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 scale-102 border border-purple-400'
                        : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 hover:border-purple-400'
                    }`}
                  >
                    <span>{p}x</span>
                    {p > 1.0 && <span className="text-[10px]">🔥</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Input */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider">
              Atau Input Custom Multiplier (0.5x - 10.0x):
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10.0"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-bold rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                placeholder="misal 1.75"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-purple-600 dark:text-purple-400">
                x Multiplier
              </span>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-md shadow-purple-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isPending ? 'Menyimpan...' : 'Simpan Multiplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
