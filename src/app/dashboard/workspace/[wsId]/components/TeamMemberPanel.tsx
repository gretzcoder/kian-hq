'use client';

import { useState } from 'react';
import { addWorkspaceMember, updateWorkspaceMemberRoles, removeWorkspaceMember } from '@/modules/workspaces/actions';

interface Member {
  userId: string;
  userName: string | null;
  userEmail: string;
  teamRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[];
}

const roleConfig: Record<'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR', { label: string; activeColor: string; inactiveColor: string }> = {
  LEADER: {
    label: 'Ketua Tim',
    activeColor: 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/40 border-purple-200 dark:border-purple-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-purple-300 dark:hover:border-purple-800/40'
  },
  RESEARCHER: {
    label: 'Researcher',
    activeColor: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-blue-300 dark:hover:border-blue-800/40'
  },
  PLANNER: {
    label: 'Planner',
    activeColor: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-emerald-300 dark:hover:border-emerald-800/40'
  },
  CREATOR: {
    label: 'Creator',
    activeColor: 'text-pink-700 bg-pink-100 dark:text-pink-300 dark:bg-pink-900/40 border-pink-200 dark:border-pink-800/60',
    inactiveColor: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/40 hover:border-pink-300 dark:hover:border-pink-800/40'
  },
};

export default function TeamMemberPanel({
  workspaceId,
  members,
  canManageMembers,
  isMentor,
}: {
  workspaceId: string;
  members: Member[];
  canManageMembers: boolean;
  isMentor: boolean;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await addWorkspaceMember(workspaceId, email); // Defaults to MEMBER
      if (res.success) {
        setEmail('');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(res.error ?? 'Failed to add team member.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (
    userId: string,
    currentRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[],
    roleToToggle: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR'
  ) => {
    setUpdating(userId);
    let newRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[];
    
    // Toggle the role in the array
    if (currentRoles.includes(roleToToggle)) {
      newRoles = currentRoles.filter((r) => r !== roleToToggle);
    } else {
      newRoles = [...currentRoles, roleToToggle];
    }

    try {
      const res = await updateWorkspaceMemberRoles(workspaceId, userId, newRoles);
      if (!res.success) alert(res.error ?? 'Failed to update roles.');
    } catch (err: any) {
      alert(err.message || 'Failed to update roles.');
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (userId: string, name: string | null) => {
    if (!confirm(`Remove ${name || 'member'} from the team?`)) return;

    setUpdating(userId);
    try {
      const res = await removeWorkspaceMember(workspaceId, userId);
      if (!res.success) alert(res.error ?? 'Failed to remove member.');
    } catch (err: any) {
      alert(err.message || 'Failed to remove member.');
    } finally {
      setUpdating(null);
    }
  };

  const canToggleRole = (roleToToggle: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR') => {
    if (!canManageMembers) return false;
    if (roleToToggle === 'LEADER') {
      return isMentor; // Only mentor can assign/remove team leader
    }
    // OJT roles can be toggled by either Mentor or Team Leader (via canManageMembers)
    return true;
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">OJT Team Members</h2>
        <p className="text-zinc-500 dark:text-zinc-500 text-xs mt-0.5">
          Manage internship assignments, roles, and collaboration for this team. A member can hold multiple roles.
        </p>
      </div>

      {/* Error & Success Messages */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3">
          ✓ Team member added successfully!
        </p>
      )}

      {/* Add Member Form (Mentor only) */}
      {isMentor && (
        <form onSubmit={handleAdd} className="flex gap-3 items-end bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4">
          <div className="flex-1">
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Member Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="intern@kian-eo.com"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all disabled:opacity-60 active:scale-[0.98] h-[38px] shrink-0"
          >
            {loading ? 'Adding...' : '+ Invite Member'}
          </button>
        </form>
      )}

      {/* Member List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-900/60">
        {members.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 italic text-center py-4">No team members assigned yet.</p>
        ) : (
          members.map((m) => {
            const isSelfUpdating = updating === m.userId;

            return (
              <div key={m.userId} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{m.userName || 'Unknown User'}</p>
                    <p className="text-[10px] text-zinc-400 font-mono truncate">{m.userEmail}</p>
                  </div>

                  {isMentor && (
                    <button
                      onClick={() => handleRemove(m.userId, m.userName)}
                      disabled={isSelfUpdating}
                      className="text-xs text-red-500 hover:text-red-600 font-black p-1.5 rounded-lg hover:bg-red-500/5 transition-all"
                      title="Remove member"
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                {/* Roles Selector / Display */}
                <div className="flex flex-wrap gap-2">
                  {(['LEADER', 'RESEARCHER', 'PLANNER', 'CREATOR'] as const).map((r) => {
                    const hasRole = m.teamRoles.includes(r);
                    const cfg = roleConfig[r];
                    const clickable = canToggleRole(r);
                    const classes = `text-[9px] font-black uppercase px-2.5 py-1 rounded-full border transition-all ${
                      hasRole ? cfg.activeColor : cfg.inactiveColor
                    } ${clickable && !isSelfUpdating ? 'cursor-pointer active:scale-95' : 'pointer-events-none opacity-50'}`;

                    return (
                      <button
                        key={r}
                        type="button"
                        disabled={isSelfUpdating || !clickable}
                        onClick={() => handleToggleRole(m.userId, m.teamRoles, r)}
                        className={classes}
                      >
                        {hasRole ? '✓ ' : ''}
                        {cfg.label}
                      </button>
                    );
                  })}
                  {isSelfUpdating && (
                    <span className="text-[10px] text-zinc-400 animate-pulse font-bold self-center">Updating...</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
