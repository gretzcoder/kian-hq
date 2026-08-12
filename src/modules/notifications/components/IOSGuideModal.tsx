'use client';

import { useState } from 'react';
import { useUI } from '@/components/ui/UIProvider';

interface IOSGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isChrome?: boolean;
}

export default function IOSGuideModal({ isOpen, onClose, isChrome = false }: IOSGuideModalProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useUI();

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://hq.kianorganizer.workers.dev';

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const input = document.createElement('input');
        input.value = currentUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      toast('Link berhasil disalin! Silakan buka di peramban Safari 🧭', 'success');
      setTimeout(() => setCopied(false), 4000);
    } catch (e) {
      toast('Gagal menyalin URL. Silakan salin URL di address bar.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-zinc-100 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
        >
          ✕
        </button>

        {isChrome ? (
          <>
            {/* Chrome on iOS Guide */}
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-2xl">
                🍎
              </div>
              <h3 className="text-lg font-black tracking-tight">
                Pengguna Chrome di iPhone / iOS
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Kebijakan Apple iOS membatasi Notifikasi Push &amp; PWA agar hanya bisa dipasang melalui peramban <strong>Safari</strong>.
              </p>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                🧭 4 Langkah Mudah Mengaktifkan:
              </p>
              <ol className="text-xs text-zinc-700 dark:text-zinc-300 space-y-2 list-decimal list-inside font-medium">
                <li>
                  Klik tombol <strong>&quot;Salin Link Website&quot;</strong> di bawah.
                </li>
                <li>
                  Buka aplikasi <strong>Safari 🧭</strong> di iPhone Anda.
                </li>
                <li>
                  Tempel (Paste) &amp; buka link websitenya di Safari.
                </li>
                <li>
                  Tekan ikon <strong>Share (⎋)</strong> lalu pilih <strong>&quot;Tambah ke Layar Utama&quot;</strong> (Add to Home Screen).
                </li>
              </ol>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{copied ? '✓ Link Tersalin!' : '📋 Salin Link untuk Safari'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Safari on iOS Guide */}
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center text-2xl">
                📲
              </div>
              <h3 className="text-lg font-black tracking-tight">
                Aktifkan Notifikasi HP (iOS Safari)
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Di iPhone/iPad, Notifikasi Push memerlukan aplikasi dipasang ke Layar Utama.
              </p>
            </div>

            <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300">
                📌 Cara Pasang ke Layar Utama:
              </p>
              <ol className="text-xs text-zinc-700 dark:text-zinc-300 space-y-2.5 list-decimal list-inside font-medium">
                <li>
                  Tekan ikon <strong>Share (⎋)</strong> di baris navigasi bawah Safari.
                </li>
                <li>
                  Geser ke bawah lalu pilih <strong>&quot;Tambah ke Layar Utama&quot;</strong> (Add to Home Screen).
                </li>
                <li>
                  Buka ikon <strong>KIAN HQ</strong> dari Layar Utama HP Anda untuk mengaktifkan notifikasi instan.
                </li>
              </ol>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              Saya Mengerti
            </button>
          </>
        )}
      </div>
    </div>
  );
}
