'use client';

import { useState } from 'react';
import { assignMultipleCreatorsToTask, removeTaskAssignment } from '@/modules/tasks/actions';

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

interface Member {
  userId: string;
  userName: string | null;
  userEmail: string;
  teamRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR')[];
}

const ASSIGNMENT_ROLES = ['RESEARCHER', 'PLANNER', 'DESIGNER', 'VIDEO_EDITOR', 'CREATOR', 'PIC', 'REVIEWER', 'HELPER', 'APPROVER'] as const;
type AssignmentRole = typeof ASSIGNMENT_ROLES[number];

const roleConfig: Record<string, { color: string; label: string; desc: string }> = {
  RESEARCHER:   { color: 'text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/15', label: 'Researcher', desc: 'Step 1: Mencari ide & moodboard referensi' },
  PLANNER:      { color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/15', label: 'Planner', desc: 'Step 2: Membuat script & brief konsep' },
  DESIGNER:     { color: 'text-purple-700 dark:text-purple-400 bg-purple-500/10 border-purple-500/15', label: 'Designer', desc: 'Step 3: Produksi desain grafis / visual asset' },
  VIDEO_EDITOR: { color: 'text-pink-700 dark:text-pink-400 bg-pink-500/10 border-pink-500/15', label: 'Video Editor', desc: 'Step 3: Editing video & sound effect' },
  CREATOR:      { color: 'text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/15', label: 'Creator (General)', desc: 'Step 3: Produksi konten umum' },
  PIC:          { color: 'text-purple-700 dark:text-purple-400 bg-purple-500/10 border-purple-500/15', label: 'PIC',      desc: 'Penanggung jawab tugas reguler' },
  REVIEWER:     { color: 'text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/15', label: 'Reviewer', desc: 'Peninjau hasil kerja' },
  HELPER:       { color: 'text-teal-700 dark:text-teal-400 bg-teal-500/10 border-teal-500/15', label: 'Helper', desc: 'Pemberi bantuan teknis' },
  APPROVER:     { color: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/15', label: 'Approver', desc: 'Pemberi persetujuan akhir' },
};

export default function TaskAssignmentPanel({
  taskId,
  taskType,
  taskDeadline,
  existingAssignments,
  users,
  members,
  isOjt = false,
}: {
  taskId: string;
  taskType?: string;
  taskDeadline?: number | null;
  existingAssignments: ExistingAssignment[];
  users: User[];
  members: Member[];
  isOjt?: boolean;
}) {
  // Batch form state: mapping role -> userId and role -> deadline (date string YYYY-MM-DD)
  const [roleUserMap, setRoleUserMap] = useState<Record<string, string>>({});
  const [roleDeadlineMap, setRoleDeadlineMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const activeRoles = isOjt
    ? taskType === 'VIDEO'
      ? (['RESEARCHER', 'PLANNER', 'VIDEO_EDITOR'] as const)
      : (['RESEARCHER', 'PLANNER', 'DESIGNER'] as const)
    : ASSIGNMENT_ROLES;

  const eligibleUsers = users.filter((u) => {
    return members.some((m) => m.userId === u.id);
  });

  // Calculate maxDate string for datetime-local input HTML attribute
  const maxDateStr = taskDeadline
    ? (() => {
        const d = new Date(taskDeadline);
        if (isNaN(d.getTime())) return undefined;
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })()
    : undefined;

  const handleBatchAssign = async () => {
    setError(null);
    const toAssign: Array<{ userId: string; role: AssignmentRole; deadline?: number | null }> = [];

    for (const role of activeRoles) {
      const isAssigned = existingAssignments.some((a) => a.assignment_role === role);
      const selectedUserId = roleUserMap[role];
      const deadlineStr = roleDeadlineMap[role];
      const deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;

      // Validation: step deadline cannot be later than task overall deadline
      if (deadline && taskDeadline && deadline > taskDeadline) {
        const taskDeadlineFormatted = new Date(taskDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        return setError(`Deadline untuk step ${role} tidak boleh melebihi batas akhir task (${taskDeadlineFormatted}).`);
      }

      if (!isAssigned && selectedUserId) {
        toAssign.push({ userId: selectedUserId, role, deadline });
      }
    }

    if (toAssign.length === 0) {
      return setError('Pilih minimal satu user pada role yang belum ter-assign.');
    }

    setLoading(true);
    try {
      const res = await assignMultipleCreatorsToTask(taskId, toAssign);
      if (res.success) {
        setRoleUserMap({});
        setRoleDeadlineMap({});
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

  const hasUnassignedRoles = activeRoles.some(
    (role) => !existingAssignments.some((a) => a.assignment_role === role)
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
          Assign Team Members
        </p>
        {hasUnassignedRoles && (
          <button
            onClick={() => { setOpen((o) => !o); setError(null); }}
            className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-colors"
          >
            {open ? '↑ Close' : '+ Assign Members'}
          </button>
        )}
      </div>

      {/* Batch Assignment Form */}
      {open && (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
            Pilih anggota tim dan target deadline pengumpulan untuk masing-masing step di bawah, lalu klik <span className="font-bold text-purple-600 dark:text-purple-400">Simpan Semua Penugasan</span>.
          </p>

          <div className="space-y-3">
            {activeRoles.map((role) => {
              const cfg = roleConfig[role];
              const existing = existingAssignments.find((a) => a.assignment_role === role);

              return (
                <div
                  key={role}
                  className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-lg border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {existing && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓ Sudah ditugaskan: {existing.user_name}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">{cfg.desc}</p>
                  </div>

                  {!existing && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <select
                        value={roleUserMap[role] || ''}
                        onChange={(e) =>
                          setRoleUserMap((prev) => ({ ...prev, [role]: e.target.value }))
                        }
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 transition-all cursor-pointer sm:w-48"
                      >
                        <option value="">-- Pilih Anggota --</option>
                        {eligibleUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="datetime-local"
                        max={maxDateStr}
                        value={roleDeadlineMap[role] || ''}
                        onChange={(e) =>
                          setRoleDeadlineMap((prev) => ({ ...prev, [role]: e.target.value }))
                        }
                        onClick={(e) => {
                          try { e.currentTarget.showPicker?.(); } catch {}
                        }}
                        title={maxDateStr ? `Batas maksimum deadline step: ${maxDateStr}` : 'Target Deadline Pengumpulan Step'}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-purple-500 transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                      />

                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleBatchAssign}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white disabled:text-zinc-400 dark:disabled:text-zinc-500 font-bold text-xs py-2.5 rounded-xl transition-all disabled:opacity-60 active:scale-[0.98] shadow-sm"
          >
            {loading ? 'Menyimpan...' : '💾 Simpan Semua Penugasan'}
          </button>
        </div>
      )}


      {/* Current Assignments */}
      {existingAssignments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {existingAssignments.map((a) => {
            const cfg = roleConfig[a.assignment_role] ?? { color: 'text-zinc-500 bg-zinc-100', label: a.assignment_role };
            return (
              <div
                key={a.id}
                className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-xl border ${cfg.color}`}
              >
                <span className="font-black uppercase">{cfg.label}</span>
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
