'use client';

import { useState } from 'react';
import { approveAssignment, requestRevision, declineAssignment } from '@/modules/tasks/actions';

export default function ReviewActions({
  assignmentId,
  canRequestRevision,
}: {
  assignmentId: string;
  canRequestRevision: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'NONE' | 'REVISION' | 'DECLINE'>('NONE');
  const [noteText, setNoteText] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await approveAssignment(assignmentId);
      if (res.success) {
        setDone(true);
      } else {
        setError(res.error ?? 'Failed to approve');
      }
    } catch (e: any) {
      setError(e.message ?? 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleActionWithNote = async () => {
    if (!noteText.trim()) {
      setError('Please write a note explaining the decision.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === 'REVISION'
          ? await requestRevision(assignmentId, noteText.trim())
          : await declineAssignment(assignmentId, noteText.trim());

      if (res.success) {
        setDone(true);
      } else {
        setError(res.error ?? `Failed to perform ${mode.toLowerCase()} action.`);
      }
    } catch (e: any) {
      setError(e.message ?? 'An error occurred');
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

  return (
    <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-900">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {mode === 'NONE' ? (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/15 dark:border-emerald-500/25 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
          >
            {loading ? '...' : '✓ Approve'}
          </button>
          {canRequestRevision && (
            <>
              <button
                onClick={() => setMode('REVISION')}
                disabled={loading}
                className="flex-1 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/15 dark:border-yellow-500/25 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
              >
                ✗ Request Revision
              </button>
              <button
                onClick={() => setMode('DECLINE')}
                disabled={loading}
                className="flex-1 bg-red-500/5 hover:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/15 dark:border-red-500/25 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
              >
                🛑 Decline
              </button>
            </>
          )}
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
