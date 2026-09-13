'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveAndIssueDocumentAction,
  rejectDocumentAction,
  submitForApprovalAction,
} from '../documentActions';

interface DocumentDetailApprovalBarProps {
  documentId: string;
  documentNumber: string;
  status: string;
  rejectionReason?: string | null;
  isPrivileged: boolean;
  isCreator: boolean;
}

export const DocumentDetailApprovalBar: React.FC<DocumentDetailApprovalBarProps> = ({
  documentId,
  documentNumber,
  status,
  rejectionReason,
  isPrivileged,
  isCreator,
}) => {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [customNumber, setCustomNumber] = useState('');
  const [showCustomNumInput, setShowCustomNumInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await approveAndIssueDocumentAction({
        documentId,
        custom_number: customNumber.trim() || undefined,
      });

      if (res.success) {
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Gagal menyetujui dokumen.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error saat memproses persetujuan.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReasonText.trim()) {
      setErrorMsg('Alasan penolakan / instruksi revisi wajib diisi.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await rejectDocumentAction({
        documentId,
        reason: rejectReasonText.trim(),
      });

      if (res.success) {
        setShowRejectInput(false);
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Gagal menolak dokumen.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error saat menolak dokumen.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitApproval = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await submitForApprovalAction(documentId);
      if (res.success) {
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Gagal mengajukan dokumen.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error saat mengajukan.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (status === 'ISSUED' || status === 'GENERATED' || status === 'SIGNED') {
    return null;
  }

  return (
    <div className="no-print space-y-3">
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-500">
          ⚠️ {errorMsg}
        </div>
      )}

      {status === 'REJECTED' && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <span>⚠️</span> Dokumen ini Ditolak / Perlu Revisi
            </span>
            {isCreator && (
              <button
                type="button"
                onClick={handleSubmitApproval}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                Ajukan Ulang
              </button>
            )}
          </div>
          {rejectionReason && (
            <p className="text-xs text-zinc-700 dark:text-zinc-300">
              <strong>Catatan Manajemen:</strong> {rejectionReason}
            </p>
          )}
        </div>
      )}

      {status === 'DRAFT' && isCreator && (
        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
              💾 Status Draf (Belum Diajukan)
            </span>
            <p className="text-[11px] text-zinc-500">
              Dokumen ini belum diajukan ke Manajemen untuk penerbitan nomor surat resmi.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSubmitApproval}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            {isProcessing ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>📨</span>
            )}
            <span>Ajukan untuk Persetujuan</span>
          </button>
        </div>
      )}

      {status === 'PENDING_APPROVAL' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Menunggu Persetujuan &amp; Penerbitan Resmi
              </span>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                {isPrivileged
                  ? 'Anda memiliki kewenangan untuk meninjau, menyetujui, dan menerbitkan dokumen resmi ini.'
                  : 'Dokumen sedang ditinjau oleh Admin / Manajemen. Nomor surat resmi akan diterbitkan setelah disetujui.'}
              </p>
            </div>

            {isPrivileged && !showRejectInput && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomNumInput(!showCustomNumInput)}
                  className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-200"
                >
                  ⚙️ {showCustomNumInput ? 'Tutup Custom No' : 'Custom No'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectInput(true)}
                  className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 text-xs font-bold transition-all"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {isProcessing ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>✓</span>
                  )}
                  <span>Setujui &amp; Terbitkan Resmi</span>
                </button>
              </div>
            )}
          </div>

          {isPrivileged && showCustomNumInput && !showRejectInput && (
            <div className="pt-2 border-t border-amber-500/20 flex items-center gap-3">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                Nomor Surat Custom:
              </label>
              <input
                type="text"
                value={customNumber}
                onChange={(e) => setCustomNumber(e.target.value)}
                placeholder="Kosongkan untuk alokasi otomatis (e.g. 1/KIAN/TROOPERS/IX/2026)"
                className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono"
              />
            </div>
          )}

          {isPrivileged && showRejectInput && (
            <div className="pt-3 border-t border-amber-500/20 space-y-2">
              <label className="text-xs font-bold text-red-600 dark:text-red-400">
                Alasan Penolakan / Catatan Revisi <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={rejectReasonText}
                onChange={(e) => setRejectReasonText(e.target.value)}
                placeholder="Tuliskan catatan perbaikan atau alasan penolakan..."
                className="w-full px-3 py-2 rounded-xl border border-red-300 dark:border-red-700 bg-white dark:bg-zinc-800 text-xs"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1"
                >
                  {isProcessing ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  <span>Kirim Penolakan</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
