'use client';

import { useState } from 'react';
import { approveAssignment, requestRevision } from '@/modules/tasks/actions';

export default function ReviewActions({
  assignmentId,
  canRequestRevision,
}: {
  assignmentId: string;
  canRequestRevision: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
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

  const handleRevision = async () => {
    if (!revisionNote.trim()) {
      setError('Please write a revision note before submitting.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await requestRevision(assignmentId, revisionNote.trim());
      if (res.success) {
        setDone(true);
      } else {
        setError(res.error ?? 'Failed to request revision');
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

      {!showRevisionInput ? (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/15 dark:border-emerald-500/25 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
          >
            {loading ? '...' : '✓ Approve'}
          </button>
          {canRequestRevision && (
            <button
              onClick={() => setShowRevisionInput(true)}
              disabled={loading}
              className="flex-1 bg-red-500/5 hover:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/15 dark:border-red-500/25 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
            >
              ✗ Request Revision
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
            Revision Note <span className="text-red-500">*</span>
          </label>
          <textarea
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            rows={3}
            placeholder="Explain what needs to be changed..."
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-red-500 dark:focus:border-red-500 focus:ring-4 focus:ring-red-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRevision}
              disabled={loading}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
            >
              {loading ? '...' : 'Send Revision Request'}
            </button>
            <button
              onClick={() => { setShowRevisionInput(false); setRevisionNote(''); setError(null); }}
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
