'use client';

import { useState } from 'react';
import { assignCreatorToTask, removeTaskAssignment } from '@/modules/tasks/actions';

interface ExistingAssignment {
  id: string;
  user_id: string;
  assignment_role: string;
  status: string;
  user_name: string | null;
}

interface User {
  id: string;
  name: string;
}

const ASSIGNMENT_ROLES = ['PIC', 'REVIEWER', 'HELPER', 'APPROVER'] as const;
type AssignmentRole = typeof ASSIGNMENT_ROLES[number];

const roleConfig: Record<string, { color: string; label: string; desc: string }> = {
  PIC:      { color: 'text-purple-700 dark:text-purple-400 bg-purple-500/10 border-purple-500/15', label: 'PIC',      desc: 'Person in Charge — lead creator' },
  REVIEWER: { color: 'text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/15',         label: 'Reviewer', desc: 'Reviews and gives feedback' },
  HELPER:   { color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/15', label: 'Helper', desc: 'Supports the PIC' },
  APPROVER: { color: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/15',     label: 'Approver', desc: 'Has final approval rights' },
};

export default function TaskAssignmentPanel({
  taskId,
  existingAssignments,
  users,
}: {
  taskId: string;
  existingAssignments: ExistingAssignment[];
  users: User[];
}) {
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState<AssignmentRole>('PIC');
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Users already assigned to this task
  const assignedUserIds = new Set(existingAssignments.map((a) => a.user_id));

  const handleAssign = async () => {
    if (!selectedUser) return setError('Please select a user.');
    setLoading(true);
    setError(null);
    try {
      const res = await assignCreatorToTask(taskId, selectedUser, selectedRole);
      if (res.success) {
        setSelectedUser('');
        setOpen(false);
      } else {
        setError(res.error ?? 'Assignment failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (!confirm('Remove this assignment?')) return;
    setRemoving(assignmentId);
    try {
      await removeTaskAssignment(assignmentId);
    } catch {
      alert('Failed to remove assignment');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
          Assign Team Members
        </p>
        <button
          onClick={() => { setOpen((o) => !o); setError(null); }}
          className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-colors"
        >
          {open ? '↑ Close' : '+ Add Assignment'}
        </button>
      </div>

      {/* Assignment Form */}
      {open && (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Role Selector */}
          <div className="grid grid-cols-4 gap-1.5">
            {ASSIGNMENT_ROLES.map((role) => {
              const cfg = roleConfig[role];
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  title={cfg.desc}
                  className={`text-[10px] font-black uppercase tracking-wide px-2 py-2 rounded-xl border transition-all ${
                    selectedRole === role
                      ? cfg.color
                      : 'text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Role description */}
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">{roleConfig[selectedRole].desc}</p>

          {/* User Selector */}
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all"
          >
            <option value="">Select team member...</option>
            {users
              .filter((u) => !assignedUserIds.has(u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
          </select>

          <button
            onClick={handleAssign}
            disabled={loading || !selectedUser}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white disabled:text-zinc-400 dark:disabled:text-zinc-500 font-bold text-xs py-2.5 rounded-xl transition-all disabled:opacity-60 active:scale-[0.98]"
          >
            {loading ? 'Assigning...' : `Assign as ${selectedRole}`}
          </button>
        </div>
      )}

      {/* Current Assignments */}
      {existingAssignments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {existingAssignments.map((a) => {
            const cfg = roleConfig[a.assignment_role] ?? roleConfig.PIC;
            return (
              <div
                key={a.id}
                className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-xl border ${cfg.color}`}
              >
                <span className="font-black uppercase">{a.assignment_role}</span>
                <span className="text-zinc-600 dark:text-zinc-300 font-medium">{a.user_name ?? 'Unknown'}</span>
                <button
                  onClick={() => handleRemove(a.id)}
                  disabled={removing === a.id}
                  className="ml-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors text-[11px] font-black"
                  title="Remove assignment"
                >
                  {removing === a.id ? '...' : '×'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {existingAssignments.length === 0 && !open && (
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">No one assigned yet.</p>
      )}
    </div>
  );
}
