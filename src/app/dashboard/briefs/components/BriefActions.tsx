'use client';

import { useState } from 'react';
import {
  submitBrief,
  approveBrief,
  requestBriefChanges,
  unlockBrief,
} from '@/modules/content-brief/actions';

interface BriefActionsProps {
  briefId:         string;
  status:          string;
  canApprove:      boolean;
  canRequestChanges: boolean;
  canUnlock:       boolean;
  canSubmit:       boolean;
  canCreateProject: boolean;
  isOwner:         boolean;
}

export default function BriefActions({
  briefId,
  status,
  canApprove,
  canRequestChanges,
  canUnlock,
  canSubmit,
  canCreateProject,
  isOwner,
}: BriefActionsProps) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState<'changes' | 'unlock' | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrap = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fn();
      if (res.success) setDone(true);
      else setError(res.error ?? 'Action failed');
    } catch (e: any) {
      setError(e.message ?? 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3">
        ✓ Done — page will refresh shortly.
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Note input */}
      {showNoteInput && (
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
            {showNoteInput === 'changes' ? 'Changes Required Note' : 'Unlock Reason'} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={showNoteInput === 'changes' ? 'Explain what needs to change...' : 'Reason for unlocking...'}
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-yellow-500 dark:focus:border-yellow-500 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-4 focus:ring-yellow-500/10 transition-all resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => wrap(() =>
                showNoteInput === 'changes'
                  ? requestBriefChanges(briefId, note)
                  : unlockBrief(briefId, note)
              )}
              disabled={loading}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? '...' : 'Confirm'}
            </button>
            <button
              onClick={() => { setShowNoteInput(null); setNote(''); }}
              className="px-3 py-2 text-xs font-bold text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showNoteInput && (
        <div className="flex gap-2 flex-wrap">
          {/* COLLABORATOR: Submit DRAFT → WAITING_REVIEW */}
          {status === 'DRAFT' && (canSubmit || isOwner) && (
            <button
              onClick={() => wrap(() => submitBrief(briefId))}
              disabled={loading}
              className="flex-1 bg-blue-500/5 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/15 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
            >
              {loading ? '...' : '📤 Submit for Review'}
            </button>
          )}

          {/* COORDINATOR: Approve WAITING_REVIEW → LOCKED */}
          {status === 'WAITING_REVIEW' && canApprove && (
            <button
              onClick={() => wrap(() => approveBrief(briefId))}
              disabled={loading}
              className="flex-1 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/15 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
            >
              {loading ? '...' : '✓ Approve & Lock'}
            </button>
          )}

          {/* COORDINATOR: Request Changes → DRAFT */}
          {status === 'WAITING_REVIEW' && canRequestChanges && (
            <button
              onClick={() => setShowNoteInput('changes')}
              disabled={loading}
              className="flex-1 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/15 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
            >
              ✗ Request Changes
            </button>
          )}

          {/* COORDINATOR: Unlock LOCKED → DRAFT */}
          {(status === 'LOCKED') && canUnlock && (
            <button
              onClick={() => setShowNoteInput('unlock')}
              disabled={loading}
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
            >
              🔓 Unlock Brief
            </button>
          )}

          {/* COORDINATOR: Create Project from LOCKED brief */}
          {status === 'LOCKED' && canCreateProject && (
            <a
              href={`/dashboard/projects?briefId=${briefId}`}
              className="flex-1 text-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all active:scale-[0.97] shadow-sm"
            >
              🚀 Create Project
            </a>
          )}

          {/* Terminal states: no actions */}
          {['PROJECT_CREATED', 'ARCHIVED'].includes(status) && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">No further actions available.</span>
          )}
        </div>
      )}
    </div>
  );
}
