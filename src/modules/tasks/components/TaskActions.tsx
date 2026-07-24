'use client';

import { useState } from 'react';
import { submitResult, deleteTask } from '../actions';

interface TaskAssignment {
  id:              string;
  assignment_role: string;
  status:          string;
  result_url:      string | null;
  revision_note:   string | null;
  user_id:         string;
  user_name:       string | null;
}

interface TaskActionsProps {
  taskId:      string;
  assignments: TaskAssignment[];
  currentUserId: string;
  canDelete:   boolean;
}

const roleColors: Record<string, string> = {
  PIC:      'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/15',
  REVIEWER: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/15',
  HELPER:   'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/15',
  APPROVER: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/15',
};

const statusColors: Record<string, string> = {
  DRAFT:              'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',
  SUBMITTED:          'text-orange-600 dark:text-orange-400 bg-orange-500/5 border-orange-500/15',
  WAITING_REVIEW:     'text-yellow-600 dark:text-yellow-400 bg-yellow-500/5 border-yellow-500/15',
  REVISION_REQUESTED: 'text-red-600 dark:text-red-400 bg-red-500/5 border-red-500/15',
  RESUBMITTED:        'text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 border-indigo-500/15',
  APPROVED:           'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/15',
  LOCKED:             'text-zinc-700 dark:text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
  PUBLISHED:          'text-purple-600 dark:text-purple-400 bg-purple-500/5 border-purple-500/15',
  ARCHIVED:           'text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800',
  DECLINED:           'text-red-800 dark:text-red-500 bg-red-800/10 border-red-800/20',
};

function AssignmentCard({
  assignment,
  isMe,
}: {
  assignment: TaskAssignment;
  isMe: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(assignment.result_url ?? '');
  const [showSubmit, setShowSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await submitResult(assignment.id, url.trim());
      if (res.success) {
        setShowSubmit(false);
      } else {
        setError(res.error ?? 'Failed to submit');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const role = roleColors[assignment.assignment_role] ?? 'text-zinc-500 bg-zinc-100 border-zinc-200';
  const status = statusColors[assignment.status] ?? statusColors.DRAFT;

  return (
    <div className={`rounded-xl border p-3 space-y-2 text-xs ${isMe ? 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800' : 'bg-zinc-50/50 dark:bg-zinc-900/20 border-zinc-100 dark:border-zinc-800/50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${role}`}>
            {assignment.assignment_role}
          </span>
          <span className="text-zinc-700 dark:text-zinc-300 font-bold">{assignment.user_name ?? 'Unknown'}</span>
          {isMe && <span className="text-[9px] text-purple-600 dark:text-purple-400 font-black">(you)</span>}
        </div>
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${status}`}>
          {assignment.status.replace('_', ' ')}
        </span>
      </div>

      {/* Revision note */}
      {assignment.revision_note && (assignment.status === 'REVISION_REQUESTED' || assignment.status === 'DECLINED') && (
        <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2 text-[10px] text-red-700 dark:text-red-400">
          📝 {assignment.revision_note}
        </div>
      )}

      {/* Result link */}
      {assignment.result_url && (
        <a
          href={assignment.result_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-500 hover:underline font-bold truncate"
        >
          🔗 View result
        </a>
      )}

      {/* My actions */}
      {isMe && (
        <div className="space-y-2 pt-1">
          {error && <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>}

          {['DRAFT', 'REVISION_REQUESTED', 'DECLINED'].includes(assignment.status) && (
            <>
              {showSubmit ? (
                <form onSubmit={handleSubmit} className="flex gap-1.5">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste Google Drive / result link..."
                    required
                    className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 text-zinc-900 dark:text-zinc-100 text-[11px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    {loading ? '...' : 'Submit'}
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowSubmit(true)}
                  className="w-full bg-purple-500/5 hover:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/15 font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all active:scale-[0.97]"
                >
                  {assignment.status === 'REVISION_REQUESTED'
                    ? '📤 Resubmit Result'
                    : assignment.status === 'DECLINED'
                    ? '🔄 Create Again & Submit'
                    : '📤 Submit Result'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskActions({ taskId, assignments, currentUserId, canDelete }: TaskActionsProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Delete this task and all its assignments? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteTask(taskId);
    } catch {
      alert('Failed to delete task');
      setDeleting(false);
    }
  };

  if (assignments.length === 0 && !canDelete) return null;

  return (
    <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800/60 mt-4">
      {/* Assignment list */}
      {assignments.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Assignments</p>
          {assignments.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              isMe={a.user_id === currentUserId}
            />
          ))}
        </div>
      )}

      {/* Delete */}
      {canDelete && (
        <div className="pt-1">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 dark:text-red-400 hover:bg-red-500/5 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-transparent hover:border-red-500/10 transition-all disabled:opacity-50 active:scale-[0.97]"
          >
            {deleting ? 'Deleting...' : 'Delete Task'}
          </button>
        </div>
      )}
    </div>
  );
}
