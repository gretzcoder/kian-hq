'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { DocxDocumentViewer } from '@/components/editor/TiptapEditor';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { approveAssessmentTask, requestAssessmentBriefRevision } from '@/modules/workspaces/assessmentActions';
import { useUI } from '@/components/ui/UIProvider';

export interface PendingAssessmentBrief {
  task_id: string;
  task_title: string;
  brief_description: string | null;
  task_priority: string;
  task_type: string;
  task_status: string;
  task_created_by: string | null;
  task_creator_name: string | null;
  assigned_mentors: string | null;
  assignedMentorNames: string;
  deadline: number | null;
  extended_deadline: number | null;
  workspace_id: string | null;
  workspace_name: string | null;
  project_name: string;
  exec_type: string;
}

export default function AssessmentBriefReviewCard({
  brief,
}: {
  brief: PendingAssessmentBrief;
}) {
  const [sparksToGrant, setSparksToGrant] = useState<number>(5);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingAction, startTransition] = useTransition();
  const { toast } = useUI();

  const handleApprove = () => {
    if (!brief.workspace_id) return;
    setError(null);
    setLoading(true);

    startTransition(async () => {
      try {
        const res = await approveAssessmentTask(
          brief.task_id,
          brief.workspace_id!,
          brief.exec_type || 'DESIGNER',
          sparksToGrant
        );
        if (res.success) {
          setDone(true);
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kian_notif_refresh'));
          toast(`✓ Brief Assessment berhasil di-ACC (${sparksToGrant} Sparks) & dipublikasikan ke OJT!`, 'success');
        } else {
          const msg = res.error ?? 'Gagal menyetujui brief assessment';
          setError(msg);
          toast(msg, 'error');
        }
      } catch (err: any) {
        const msg = err.message ?? 'Terjadi kesalahan';
        setError(msg);
        toast(msg, 'error');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleRequestRevision = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContent = revisionNote.replace(/<[^>]*>/g, '').trim();
    if (!cleanContent) {
      setError('Harap isi catatan revisi brief terlebih dahulu.');
      toast('Harap isi catatan revisi brief terlebih dahulu.', 'warning');
      return;
    }
    if (!brief.workspace_id) return;

    setError(null);
    setLoading(true);

    startTransition(async () => {
      try {
        const res = await requestAssessmentBriefRevision(
          brief.task_id,
          brief.workspace_id!,
          revisionNote.trim()
        );
        if (res.success) {
          setDone(true);
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kian_notif_refresh'));
          toast('↩ Permintaan revisi brief berhasil dikirim ke Mentor!', 'info');
        } else {
          const msg = res.error ?? 'Gagal mengirim permintaan revisi brief';
          setError(msg);
          toast(msg, 'error');
        }
      } catch (err: any) {
        const msg = err.message ?? 'Terjadi kesalahan';
        setError(msg);
        toast(msg, 'error');
      } finally {
        setLoading(false);
      }
    });
  };

  const priorityColors: Record<string, string> = {
    LOW: 'text-zinc-400',
    NORMAL: 'text-zinc-500',
    HIGH: 'text-orange-500',
    URGENT: 'text-red-500 font-black',
  };

  if (done) {
    return (
      <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-3xl p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
              Brief Assessment &ldquo;{brief.task_title}&rdquo; Berhasil Diproses
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Halaman akan memperbarui data secara otomatis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-purple-500/20 dark:border-purple-500/30 bg-white dark:bg-[#09090b]/60 rounded-3xl p-6 shadow-sm flex flex-col gap-4 relative overflow-hidden">
      {/* Header Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest truncate">
              {brief.project_name}
            </span>
            {brief.workspace_name && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">›</span>
                <span className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                  {brief.workspace_name}
                </span>
              </>
            )}
          </div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base flex items-center gap-2">
            <span>✨</span>
            <span>{brief.task_title}</span>
          </h3>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            MENUNGGU ACC BRIEF
          </span>
          <span className={`text-[10px] font-bold uppercase ${priorityColors[brief.task_priority] ?? 'text-zinc-500'}`}>
            {brief.task_priority}
          </span>
        </div>
      </div>

      {/* Info Box */}
      <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/40 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 text-[11px] text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center justify-between gap-2 flex-wrap font-bold">
          <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
            <span>🎓 Mentor Bertugas:</span>
            <strong className="text-zinc-900 dark:text-zinc-200 font-black">
              {brief.assignedMentorNames}
            </strong>
          </span>
          {brief.deadline && (
            <span className="font-mono text-zinc-400 text-[10px]">
              Deadline: {new Date(brief.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {brief.workspace_id && (
          <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 flex justify-end">
            <Link
              href={`/dashboard/workspace/${brief.workspace_id}?taskId=${brief.task_id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-[11px] font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-xl hover:bg-purple-500/20 transition-all active:scale-95 shadow-xs"
              title="Buka sumber informasi task ini langsung di Workspace"
            >
              <span>🔗 Buka Task di Workspace</span>
              <span>↗</span>
            </Link>
          </div>
        )}
      </div>

      {/* Brief Content Viewer */}
      {brief.brief_description ? (
        <DocxDocumentViewer
          content={brief.brief_description}
          roleName="Brief / Instruksi Pengerjaan Assessment"
        />
      ) : (
        <div className="text-xs text-zinc-400 italic p-3 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
          Brief / Instruksi pengerjaan belum diisi oleh mentor.
        </div>
      )}

      {/* Error notification */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2">
          ⚠️ {error}
        </p>
      )}

      {/* Action Controls */}
      <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
        {!showRevisionForm ? (
          <div className="space-y-3 bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                ✨ Penilaian Kualitas Brief Mentor (1 - 10 Sparks)
              </span>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                {sparksToGrant}/10 Sparks
              </span>
            </div>

            {/* 1-10 Sparks selector */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isSelected = sparksToGrant === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSparksToGrant(num)}
                    className={`py-1.5 rounded-xl text-xs font-black transition-all ${
                      isSelected
                        ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 scale-105 ring-2 ring-purple-500/30'
                        : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <button
                type="button"
                onClick={handleApprove}
                disabled={loading || pendingAction}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>✓ ACC Brief ({sparksToGrant} ✨) & Publikasikan</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRevisionForm(true)}
                disabled={loading || pendingAction}
                className="px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 font-bold text-xs rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 shrink-0 cursor-pointer"
              >
                ↩ Request Revisi Brief
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRequestRevision} className="space-y-3 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <label className="block text-[10px] font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest flex items-center gap-1">
              <span>📝</span> Catatan Detail Revisi Brief untuk Mentor <span className="text-red-500">*</span>
            </label>
            <TiptapEditor
              value={revisionNote}
              onChange={setRevisionNote}
              placeholder="Jelaskan secara detail bagian brief / instruksi yang perlu diperbaiki oleh mentor..."
              minHeight="min-h-[120px]"
            />
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowRevisionForm(false);
                  setRevisionNote('');
                  setError(null);
                }}
                disabled={loading || pendingAction}
                className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || pendingAction}
                className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-md shadow-yellow-500/20 disabled:opacity-50 active:scale-[0.97] cursor-pointer"
              >
                {loading || pendingAction ? 'Mengirim...' : 'Kirim Catatan Revisi Brief'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
