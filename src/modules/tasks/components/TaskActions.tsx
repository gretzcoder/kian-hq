'use client';

import { useState } from 'react';
import { updateTaskStatus, submitTaskAsset, deleteTask } from '../actions';

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  gdrive_asset_url: string | null;
  status: string;
  assigned_to: string | null;
  created_by: string;
  deadline: number | null;
}

export default function TaskActions({
  task,
  currentUserId,
  canApprove,
  canDelete,
}: {
  task: Task;
  currentUserId: string;
  canApprove: boolean;
  canDelete: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [assetUrl, setAssetUrl] = useState(task.gdrive_asset_url || '');
  const [isEditingUrl, setIsEditingUrl] = useState(!task.gdrive_asset_url);

  const isAssignedToMe = task.assigned_to === currentUserId;

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      const res = await updateTaskStatus(task.id, newStatus);
      if (!res.success) {
        alert(res.error || 'Failed to update task status');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetUrl) return;

    setLoading(true);
    try {
      const res = await submitTaskAsset(task.id, assetUrl);
      if (res.success) {
        setIsEditingUrl(false);
      } else {
        alert(res.error || 'Failed to submit asset URL');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    setLoading(true);
    try {
      const res = await deleteTask(task.id);
      if (!res.success) {
        alert(res.error || 'Failed to delete task');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/60 mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      {/* 1. Deliverable Submission Form (For assigned creator) */}
      <div className="flex-1">
        {isAssignedToMe ? (
          <div>
            {isEditingUrl ? (
              <form onSubmit={handleAssetSubmit} className="flex gap-2 w-full max-w-md">
                <input
                  type="url"
                  value={assetUrl}
                  onChange={(e) => setAssetUrl(e.target.value)}
                  placeholder="Paste Google Drive asset link..."
                  required
                  disabled={loading}
                  className="flex-1 bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all duration-200"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
                >
                  Submit
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-3 text-xs">
                <a
                  href={task.gdrive_asset_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-bold underline truncate max-w-xs block"
                >
                  🔗 Submitted Deliverable
                </a>
                <button
                  onClick={() => setIsEditingUrl(true)}
                  disabled={loading}
                  className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-bold px-2.5 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900/60 transition-all active:scale-[0.97]"
                >
                  Edit Link
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {task.gdrive_asset_url ? (
              <a
                href={task.gdrive_asset_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-bold underline text-xs inline-flex items-center gap-1.5"
              >
                🔗 View Deliverable
              </a>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500 text-xs italic font-medium">No submission yet</span>
            )}
          </div>
        )}
      </div>

      {/* 2. Interactive Status Buttons / Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Creator can toggle IN_PROGRESS state */}
        {isAssignedToMe && task.status === 'TODO' && (
          <button
            onClick={() => handleStatusChange('IN_PROGRESS')}
            disabled={loading}
            className="bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15 dark:border-blue-500/25 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
          >
            Start Work
          </button>
        )}

        {/* Executive / Coordinator Approval controls on IN_REVIEW */}
        {canApprove && task.status === 'IN_REVIEW' && (
          <>
            <button
              onClick={() => handleStatusChange('APPROVED')}
              disabled={loading}
              className="bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 dark:border-emerald-500/25 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
            >
              ✓ Approve
            </button>
            <button
              onClick={() => handleStatusChange('IN_PROGRESS')}
              disabled={loading}
              className="bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/15 dark:border-red-500/25 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
            >
              ✗ Reject (Re-work)
            </button>
          </>
        )}

        {/* Executive / Coordinator Complete controls on APPROVED */}
        {canApprove && task.status === 'APPROVED' && (
          <button
            onClick={() => handleStatusChange('COMPLETED')}
            disabled={loading}
            className="bg-purple-500/5 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/15 dark:border-purple-500/25 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
          >
            Complete Task
          </button>
        )}

        {/* Delete button (If permitted) */}
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="text-red-600 dark:text-red-400 hover:bg-red-500/5 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-transparent hover:border-red-500/10 transition-all disabled:opacity-50 active:scale-[0.97]"
          >
            Delete Task
          </button>
        )}
      </div>
    </div>
  );
}
