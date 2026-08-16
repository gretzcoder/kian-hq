'use client';

import { useState, useTransition } from 'react';
import { extendTaskDeadline } from '@/modules/tasks/actions';

interface ExtendDeadlineModalProps {
  taskId: string;
  taskTitle: string;
  currentDeadline: number | null;
  currentExtendedDeadline?: number | null;
  workspaceId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExtendDeadlineModal({
  taskId,
  taskTitle,
  currentDeadline,
  currentExtendedDeadline,
  workspaceId,
  isOpen,
  onClose,
  onSuccess,
}: ExtendDeadlineModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Format timestamp for datetime-local input (Asia/Jakarta local time)
  const formatForInput = (ts: number | null) => {
    if (!ts) return '';
    const date = new Date(ts);
    // Pad numbers
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const activeDeadline = currentExtendedDeadline || currentDeadline;
  const initialValue = formatForInput(activeDeadline || (Date.now() + 24 * 3600 * 1000));
  const [newDeadlineStr, setNewDeadlineStr] = useState(initialValue);

  if (!isOpen) return null;

  const newDeadlineMs = newDeadlineStr ? new Date(newDeadlineStr).getTime() : 0;
  const originalTs = currentDeadline || Date.now();

  let daysExtended = 0;
  if (currentDeadline && newDeadlineMs > currentDeadline) {
    daysExtended = Math.ceil((newDeadlineMs - currentDeadline) / (24 * 3600 * 1000));
  } else if (!currentDeadline && newDeadlineMs > Date.now()) {
    daysExtended = Math.ceil((newDeadlineMs - Date.now()) / (24 * 3600 * 1000));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeadlineMs || (currentDeadline && newDeadlineMs <= currentDeadline)) {
      setError('Deadline perpanjangan harus lebih lama dari deadline awal.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await extendTaskDeadline(taskId, newDeadlineMs, workspaceId);
      if (res.success) {
        onSuccess?.();
        onClose();
        if (typeof window !== 'undefined') window.location.reload();
      } else {
        setError(res.error ?? 'Gagal memperpanjang deadline.');
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏳</span>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                Extend Deadline Task
              </h3>
              <p className="text-[10px] text-zinc-500 font-bold dark:text-zinc-400">
                Perpanjang tenggat waktu tugas untuk peserta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center text-xs font-bold transition-all"
          >
            ✕
          </button>
        </div>

        <div className="bg-purple-500/8 border border-purple-500/15 rounded-2xl p-3.5 space-y-1">
          <p className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
            Tugas Target
          </p>
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
            {taskTitle}
          </p>
          {currentDeadline && (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Deadline Awal: <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{new Date(currentDeadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </p>
          )}
          {currentExtendedDeadline && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
              Sudah Pernah Di-extend ke: <span className="font-mono">{new Date(currentExtendedDeadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
              Set Deadline Maksimal Baru <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={newDeadlineStr}
              onChange={(e) => setNewDeadlineStr(e.target.value)}
              required
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-xs rounded-xl px-4 py-2.5 focus:outline-none transition-all font-mono text-zinc-900 dark:text-zinc-100"
            />
          </div>

          {daysExtended > 0 && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 font-bold">
                <span>⚡ Perpanjangan: +{daysExtended} Hari (H+{daysExtended})</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 font-black">Status: Extend</span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Skema Penyesuaian Sparks Otomatis saat pengumpulan:
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                {Array.from({ length: Math.min(daysExtended, 5) }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const penalty = Math.min(100, dayNum * 10);
                  return (
                    <div key={dayNum} className="px-2 py-1 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex justify-between">
                      <span>H+{dayNum}:</span>
                      <span className="font-bold text-red-500">Sparks -{penalty}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 font-bold bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 py-2.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pending || !newDeadlineStr}
              className="flex-1 py-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all shadow-md shadow-purple-500/20 disabled:opacity-50"
            >
              {pending ? 'Menyimpan...' : '💾 Extend Deadline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
