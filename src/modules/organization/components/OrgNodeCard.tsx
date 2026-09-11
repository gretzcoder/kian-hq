'use client';

import React from 'react';
import { OrgNodeItem } from '../orgTypes';
import UserAvatar from '@/components/ui/UserAvatar';

interface OrgNodeCardProps {
  node: OrgNodeItem;
  canManage: boolean;
  onEdit: (node: OrgNodeItem) => void;
  onDelete: (id: string, name: string) => void;
  onManageMembers: (node: OrgNodeItem) => void;
  onAddChild?: (parentId: string) => void;
  isCompact?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/20',
    border: 'border-purple-200 dark:border-purple-800/60',
    text: 'text-purple-700 dark:text-purple-300',
    gradient: 'from-purple-600 to-indigo-600',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/20',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    text: 'text-indigo-700 dark:text-indigo-300',
    gradient: 'from-indigo-600 to-blue-600',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800/60',
    text: 'text-blue-700 dark:text-blue-300',
    gradient: 'from-blue-600 to-sky-600',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    gradient: 'from-emerald-600 to-teal-600',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800/60',
    text: 'text-amber-700 dark:text-amber-300',
    gradient: 'from-amber-600 to-orange-600',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-200 dark:border-rose-800/60',
    text: 'text-rose-700 dark:text-rose-300',
    gradient: 'from-rose-600 to-pink-600',
  },
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/20',
    border: 'border-cyan-200 dark:border-cyan-800/60',
    text: 'text-cyan-700 dark:text-cyan-300',
    gradient: 'from-cyan-600 to-blue-600',
  },
};

export const OrgNodeCard: React.FC<OrgNodeCardProps> = ({
  node,
  canManage,
  onEdit,
  onDelete,
  onManageMembers,
  onAddChild,
  isCompact = false,
}) => {
  const c = COLOR_MAP[node.color] || COLOR_MAP.purple;
  const auth = node.authorities || {};
  const members = node.members || [];
  const leads = members.filter((m) => m.is_lead);

  return (
    <div
      className={`rounded-3xl border ${c.border} ${c.bg} bg-white dark:bg-[#0c0c0e] shadow-md hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden relative group`}
      style={{ minWidth: isCompact ? '280px' : '320px' }}
    >
      {/* Top Accent Strip */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${c.gradient}`} />

      <div className="p-5 space-y-4">
        {/* Header: Icon, Type Badge & Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-center text-xl shadow-xs shrink-0">
              {node.icon || '🏢'}
            </div>
            <div>
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${c.border} ${c.text}`}>
                {node.type}
              </span>
              <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 mt-0.5 leading-snug">
                {node.name}
              </h3>
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onEdit(node)}
                className="p-1.5 text-xs text-zinc-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors"
                title="Edit Struktur"
              >
                ✏️
              </button>
              {onAddChild && (
                <button
                  type="button"
                  onClick={() => onAddChild(node.id)}
                  className="p-1.5 text-xs text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                  title="Tambah Sub-Divisi"
                >
                  ➕
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(node.id, node.name)}
                className="p-1.5 text-xs text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                title="Hapus Struktur"
              >
                🗑️
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        {node.description && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
            {node.description}
          </p>
        )}

        {/* Delegated Authorities Badges */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {auth.can_review_tasks && (
            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 inline-flex items-center gap-1">
              <span>🎨</span> QC: {auth.review_scope === 'ALL' ? 'Semua Task' : auth.review_labels?.slice(0, 2).join(', ') || 'Label Design'}
            </span>
          )}
          {auth.can_manage_briefs && (
            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 inline-flex items-center gap-1">
              <span>📄</span> Briefs
            </span>
          )}
          {auth.can_manage_documents && (
            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 inline-flex items-center gap-1">
              <span>📑</span> Dokumen
            </span>
          )}
          {auth.can_manage_sparks && (
            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 inline-flex items-center gap-1">
              <span>✨</span> Sparks
            </span>
          )}
          {auth.can_view_all_workspaces && (
            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 inline-flex items-center gap-1">
              <span>🌐</span> All WS
            </span>
          )}
        </div>

        {/* Members Section */}
        <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Personil ({members.length})
            </span>
            {canManage && (
              <button
                type="button"
                onClick={() => onManageMembers(node)}
                className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
              >
                + Kelola Anggota
              </button>
            )}
          </div>

          {members.length === 0 ? (
            <p className="text-[11px] text-zinc-400 italic">Belum ada anggota ditugaskan.</p>
          ) : (
            <div className="space-y-1.5">
              {/* Leaders highlight */}
              {leads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-2 p-1.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <UserAvatar name={lead.name} src={lead.avatar_url} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1">
                      <span>👑</span> {lead.name}
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate">
                      {lead.role_title || 'Lead Divisi'}
                    </p>
                  </div>
                </div>
              ))}

              {/* Other members avatar stack */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {members
                  .filter((m) => !m.is_lead)
                  .slice(0, 5)
                  .map((m) => (
                    <div key={m.id} className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 px-2 py-0.5 rounded-full" title={`${m.name} (${m.role_title})`}>
                      <UserAvatar name={m.name} src={m.avatar_url} size="xs" />
                      <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300 max-w-[80px] truncate">
                        {m.name.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                {members.filter((m) => !m.is_lead).length > 5 && (
                  <span className="text-[10px] font-bold text-zinc-500 px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    +{members.filter((m) => !m.is_lead).length - 5}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
