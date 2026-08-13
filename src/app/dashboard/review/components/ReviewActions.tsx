'use client';

import { useState } from 'react';
import { approveAssignment, requestRevision, declineAssignment } from '@/modules/tasks/actions';
import { approveAssessmentMentorStep, requestAssessmentRevision as requestAssessmentRevisionAction, approveAssessmentSubmission } from '@/modules/workspaces/assessmentActions';
import { useUI } from '@/components/ui/UIProvider';
import { safeExecuteAction } from '@/lib/safeAction';

import SendReminderButton from '@/components/SendReminderButton';
import TiptapEditor from '@/components/editor/TiptapEditor';

export function getSparkMeta(spark: number): { label: string; emoji: string; color: string } {
  if (spark >= 9) return { label: 'LEGENDARY SPARK', emoji: '👑', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' };
  if (spark >= 7) return { label: 'GREAT SPARK', emoji: '💎', color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' };
  if (spark >= 5) return { label: 'SOLID SPARK', emoji: '⚡', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' };
  if (spark >= 3) return { label: 'FAIR SPARK', emoji: '👍', color: 'text-sky-500 bg-sky-500/10 border-sky-500/30' };
  return { label: 'MINIMUM SPARK', emoji: '🩹', color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/30' };
}

export default function ReviewActions({
  assignmentId,
  canRequestRevision,
  canAwardBadge = true,
  taskType,
  isAssessmentMentorStep = false,
  creatorName,
  isStaffOrCoord = false,
  mentorApproved = 0,
  coordinatorApproved = 0,
  isTaskMentor = false,
  isMentorWs = false,
}: {
  assignmentId: string;
  canRequestRevision: boolean;
  canAwardBadge?: boolean;
  taskType?: string | null;
  isAssessmentMentorStep?: boolean;
  creatorName?: string | null;
  isStaffOrCoord?: boolean;
  mentorApproved?: number;
  coordinatorApproved?: number;
  isTaskMentor?: boolean;
  isMentorWs?: boolean;
}) {
  const isMentorWorkspace = isMentorWs || taskType === 'MENTOR';
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'NONE' | 'SPARK_MODAL' | 'REVISION' | 'DECLINE'>('NONE');
  const [sparks, setSparks] = useState<number>(8);
  const [noteText, setNoteText] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useUI();

  const callApiFallback = async (actionType: 'APPROVE' | 'REVISION' | 'DECLINE') => {
    const res = await fetch('/api/review/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType,
        assignmentId,
        sparks,
        noteText: noteText.trim(),
        isAssessmentCoordStep: taskType === 'ASSESSMENT' && !isAssessmentMentorStep,
        isAssessmentMentorStep,
      }),
    });
    return await res.json();
  };

  const handleQuickApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await safeExecuteAction<any>(
        () => approveAssignment(assignmentId),
        () => callApiFallback('APPROVE')
      );
      if (res.success) {
        setDone(true);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kian_notif_refresh'));
        toast('Persetujuan QC berhasil disimpan!', 'success');
      } else {
        const msg = res.error ?? 'Failed to approve';
        setError(msg);
        toast(msg, 'error');
      }
    } catch (e: any) {
      const msg = e.message ?? 'An error occurred';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveWithSparks = async () => {
    setLoading(true);
    setError(null);
    try {
      const isAssessmentCoordStep = taskType === 'ASSESSMENT' && !isAssessmentMentorStep;
      const res = await safeExecuteAction<any>(
        () =>
          isAssessmentCoordStep
            ? approveAssessmentSubmission(assignmentId, '', sparks, noteText.trim())
            : approveAssignment(assignmentId, sparks, noteText.trim()),
        () => callApiFallback('APPROVE')
      );
      if (res.success) {
        setDone(true);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kian_notif_refresh'));
        toast(`Persetujuan disimpan dengan ${sparks} ✨ Creative Sparks!`, 'success');
      } else {
        const msg = res.error ?? 'Failed to approve';
        setError(msg);
        toast(msg, 'error');
      }
    } catch (e: any) {
      const msg = e.message ?? 'An error occurred';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActionWithNote = async () => {
    const cleanContent = noteText.replace(/<[^>]*>/g, '').trim();
    if (!cleanContent) {
      const msg = 'Harap isi catatan penjelasan keputusan terlebih dahulu.';
      setError(msg);
      toast(msg, 'warning');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const isRevision = mode === 'REVISION';
      const actionType = isRevision ? 'REVISION' : 'DECLINE';
      const res = await safeExecuteAction<any>(
        () =>
          isRevision
            ? taskType === 'ASSESSMENT'
              ? requestAssessmentRevisionAction(assignmentId, '', noteText.trim())
              : requestRevision(assignmentId, noteText.trim())
            : declineAssignment(assignmentId, noteText.trim()),
        () => callApiFallback(actionType)
      );

      if (res.success) {
        setDone(true);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kian_notif_refresh'));
        toast(
          mode === 'REVISION'
            ? 'Permintaan revisi berhasil dikirim!'
            : 'Penugasan telah ditolak.',
          mode === 'REVISION' ? 'info' : 'warning'
        );
      } else {
        const msg = res.error ?? `Failed to perform ${mode.toLowerCase()} action.`;
        setError(msg);
        toast(msg, 'error');
      }
    } catch (e: any) {
      const msg = e.message ?? 'An error occurred';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 px-4 py-3 rounded-xl">
        ✓ Action submitted — page will refresh shortly.
      </div>
    );
  }

  const currentSparkMeta = getSparkMeta(sparks);

  return (
    <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-900">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {mode === 'NONE' ? (
        isAssessmentMentorStep ? (
          /* Assessment Step 1: Mentor creator — ACC Mentor (no sparks) + Request Revisi */
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const res = await approveAssessmentMentorStep(assignmentId, '');
                  if (res.success) {
                    setDone(true);
                    toast('ACC Mentor berhasil! Submission diteruskan ke Koordinator.', 'success');
                  } else {
                    const msg = res.error ?? 'Gagal ACC Mentor';
                    setError(msg);
                    toast(msg, 'error');
                  }
                } catch (e: any) {
                  const msg = e.message ?? 'An error occurred';
                  setError(msg);
                  toast(msg, 'error');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] flex items-center justify-center gap-1.5"
            >
              <span>✓ ACC Mentor</span>
            </button>
            <button
              onClick={() => setMode('REVISION')}
              disabled={loading}
              className="flex-1 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/15 dark:border-yellow-500/25 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
            >
              ↩ Request Revisi
            </button>
          </div>
        ) : (
        <div className="flex gap-2 flex-wrap items-center">
          {mentorApproved === 0 && !isMentorWorkspace ? (
            isStaffOrCoord && !isTaskMentor ? (
              <div className="w-full p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <span>⏳ Menunggu Review Tahap 1 oleh Mentor</span>
                    {creatorName && <strong className="text-zinc-900 dark:text-zinc-100">({creatorName})</strong>}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
                    Belum ACC Mentor
                  </span>
                </div>
                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                  Koordinator belum dapat memberikan penilaian final & sparks sebelum mentor pembuat task menyetujui hasil submit ini.
                </p>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <SendReminderButton
                    assignmentId={assignmentId}
                    targetRole="MENTOR"
                    mentorName={creatorName}
                    className="py-2 px-3 text-xs"
                  />
                  {canRequestRevision && (
                    <button
                      type="button"
                      onClick={() => setMode('REVISION')}
                      disabled={loading}
                      className="px-3.5 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer"
                    >
                      ↩ Request Revisi
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (canAwardBadge) {
                      setMode('SPARK_MODAL');
                    } else {
                      handleQuickApprove();
                    }
                  }}
                  disabled={loading}
                  className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] flex items-center justify-center gap-1.5 min-w-[140px]"
                >
                  <span>{canAwardBadge ? '✓ Approve & Award Sparks ✨' : '✓ Approve QC'}</span>
                </button>
                {canRequestRevision && (
                  <>
                    <button
                      onClick={() => setMode('REVISION')}
                      disabled={loading}
                      className="flex-1 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/15 dark:border-yellow-500/25 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] min-w-[120px]"
                    >
                      Request Revision
                    </button>
                    <button
                      onClick={() => setMode('DECLINE')}
                      disabled={loading}
                      className="flex-1 bg-red-500/5 hover:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/15 dark:border-red-500/25 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] min-w-[80px]"
                    >
                      Decline
                    </button>
                  </>
                )}
              </>
            )
          ) : mentorApproved === 1 && coordinatorApproved === 0 ? (
            isStaffOrCoord ? (
              <>
                <button
                  onClick={() => {
                    if (canAwardBadge) {
                      setMode('SPARK_MODAL');
                    } else {
                      handleQuickApprove();
                    }
                  }}
                  disabled={loading}
                  className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] flex items-center justify-center gap-1.5 min-w-[140px]"
                >
                  <span>{canAwardBadge ? '✓ Approve & Award Sparks ✨' : '✓ Approve QC'}</span>
                </button>
                {canRequestRevision && (
                  <>
                    <button
                      onClick={() => setMode('REVISION')}
                      disabled={loading}
                      className="flex-1 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/15 dark:border-yellow-500/25 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] min-w-[120px]"
                    >
                      Request Revision
                    </button>
                    <button
                      onClick={() => setMode('DECLINE')}
                      disabled={loading}
                      className="flex-1 bg-red-500/5 hover:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/15 dark:border-red-500/25 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] min-w-[80px]"
                    >
                      Decline
                    </button>
                  </>
                )}
              </>
            ) : (
              <SendReminderButton
                assignmentId={assignmentId}
                targetRole="COORDINATOR"
                className="py-2.5 w-full justify-center"
              />
            )
          ) : (
            <>
              <button
                onClick={() => {
                  if (canAwardBadge) {
                    setMode('SPARK_MODAL');
                  } else {
                    handleQuickApprove();
                  }
                }}
                disabled={loading}
                className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] flex items-center justify-center gap-1.5 min-w-[140px]"
              >
                <span>{canAwardBadge ? '✓ Approve & Award Sparks ✨' : '✓ Approve QC'}</span>
              </button>
              {canRequestRevision && (
                <>
                  <button
                    onClick={() => setMode('REVISION')}
                    disabled={loading}
                    className="flex-1 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/15 dark:border-yellow-500/25 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] min-w-[120px]"
                  >
                    Request Revision
                  </button>
                  <button
                    onClick={() => setMode('DECLINE')}
                    disabled={loading}
                    className="flex-1 bg-red-500/5 hover:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/15 dark:border-red-500/25 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] min-w-[80px]"
                  >
                    Decline
                  </button>
                </>
              )}
            </>
          )}
        </div>
        )
      ) : mode === 'SPARK_MODAL' ? (
        <div className="space-y-3.5 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
              ✨ Berikan Creative Sparks (1 - 10)
            </label>
            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${currentSparkMeta.color}`}>
              {currentSparkMeta.emoji} {currentSparkMeta.label} ({sparks}/10)
            </span>
          </div>

          {/* 1 to 10 Sparks Selector Buttons */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const isSelected = sparks === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSparks(num)}
                  className={`py-2 rounded-xl text-xs font-black transition-all ${
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

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1">
              <span>💬</span> Catatan Apresiasi & Feedback Evaluator (WYSIWYG / Opsional)
            </label>
            <TiptapEditor
              value={noteText}
              onChange={(val) => setNoteText(val)}
              placeholder="Tulis catatan apresiasi, saran perbaikan, atau tips berharga (opsional gunakan Bold, Highlight, List, Link, dll)..."
              minHeight="min-h-[110px]"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => { setMode('NONE'); setNoteText(''); setError(null); }}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              onClick={handleApproveWithSparks}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-purple-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? 'Menyimpan...' : `Kirim ${sparks} ✨ & Setujui`}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
          <label className="block text-[10px] font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest flex items-center gap-1">
            <span>{mode === 'REVISION' ? '📝' : '⚠️'}</span>
            <span>{mode === 'REVISION' ? 'Catatan Detail Revisi (WYSIWYG Text Editor)' : 'Alasan Penolakan (WYSIWYG Text Editor)'}</span>
            <span className="text-red-500">*</span>
          </label>
          <TiptapEditor
            value={noteText}
            onChange={(val) => setNoteText(val)}
            placeholder={
              mode === 'REVISION'
                ? 'Jelaskan secara detail poin-poin yang perlu diperbaiki (gunakan Bold, Poin List, atau Link jika ada rujukan/aset)...'
                : 'Jelaskan alasan penolakan penugasan ini...'
            }
            minHeight="min-h-[140px]"
          />
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => {
                setMode('NONE');
                setNoteText('');
                setError(null);
              }}
              className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all"
            >
              Batal
            </button>
            <button
              onClick={handleActionWithNote}
              disabled={loading}
              className={`text-white font-bold text-xs px-5 py-2 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] ${
                mode === 'REVISION'
                  ? 'bg-yellow-600 hover:bg-yellow-500 shadow-md shadow-yellow-500/20'
                  : 'bg-red-600 hover:bg-red-500 shadow-md shadow-red-500/20'
              }`}
            >
              {loading ? 'Submitting...' : mode === 'REVISION' ? 'Kirim Permintaan Revisi' : 'Tolak Penugasan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
