'use client';

import { useState } from 'react';
import { approveAssignment, requestRevision, declineAssignment } from '@/modules/tasks/actions';
import { approveAssessmentMentorStep, requestAssessmentRevision as requestAssessmentRevisionAction, approveAssessmentSubmission } from '@/modules/workspaces/assessmentActions';
import { useUI } from '@/components/ui/UIProvider';

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
}: {
  assignmentId: string;
  canRequestRevision: boolean;
  canAwardBadge?: boolean;
  taskType?: string | null;
  isAssessmentMentorStep?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'NONE' | 'SPARK_MODAL' | 'REVISION' | 'DECLINE'>('NONE');
  const [sparks, setSparks] = useState<number>(8);
  const [noteText, setNoteText] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useUI();

  const handleQuickApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await approveAssignment(assignmentId);
      if (res.success) {
        setDone(true);
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
      // For assessment coordinator step, use the assessment-specific action
      const isAssessmentCoordStep = taskType === 'ASSESSMENT' && !isAssessmentMentorStep;
      const res = isAssessmentCoordStep
        ? await approveAssessmentSubmission(assignmentId, '', sparks, noteText.trim())
        : await approveAssignment(assignmentId, sparks, noteText.trim());
      if (res.success) {
        setDone(true);
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
    if (!noteText.trim()) {
      const msg = 'Harap isi catatan penjelasan keputusan terlebih dahulu.';
      setError(msg);
      toast(msg, 'warning');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === 'REVISION'
          ? (taskType === 'ASSESSMENT'
              ? await requestAssessmentRevisionAction(assignmentId, '', noteText.trim())
              : await requestRevision(assignmentId, noteText.trim()))
          : await declineAssignment(assignmentId, noteText.trim());

      if (res.success) {
        setDone(true);
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
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              if (canAwardBadge) {
                setMode('SPARK_MODAL');
              } else {
                handleQuickApprove();
              }
            }}
            disabled={loading}
            className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] flex items-center justify-center gap-1.5"
          >
            <span>{canAwardBadge ? '✓ Approve & Award Sparks ✨' : '✓ Approve QC'}</span>
          </button>
          {canRequestRevision && (
            <>
              <button
                onClick={() => setMode('REVISION')}
                disabled={loading}
                className="flex-1 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/15 dark:border-yellow-500/25 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
              >
                Request Revision
              </button>
              <button
                onClick={() => setMode('DECLINE')}
                disabled={loading}
                className="flex-1 bg-red-500/5 hover:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/15 dark:border-red-500/25 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
              >
                Decline
              </button>
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

          <div>
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Catatan apresiasi pengerjaan (opsional)..."
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3.5 py-2 focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>

          <div className="flex gap-2 justify-end pt-0.5">
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
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-1.5 rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : `Kirim ${sparks} ✨ & Setujui`}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
            {mode === 'REVISION' ? 'Revision Note' : 'Decline Reason'} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder={
              mode === 'REVISION'
                ? 'Explain what needs to be changed for this revision...'
                : 'Explain why this submission is declined/rejected...'
            }
            className={`w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all resize-none ${
              mode === 'REVISION'
                ? 'focus:border-yellow-500 dark:focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/10'
                : 'focus:border-red-500 dark:focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            }`}
          />
          <div className="flex gap-2">
            <button
              onClick={handleActionWithNote}
              disabled={loading}
              className={`flex-1 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] ${
                mode === 'REVISION' ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              {loading ? '...' : mode === 'REVISION' ? 'Send Revision Request' : 'Decline Submission'}
            </button>
            <button
              onClick={() => {
                setMode('NONE');
                setNoteText('');
                setError(null);
              }}
              className="px-4 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
