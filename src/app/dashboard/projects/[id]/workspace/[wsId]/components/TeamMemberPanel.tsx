'use client';

import { useState } from 'react';
import { addWorkspaceMember, updateWorkspaceMemberRole, removeWorkspaceMember } from '@/modules/workspaces/actions';

interface Member {
  userId: string;
  userName: string | null;
  userEmail: string;
  teamRole: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR';
}

const roleLabels: Record<string, { label: string; color: string }> = {
  LEADER:     { label: 'Ketua Tim', color: 'text-purple-700 bg-purple-500/10 border-purple-500/20' },
  RESEARCHER: { label: 'Researcher', color: 'text-blue-700 bg-blue-500/10 border-blue-500/20' },
  PLANNER:    { label: 'Planner', color: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20' },
  CREATOR:    { label: 'Creator', color: 'text-pink-700 bg-pink-500/10 border-pink-500/20' },
};

export default function TeamMemberPanel({
  workspaceId,
  members,
  canManageMembers,
}: {
  workspaceId: string;
  members: Member[];
  canManageMembers: boolean;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR'>('RESEARCHER');
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
      const res = await addWorkspaceMember(workspaceId, email, role);
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

  const handleRoleChange = async (userId: string, newRole: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR') => {
    setUpdating(userId);
    try {
      const res = await updateWorkspaceMemberRole(workspaceId, userId, newRole);
      if (!res.success) alert(res.error ?? 'Failed to update role.');
    } catch (err: any) {
      alert(err.message || 'Failed to update role.');
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

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">OJT Team Members</h2>
        <p className="text-zinc-500 dark:text-zinc-500 text-xs mt-0.5">
          Manage internship assignments, roles, and collaboration for this team.
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

      {/* Add Member Form (LEADER/Mentor only) */}
      {canManageMembers && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4">
          <div className="md:col-span-1.5">
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

          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Team Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-700 dark:text-zinc-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all cursor-pointer"
            >
              <option value="RESEARCHER">Content Researcher</option>
              <option value="PLANNER">Content Planner</option>
              <option value="CREATOR">Content Creator</option>
              <option value="LEADER">Ketua Tim (Leader)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all disabled:opacity-60 active:scale-[0.98] h-[38px] md:w-full"
          >
            {loading ? 'Adding...' : '+ Add to Team'}
          </button>
        </form>
      )}

      {/* Member List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-900/60">
        {members.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 italic text-center py-4">No team members assigned yet.</p>
        ) : (
          members.map((m) => {
            const roleCfg = roleLabels[m.teamRole] || { label: m.teamRole, color: 'text-zinc-500 bg-zinc-100' };
            const isSelfUpdating = updating === m.userId;

            return (
              <div key={m.userId} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{m.userName || 'Unknown User'}</p>
                  <p className="text-[10px] text-zinc-400 font-mono truncate">{m.userEmail}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {canManageMembers ? (
                    <select
                      value={m.teamRole}
                      disabled={isSelfUpdating}
                      onChange={(e) => handleRoleChange(m.userId, e.target.value as any)}
                      className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-bold rounded-lg px-2 py-1 text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
                    >
                      <option value="LEADER">Ketua Tim</option>
                      <option value="RESEARCHER">Researcher</option>
                      <option value="PLANNER">Planner</option>
                      <option value="CREATOR">Creator</option>
                    </select>
                  ) : (
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${roleCfg.color}`}>
                      {roleCfg.label}
                    </span>
                  )}

                  {canManageMembers && (
                    <button
                      onClick={() => handleRemove(m.userId, m.userName)}
                      disabled={isSelfUpdating}
                      className="text-xs text-red-500 hover:text-red-600 font-black p-1.5 rounded-lg hover:bg-red-500/5 transition-all"
                      title="Remove member"
                    >
                      ✕
                    </button>
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
