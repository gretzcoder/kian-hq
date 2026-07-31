'use client';

import { useState, useTransition } from 'react';
import { submitExecutiveFeedback } from '@/modules/feedback/actions';

export default function DashboardFeedbackCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState('Kritik & Saran');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!message.trim()) return;

    startTransition(async () => {
      const res = await submitExecutiveFeedback(category, message);
      if (res.success) {
        setSuccess(true);
        setMessage('');
        setTimeout(() => {
          setSuccess(false);
          setIsOpen(false);
        }, 2000);
      } else {
        setError(res.error || 'Gagal mengirim feedback.');
      }
    });
  }

  return (
    <div className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-5 shadow-sm space-y-3">
      <div>
        <h3 className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
          Kritik & Saran
        </h3>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
          Ada masukan, ide seru, atau ganjelan? Bebas tulis di sini.
        </p>
      </div>

      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-2 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-purple-500/5 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-all active:scale-95 text-center"
      >
        Tulis Masukan
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Kritik & Saran
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Tuliskan ide, masukan, atau kendala kamu dengan santai di sini.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
              >
                ✕
              </button>
            </div>

            {success ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-center text-xs font-bold space-y-1">
                <p>Terima kasih banyak! Masukan kamu sudah langsung terkirim ke tim.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold">
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Kategori Feedback
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Kritik & Saran">Kritik & Saran</option>
                    <option value="Apresiasi & Usul">Apresiasi & Usul</option>
                    <option value="Kendala System">Laporan Kendala Sistem</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Pesan Masukan
                  </label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tuliskan masukan, saran, atau kendala secara detail di sini..."
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 resize-none"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !message.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-sm active:scale-95"
                  >
                    {isPending ? 'Mengirim...' : 'Kirim Pesan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
