'use client';

import { useState, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  createAssessmentTask,
  updateAssessmentTask,
  submitAssessmentWork,
  approveAssessmentSubmission,
  approveAssessmentMentorStep,
  requestAssessmentRevision,
  approveAssessmentTask,
  requestAssessmentBriefRevision,
  deleteAssessmentTask,
  toggleAssessmentReaction,
  removeAssessmentAssignment,
  addAssessmentAssignment,
} from '@/modules/workspaces/assessmentActions';
import TiptapEditor, { DocxDocumentViewer } from '@/components/editor/TiptapEditor';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { SubmittedLinkPreviewer } from '@/components/editor/SubmittedLinkPreviewer';
import { CollapsibleNoteViewer } from '@/components/CollapsibleNoteViewer';
import { cleanAppreciationNote } from '@/lib/noteUtils';
import SendReminderButton from '@/components/SendReminderButton';
import { safeExecuteAction } from '@/lib/safeAction';

import EditTaskMultiplierModal from '@/modules/tasks/components/EditTaskMultiplierModal';
import { ExtendDeadlineModal } from '@/components/ExtendDeadlineModal';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReactionItem {
  emoji: string;
  count: number;
  user_reacted: number;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: number;
  deadline?: number | null;
  extended_deadline?: number | null;
  start_at?: number | null;
  revision_note?: string | null;
  sparks?: number | null;
  sparks_multiplier?: number | null;
  created_by?: string | null;
  creator_name?: string | null;
  assessment_category?: string | null;
}

interface AssignmentRow {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string | null;
  assignment_role: string;
  status: string;
  result_url: string | null;
  revision_note: string | null;
  appreciation_note?: string | null;
  submitted_at: number | null;
  lead_approved: number;
  mentor_approved: number;
  coordinator_approved: number;
  sparks: number | null;
  group_name?: string | null;
}

export interface WorkspaceMemberSimple {
  id?: string;
  userId?: string;
  name: string;
  email: string;
}

interface AssessmentPanelProps {
  workspaceId:        string;
  tasks:              TaskRow[];
  assignmentsByTask:  Record<string, AssignmentRow[]>;
  reactionsMap?:      Record<string, ReactionItem[]>;
  currentUserId:      string;
  isLeader:           boolean;   // mentor in assessment context
  isCoordinator:      boolean;
  isOJT:              boolean;
  allWorkspaceMembers?: WorkspaceMemberSimple[];
}

// ── Status helpers ────────────────────────────────────────────────────────────

export function getTaskAssignmentStatusMeta(
  status: string,
  startAt?: number | null,
  deadline?: number | null,
  extendedDeadline?: number | null
): { label: string; badgeClass: string; isPastDeadline: boolean; isNotStarted: boolean; isExtended: boolean; penaltyPercent: number } {
  const now = Date.now();
  const effectiveDeadline = Math.max(extendedDeadline || 0, deadline || 0) || null;
  const isNotStarted = Boolean(startAt && startAt > now);
  const isPastDeadline = Boolean(effectiveDeadline && effectiveDeadline < now);
  const isExtended = Boolean(extendedDeadline && extendedDeadline > (deadline || 0));

  let penaltyPercent = 0;
  let daysExtended = 0;
  if (isExtended && deadline && extendedDeadline) {
    daysExtended = Math.max(1, Math.ceil((extendedDeadline - deadline) / (24 * 3600 * 1000)));
    penaltyPercent = Math.min(100, daysExtended * 10);
  } else if (deadline && now > deadline) {
    const daysLate = Math.ceil((now - deadline) / (24 * 3600 * 1000));
    penaltyPercent = Math.min(100, Math.max(10, daysLate * 10));
  }

  if (status === 'APPROVED') {
    return {
      label: '✅ Disetujui',
      badgeClass: 'bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 border-emerald-500/15 font-bold',
      isPastDeadline: false,
      isNotStarted: false,
      isExtended: false,
      penaltyPercent: 0,
    };
  }

  if (status === 'WAITING_REVIEW' || status === 'RESUBMITTED') {
    const subLabel = isExtended && daysExtended > 0 ? `📤 Menunggu Review (Extend H+${daysExtended})` : '📤 Menunggu Review';
    return {
      label: subLabel,
      badgeClass: 'bg-yellow-500/8 text-yellow-700 dark:text-yellow-400 border-yellow-500/15 font-bold',
      isPastDeadline: false,
      isNotStarted: false,
      isExtended,
      penaltyPercent,
    };
  }

  if (isNotStarted) {
    return {
      label: '⏳ Belum Dimulai',
      badgeClass: 'bg-indigo-500/8 text-indigo-600 dark:text-indigo-400 border-indigo-500/15 font-bold',
      isPastDeadline: false,
      isNotStarted: true,
      isExtended: false,
      penaltyPercent: 0,
    };
  }

  if (isPastDeadline) {
    if (status === 'REVISION_REQUESTED') {
      return {
        label: '🚨 Revisi Terlambat',
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-black animate-pulse',
        isPastDeadline: true,
        isNotStarted: false,
        isExtended,
        penaltyPercent,
      };
    }
    return {
      label: '🚨 Melewati Deadline',
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-black animate-pulse',
      isPastDeadline: true,
      isNotStarted: false,
      isExtended,
      penaltyPercent,
    };
  }

  if (isExtended) {
    const hLabel = daysExtended > 0 ? `H+${daysExtended}` : 'Extend';
    return {
      label: `⏳ Extended (${hLabel} • Sparks -${penaltyPercent}%)`,
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 font-black',
      isPastDeadline: false,
      isNotStarted: false,
      isExtended: true,
      penaltyPercent,
    };
  }

  if (status === 'REVISION_REQUESTED') {
    return {
      label: '↩ Revisi Diminta',
      badgeClass: 'bg-red-500/8 text-red-600 dark:text-red-400 border-red-500/15 font-bold',
      isPastDeadline: false,
      isNotStarted: false,
      isExtended: false,
      penaltyPercent: 0,
    };
  }

  if (status === 'IN_PROGRESS') {
    return {
      label: '⚙️ Sedang Dikerjakan',
      badgeClass: 'bg-indigo-500/8 text-indigo-600 dark:text-indigo-400 border-indigo-500/15 font-bold',
      isPastDeadline: false,
      isNotStarted: false,
      isExtended: false,
      penaltyPercent: 0,
    };
  }

  return {
    label: '📋 Belum Mulai',
    badgeClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 font-bold',
    isPastDeadline: false,
    isNotStarted: false,
    isExtended: false,
    penaltyPercent: 0,
  };
}

const EXEC_TYPE_LABEL: Record<string, string> = {
  DESIGNER:     '🎨 Design',
  VIDEO_EDITOR: '🎬 Video',
};

/**
 * Formats a Unix timestamp into a `YYYY-MM-DDTHH:mm` string in Indonesia WIB (UTC+7)
 * suitable for HTML <input type="datetime-local"> defaultValue.
 */
function formatIndonesiaDatetimeInput(ts: number | null | undefined): string {
  if (!ts) return '';
  const wibMs = ts + 7 * 60 * 60 * 1000;
  const wibDate = new Date(wibMs);
  return wibDate.toISOString().slice(0, 16);
}

// ── Sub-component: Create Assessment Task Form ────────────────────────────────

function CreateAssessmentTaskForm({
  workspaceId,
  onCreated,
  allWorkspaceMembers = [],
}: {
  workspaceId: string;
  onCreated: () => void;
  allWorkspaceMembers?: WorkspaceMemberSimple[];
}) {
  const [open,        setOpen]        = useState(false);
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState<'INDIVIDUAL' | 'GROUP'>('INDIVIDUAL');
  const [groups,      setGroups]      = useState<Array<{ id: string; name: string; userIds: string[] }>>([
    { id: 'g_1', name: 'Kelompok 1', userIds: [] },
    { id: 'g_2', name: 'Kelompok 2', userIds: [] },
  ]);
  const [error,       setError]       = useState<string | null>(null);
  const [pending, startTransition]    = useTransition();

  // Filter available troopers (non-staff / non-mentor members)
  const availableTroopers = allWorkspaceMembers;

  const handleAddGroup = () => {
    setGroups((prev) => [
      ...prev,
      { id: `g_${Date.now()}_${Math.random()}`, name: `Kelompok ${prev.length + 1}`, userIds: [] },
    ]);
  };

  const handleRemoveGroup = (groupId: string) => {
    if (groups.length <= 1) return;
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const handleGroupNameChange = (groupId: string, name: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name } : g))
    );
  };

  const handleToggleTrooperInGroup = (groupId: string, userId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const exists = g.userIds.includes(userId);
          return {
            ...g,
            userIds: exists ? g.userIds.filter((id) => id !== userId) : [...g.userIds, userId],
          };
        } else {
          // Remove from other group so a trooper belongs to 1 group at a time
          return { ...g, userIds: g.userIds.filter((id) => id !== userId) };
        }
      })
    );
  };

  const handleAutoDistributeTroopers = () => {
    if (availableTroopers.length === 0 || groups.length === 0) return;
    const trooperIds = availableTroopers.map((t) => t.userId || t.id || '').filter(Boolean);
    const updatedGroups = groups.map((g) => ({ ...g, userIds: [] as string[] }));

    trooperIds.forEach((uId, idx) => {
      const targetGrpIdx = idx % updatedGroups.length;
      updatedGroups[targetGrpIdx].userIds.push(uId);
    });

    setGroups(updatedGroups);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!description.replace(/<[^>]*>/g, '').trim()) {
      setError('Brief / Instruksi Pengerjaan wajib diisi');
      return;
    }

    if (category === 'GROUP') {
      const emptyGroup = groups.find((g) => g.userIds.length === 0);
      if (emptyGroup) {
        setError(`Kelompok "${emptyGroup.name}" belum memiliki anggota. Pilih minimal 1 anggota per kelompok.`);
        return;
      }
    }

    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createAssessmentTask(workspaceId, fd);
      if (res.success) {
        setOpen(false);
        setDescription('');
        setCategory('INDIVIDUAL');
        onCreated();
      } else {
        setError(res.error ?? 'Gagal membuat assessment');
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
      >
        <span>✨</span>
        <span>Buat Assessment Baru</span>
      </button>

      {/* Modal Dialog Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl shadow-2xl flex flex-col my-auto overflow-hidden text-left">
            {/* Fixed Header */}
            <div className="px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl font-bold">
                  📝
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100">
                    Ajukan Assessment Baru
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Draft assessment akan diajukan ke Koordinator untuk di-review sebelum dipublikasikan ke OJT.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center text-base transition-all active:scale-95"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
                {error && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 font-medium">
                    ⚠️ {error}
                  </p>
                )}

                {/* Title */}
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                    Judul Assessment <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="e.g. Brand Visual Refresh, Short-Form Video Edit"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-sm font-medium rounded-xl px-4 py-3 focus:outline-none transition-all text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Brief/Description */}
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                    Brief / Instruksi Pengerjaan <span className="text-red-500">*</span>
                  </label>
                  <input type="hidden" name="description" value={description} />
                  <TiptapEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Jelaskan instruksi lengkap pengerjaan: output yang diharapkan, link referensi/aset, format file submit, deadline, dll..."
                    minHeight="min-h-[260px]"
                  />
                </div>

                {/* Start Date & Deadline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                      Tanggal & Jam Mulai (Start Date)
                    </label>
                    <input
                      type="datetime-local"
                      name="start_at"
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-xs font-medium rounded-xl px-4 py-3 focus:outline-none transition-all text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                      Tenggat Waktu / Deadline
                    </label>
                    <input
                      type="datetime-local"
                      name="deadline"
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-xs font-medium rounded-xl px-4 py-3 focus:outline-none transition-all text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Kategori Assessment Mode */}
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                    Kategori Peserta Assessment <span className="text-red-500">*</span>
                  </label>
                  <input type="hidden" name="assessment_category" value={category} />
                  {category === 'GROUP' && (
                    <input type="hidden" name="group_data" value={JSON.stringify(groups.map((g) => ({ name: g.name, userIds: g.userIds })))} />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {[
                      { value: 'INDIVIDUAL', icon: '👤', label: 'Individu', desc: 'Seluruh Troopers di-assign tugas ini secara mandiri' },
                      { value: 'GROUP', icon: '👥', label: 'Kelompok', desc: 'Bagi Troopers menjadi beberapa kelompok kerja tim' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCategory(opt.value as 'INDIVIDUAL' | 'GROUP')}
                        className={`flex flex-col text-left gap-1 border rounded-2xl p-4 cursor-pointer transition-all ${
                          category === opt.value
                            ? 'border-purple-500 bg-purple-500/10 dark:bg-purple-500/15 ring-1 ring-purple-500'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{opt.icon}</span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${category === opt.value ? 'border-purple-600 bg-purple-600' : 'border-zinc-300 dark:border-zinc-700'}`}>
                            {category === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 mt-1">{opt.label}</span>
                        <span className="text-[10px] text-zinc-400 leading-tight">{opt.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* If GROUP mode is selected */}
                  {category === 'GROUP' && (
                    <div className="space-y-4 border border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/5 rounded-2xl p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/10 pb-3">
                        <div>
                          <h4 className="text-xs font-black text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                            <span>👥</span> Custom Pembagian Kelompok
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Tentukan jumlah kelompok & pilih anggota Troopers untuk setiap kelompok.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAutoDistributeTroopers}
                            className="px-3 py-1.5 text-[11px] font-bold bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-300 rounded-xl transition-all border border-purple-500/20 flex items-center gap-1 cursor-pointer"
                          >
                            <span>⚡</span> Acak / Bagi Rata
                          </button>
                          <button
                            type="button"
                            onClick={handleAddGroup}
                            className="px-3 py-1.5 text-[11px] font-bold bg-purple-600 text-white hover:bg-purple-500 rounded-xl transition-all shadow-sm cursor-pointer"
                          >
                            + Tambah Kelompok
                          </button>
                        </div>
                      </div>

                      {/* Group Cards List */}
                      <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                        {groups.map((grp, gIdx) => (
                          <div key={grp.id} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-xs font-black text-purple-500">#{gIdx + 1}</span>
                                <input
                                  type="text"
                                  value={grp.name}
                                  onChange={(e) => handleGroupNameChange(grp.id, e.target.value)}
                                  placeholder={`Kelompok ${gIdx + 1}`}
                                  className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-500 text-zinc-900 dark:text-zinc-100 w-44 sm:w-56"
                                />
                                <span className="text-[10px] font-bold text-zinc-400">
                                  ({grp.userIds.length} Anggota)
                                </span>
                              </div>
                              {groups.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveGroup(grp.id)}
                                  className="text-xs text-rose-500 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                                  title="Hapus Kelompok"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>

                            {/* Troopers Selection List */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 max-h-[160px] overflow-y-auto pr-1">
                              {availableTroopers.map((trooper) => {
                                const uId = trooper.userId || trooper.id || '';
                                const isChecked = grp.userIds.includes(uId);
                                const assignedOtherGrp = groups.find((g) => g.id !== grp.id && g.userIds.includes(uId));

                                return (
                                  <label
                                    key={uId}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                      isChecked
                                        ? 'border-purple-500 bg-purple-500/10 font-bold text-purple-900 dark:text-purple-200'
                                        : assignedOtherGrp
                                        ? 'border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 text-zinc-400 opacity-60'
                                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:border-purple-300 text-zinc-700 dark:text-zinc-300'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleTrooperInGroup(grp.id, uId)}
                                      className="accent-purple-600 rounded w-3.5 h-3.5"
                                    />
                                    <span className="truncate flex-1">{trooper.name}</span>
                                    {assignedOtherGrp && !isChecked && (
                                      <span className="text-[9px] text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-md">
                                        {assignedOtherGrp.name}
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Exec Type */}
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                    Tipe Eksekusi <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { value: 'DESIGNER', icon: '🎨', label: 'Design', desc: 'Desain visual, poster, feed, ui/ux' },
                      { value: 'VIDEO_EDITOR', icon: '🎬', label: 'Video', desc: 'Reels, TikTok, video editing, motion' },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="flex flex-col gap-1 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 rounded-2xl p-4 cursor-pointer hover:border-purple-400 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-500/10 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{opt.icon}</span>
                          <input type="radio" name="exec_type" value={opt.value} defaultChecked={opt.value === 'DESIGNER'} className="accent-purple-600 w-4 h-4" />
                        </div>
                        <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 mt-1">{opt.label}</span>
                        <span className="text-[10px] text-zinc-400 leading-tight">{opt.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-4 sm:px-8 border-t border-zinc-100 dark:border-zinc-800/80 shrink-0 bg-white dark:bg-[#09090b] flex items-center justify-end gap-3 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-400 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-6 py-2.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 active:scale-[0.98] cursor-pointer"
                >
                  {pending ? 'Mengirim Ajuan...' : '📩 Buat & Ajukan ke Koordinator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-component: OJT Submit Form ───────────────────────────────────────────

function OJTSubmitForm({
  assignment,
  task,
  workspaceId,
}: {
  assignment: AssignmentRow;
  task: TaskRow;
  workspaceId: string;
}) {
  const [url,     setUrl]     = useState(assignment.result_url ?? '');
  const [error,   setError]   = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const meta = getTaskAssignmentStatusMeta(assignment.status, task.start_at, task.deadline, task.extended_deadline);
  const isLocked = assignment.status === 'APPROVED' || meta.isPastDeadline || meta.isNotStarted;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setError(null);
    startTransition(async () => {
      const res = await submitAssessmentWork(assignment.id, url, workspaceId);
      if (!res.success) setError(res.error ?? 'Gagal submit');
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {meta.isPastDeadline && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <span>⏰</span>
          <span>Tenggat waktu (deadline) assessment ini telah berakhir. Pengumpulan tugas ditutup.</span>
        </div>
      )}

      {meta.isNotStarted && (
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-2">
          <span>⏳</span>
          <span>Assessment ini dijadwalkan mulai pada tanggal & jam yang ditentukan. Pengumpulan belum dibuka.</span>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
          Link Hasil Kerja (Google Drive / URL) <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          disabled={isLocked}
          placeholder={isLocked ? "Pengumpulan ditutup" : "https://drive.google.com/..."}
          className="w-full bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-sm rounded-xl px-4 py-2.5 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-zinc-900 dark:text-zinc-100"
        />
      </div>

      {error && (
        <p className="text-xs text-red-500 font-bold">{error}</p>
      )}

      {assignment.revision_note && (
        <CollapsibleNoteViewer
          content={assignment.revision_note}
          badgeLabel="Perlu Revisi"
          type="REVISION"
        />
      )}

      {!isLocked && (
        <button
          type="submit"
          disabled={pending || !url.trim()}
          className="w-full py-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer"
        >
          {pending ? 'Mengumpulkan...' : assignment.status === 'WAITING_REVIEW' ? '🔄 Update Submission' : '📤 Kumpulkan'}
        </button>
      )}
    </form>
  );
}

const DEFAULT_EMOJIS = ['🔥', '👏', '🚀', '❤️', '💡', '💯'];

function getSparkMeta(spark: number): { label: string; emoji: string; color: string } {
  if (spark >= 9) return { label: 'LEGENDARY SPARK', emoji: '👑', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' };
  if (spark >= 7) return { label: 'GREAT SPARK', emoji: '💎', color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' };
  if (spark >= 5) return { label: 'SOLID SPARK', emoji: '⚡', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' };
  if (spark >= 3) return { label: 'FAIR SPARK', emoji: '👍', color: 'text-sky-500 bg-sky-500/10 border-sky-500/30' };
  return { label: 'MINIMUM SPARK', emoji: '🩹', color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/30' };
}

// ── Sub-component: Mentor Submission Card ────────────────────────────────────

function MentorSubmissionCard({
  assignment,
  workspaceId,
  isCoordinator,
  reactions = [],
  canManage = true,
  currentUserId,
  taskCreatedBy,
  taskStartAt,
  taskDeadline,
  taskExtendedDeadline,
}: {
  assignment: AssignmentRow;
  workspaceId: string;
  isCoordinator: boolean;
  reactions?: ReactionItem[];
  canManage?: boolean;
  currentUserId: string;
  taskCreatedBy?: string | null;
  taskStartAt?: number | null;
  taskDeadline?: number | null;
  taskExtendedDeadline?: number | null;
}) {
  const [expanded,          setExpanded]          = useState(false);
  const [showSparkModal,    setShowSparkModal]    = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [sparks,            setSparks]            = useState<number>(8);
  const [revNote,           setRevNote]           = useState('');
  const [showRevForm,       setShowRevForm]       = useState(false);
  const [showAccForm,       setShowAccForm]       = useState(false);
  const [accNote,           setAccNote]           = useState('');
  const [error,             setError]             = useState<string | null>(null);
  const [pending,           startTransition]      = useTransition();

  const isSubmitted   = ['WAITING_REVIEW', 'RESUBMITTED'].includes(assignment.status);
  const isApproved    = assignment.status === 'APPROVED';
  const hasSubmission = !!assignment.result_url || isSubmitted || isApproved;
  const meta          = getTaskAssignmentStatusMeta(assignment.status, taskStartAt, taskDeadline, taskExtendedDeadline);
  const statusBadge   = meta.badgeClass;
  const statusLabel   = meta.label;
  const currentSparkMeta = getSparkMeta(sparks);

  const handleRemoveParticipant = () => {
    setError(null);
    startTransition(async () => {
      const res = await removeAssessmentAssignment(assignment.id, workspaceId);
      if (res.success) {
        setShowConfirmRemove(false);
      } else {
        setError(res.error ?? 'Gagal menghapus kepesertaan.');
      }
    });
  };

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await safeExecuteAction(
          () => approveAssessmentSubmission(assignment.id, workspaceId, sparks),
          async () => {
            const r = await fetch('/api/review/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                actionType: 'APPROVE',
                assignmentId: assignment.id,
                workspaceId,
                sparks,
                isAssessmentCoordStep: true,
              }),
            });
            return await r.json();
          }
        );
        if (res.success) {
          setShowSparkModal(false);
        } else {
          setError(res.error ?? 'Gagal approve');
        }
      } catch (err: any) {
        setError(err.message ?? 'Gagal approve');
      }
    });
  };

  const handleMentorAcc = (note?: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await safeExecuteAction(
          () => approveAssessmentMentorStep(assignment.id, workspaceId, note),
          async () => {
            const r = await fetch('/api/review/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                actionType: 'APPROVE',
                assignmentId: assignment.id,
                workspaceId,
                noteText: note || '',
                isAssessmentMentorStep: true,
              }),
            });
            return await r.json();
          }
        );
        if (res.success) {
          setShowAccForm(false);
          setAccNote('');
        } else {
          setError(res.error ?? 'Gagal ACC Mentor');
        }
      } catch (err: any) {
        setError(err.message ?? 'Gagal ACC Mentor');
      }
    });
  };

  const handleRevise = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestAssessmentRevision(assignment.id, workspaceId, revNote);
      if (res.success) {
        setShowRevForm(false);
        setRevNote('');
      } else {
        setError(res.error ?? 'Gagal request revisi');
      }
    });
  };

  const handleReaction = (emoji: string) => {
    startTransition(async () => {
      await toggleAssessmentReaction(assignment.id, emoji, workspaceId);
    });
  };

  return (
    <div className={`border rounded-2xl transition-all ${isApproved ? 'border-emerald-500/20 bg-emerald-500/3' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30'}`}>
      {/* Header row */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer"
        onClick={() => hasSubmission && setExpanded((p) => !p)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-black flex items-center justify-center uppercase shrink-0">
            {(assignment.user_name ?? '?').substring(0, 2)}
          </div>
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
            {assignment.user_name ?? 'OJT User'}
          </span>
        </div>

              <div className="flex items-center gap-2 shrink-0">
          {isApproved && assignment.sparks != null && (() => {
            const meta = getSparkMeta(assignment.sparks);
            return (
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${meta.color}`}>
                {meta.emoji} {assignment.sparks} Sparks
              </span>
            );
          })()}
          <span className={`text-[9px] font-black border px-2 py-0.5 rounded-full ${statusBadge}`}>
            {statusLabel}
          </span>
          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirmRemove(true);
              }}
              disabled={pending}
              title="Hapus Kepesertaan Peserta Ini"
              className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center text-xs transition-colors ml-1"
            >
              🗑️
            </button>
          )}
          {hasSubmission && (
            <span className="text-zinc-400 text-xs">{expanded ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {/* Modal Confirm Remove Participant */}
      {showConfirmRemove && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center text-xl mx-auto">
              🗑️
            </div>
            <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
              Hapus Kepesertaan?
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Peserta <span className="font-bold text-zinc-900 dark:text-zinc-100">&ldquo;{assignment.user_name ?? 'OJT User'}&rdquo;</span> akan dikeluarkan dari daftar kepesertaan assessment ini.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmRemove(false)}
                disabled={pending}
                className="flex-1 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRemoveParticipant}
                disabled={pending}
                className="flex-1 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-md disabled:opacity-50"
              >
                {pending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded: submission detail + review actions */}
      {hasSubmission && expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          {assignment.result_url && (
            assignment.result_url.includes('<') || assignment.result_url.includes('\n') ? (
              <DocxDocumentViewer
                content={assignment.result_url}
                roleName={`Hasil Submit: ${assignment.user_name ?? 'OJT User'}`}
              />
            ) : (
              <SubmittedLinkPreviewer url={assignment.result_url} />
            )
          )}

          {/* Appreciation / Catatan Improvement Viewer */}
          {assignment.appreciation_note && (
            <CollapsibleNoteViewer
              content={assignment.appreciation_note}
              badgeLabel="✨ Catatan Improvement Mentor"
              type="APPRECIATION"
            />
          )}

          {/* Revision Note Viewer for Evaluators / Mentor / Coordinator / Admin */}
          {assignment.revision_note && (
            <CollapsibleNoteViewer
              content={assignment.revision_note}
              badgeLabel={assignment.status === 'REVISION_REQUESTED' ? "⚠️ Catatan Revisi (Menunggu Intern)" : "💬 Catatan Revisi Evaluator"}
              type="REVISION"
            />
          )}

          {/* Emoji Reactions Bar */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <span className="text-[10px] font-black uppercase text-zinc-400 mr-1">Feedback:</span>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => handleReaction(r.emoji)}
                disabled={pending}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-medium transition-all active:scale-95 ${
                  r.user_reacted
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{r.emoji}</span>
                <span className="text-[10px] font-bold">{r.count}</span>
              </button>
            ))}

            {DEFAULT_EMOJIS.filter((e) => !reactions.some((r) => r.emoji === e)).map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                disabled={pending}
                className="px-2 py-0.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-900 transition-all opacity-60 hover:opacity-100"
              >
                {emoji}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {!isApproved && (() => {
            const isTaskCreator = taskCreatedBy != null && taskCreatedBy === currentUserId;
            const isMentorApproved = assignment.mentor_approved === 1;
            const isCoordinatorApproved = assignment.coordinator_approved === 1;

            // Show approval progress badges
            const badges = (
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isMentorApproved
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                }`}>
                  {isMentorApproved ? '✓ ACC Mentor' : '⌛ Menunggu ACC Mentor'}
                </span>
                <span className="text-zinc-300 dark:text-zinc-600">›</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isCoordinatorApproved
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : isMentorApproved
                      ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                      : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                }`}>
                  {isCoordinatorApproved ? '✓ ACC Koordinator' : isMentorApproved ? '⌛ Menunggu ACC Koordinator' : 'ACC Koordinator'}
                </span>
              </div>
            );

            // Block actions when revision has been requested and is pending intern follow-up
            if (assignment.status === 'REVISION_REQUESTED') {
              return (
                <div className="space-y-2">
                  {badges}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <span>⌛ Status: Revisi Telah Diminta. Menunggu intern mengirimkan hasil revisi terbaru.</span>
                  </div>
                </div>
              );
            }

            // Step 1: Creator mentor sees ACC Mentor & Catatan Improvement + Request Revisi
            if (isTaskCreator && !isMentorApproved && assignment.status === 'WAITING_REVIEW') {
              return (
                <div className="space-y-2">
                  {badges}
                  {!showRevForm && !showAccForm ? (
                    <div className="flex gap-2 items-center flex-wrap">
                      <button
                        onClick={() => setShowAccForm(true)}
                        disabled={pending}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] flex items-center gap-1.5"
                      >
                        <span>✓ ACC Mentor & Catatan Improvement</span>
                      </button>
                      <button
                        onClick={() => setShowRevForm(true)}
                        disabled={pending}
                        className="px-3.5 py-2.5 text-xs font-bold border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/8 rounded-xl transition-all disabled:opacity-50"
                      >
                        ↩ Request Revisi
                      </button>
                    </div>
                  ) : showAccForm ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleMentorAcc(accNote); }} className="space-y-2.5 p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
                      <label className="block text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                        ✨ Catatan Improvement Mentor (Opsional)
                      </label>
                      <textarea
                        value={accNote}
                        onChange={(e) => setAccNote(e.target.value)}
                        rows={2}
                        placeholder="Tuliskan catatan apresiasi, masukkan perbaikan, atau saran untuk peserta..."
                        className="w-full bg-white dark:bg-zinc-900 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-zinc-900 dark:text-zinc-100 resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAccForm(false)}
                          disabled={pending}
                          className="px-3 py-1.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={pending}
                          className="px-4 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-all disabled:opacity-50"
                        >
                          {pending ? '...' : '✓ Kirim ACC & Catatan'}
                        </button>
                      </div>
                    </form>
                  ) : showRevForm ? (
                    <form onSubmit={handleRevise} className="space-y-2">
                      <textarea
                        value={revNote}
                        onChange={(e) => setRevNote(e.target.value)}
                        required
                        rows={2}
                        placeholder="Tulis catatan revisi..."
                        className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-red-400 text-zinc-900 dark:text-zinc-100"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setShowRevForm(false)} className="flex-1 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500">
                          Batal
                        </button>
                        <button type="submit" disabled={pending} className="flex-1 py-1.5 text-xs font-bold bg-red-500 hover:bg-red-400 text-white rounded-lg disabled:opacity-50">
                          {pending ? '...' : 'Kirim Revisi'}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              );
            }

            // Step 2: Coordinator sees Approve & Award Sparks (only after mentor ACC)
            if (isCoordinator && isMentorApproved && !isCoordinatorApproved) {
              return (
                <div className="space-y-2">
                  {badges}
                  {!showRevForm && !showSparkModal ? (
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => setShowSparkModal(true)}
                        disabled={pending}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] flex items-center gap-1.5"
                      >
                        <span>✓ Approve & Award Sparks ✨</span>
                      </button>
                      <button
                        onClick={() => setShowRevForm(true)}
                        disabled={pending}
                        className="px-3.5 py-2 text-xs font-bold border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/8 rounded-xl transition-all disabled:opacity-50"
                      >
                        ↩ Request Revisi
                      </button>
                    </div>
                  ) : showSparkModal ? (
                    <div className="space-y-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                          ✨ Berikan Creative Sparks (1 - 10)
                        </label>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${currentSparkMeta.color}`}>
                          {currentSparkMeta.emoji} {currentSparkMeta.label} ({sparks}/10)
                        </span>
                      </div>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                          const isSelected = sparks === num;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setSparks(num)}
                              className={`py-2 rounded-xl text-xs font-black transition-all ${
                                isSelected
                                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 scale-105 ring-2 ring-purple-500/30'
                                  : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                              }`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <button type="button" onClick={() => { setShowSparkModal(false); setError(null); }} disabled={pending} className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
                          Batal
                        </button>
                        <button type="button" onClick={handleApprove} disabled={pending} className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-1.5 rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5">
                          {pending ? 'Menyimpan...' : `Kirim ${sparks} ✨ & Setujui`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRevise} className="space-y-2">
                      <textarea
                        value={revNote}
                        onChange={(e) => setRevNote(e.target.value)}
                        required
                        rows={2}
                        placeholder="Tulis catatan revisi..."
                        className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-red-400 text-zinc-900 dark:text-zinc-100"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setShowRevForm(false)} className="flex-1 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500">
                          Batal
                        </button>
                        <button type="submit" disabled={pending} className="flex-1 py-1.5 text-xs font-bold bg-red-500 hover:bg-red-400 text-white rounded-lg disabled:opacity-50">
                          {pending ? '...' : 'Kirim Revisi'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            }

            // Non-creator mentors or already approved: show status only
            return (
              <div className="space-y-2">
                {badges}
                {!isMentorApproved && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                    Menunggu ACC Mentor pembuat tugas.
                  </p>
                )}
                {isMentorApproved && !isCoordinatorApproved && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                    Menunggu peninjauan & pemberian Sparks oleh Koordinator.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Sub-component: Edit Assessment Task Modal ─────────────────────────────────

function EditAssessmentTaskModal({
  task,
  execType,
  workspaceId,
  onClose,
}: {
  task: TaskRow;
  execType: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(task.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateAssessmentTask(task.id, workspaceId, fd);
      if (res.success) {
        onClose();
      } else {
        setError(res.error ?? 'Gagal mengedit assessment');
      }
    });
  };

  const defaultStartAt = formatIndonesiaDatetimeInput(task.start_at);
  const defaultDeadline = formatIndonesiaDatetimeInput(task.deadline);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
      <div className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl shadow-2xl flex flex-col my-auto overflow-hidden text-left" onClick={(e) => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl font-bold">
              ✏️
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100">Edit Assessment</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Perbarui rincian, tenggat waktu, atau jadwal mulai assessment.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center text-base transition-all active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 font-medium">
                ⚠️ {error}
              </p>
            )}

            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                Judul Assessment <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                defaultValue={task.title}
                required
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-sm font-medium rounded-xl px-4 py-3 focus:outline-none transition-all text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                Brief / Instruksi Pengerjaan
              </label>
              <input type="hidden" name="description" value={description} />
              <TiptapEditor
                value={description}
                onChange={setDescription}
                placeholder="Instruksi pengerjaan..."
                minHeight="min-h-[240px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                  Tanggal & Jam Mulai (Start Date)
                </label>
                <input
                  type="datetime-local"
                  name="start_at"
                  defaultValue={defaultStartAt}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-xs font-medium rounded-xl px-4 py-3 focus:outline-none transition-all text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                  Tenggat Waktu / Deadline
                </label>
                <input
                  type="datetime-local"
                  name="deadline"
                  defaultValue={defaultDeadline}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-xs font-medium rounded-xl px-4 py-3 focus:outline-none transition-all text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                Tipe Eksekusi / Kategori <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'DESIGNER', icon: '🎨', label: 'Design' },
                  { value: 'VIDEO_EDITOR', icon: '🎬', label: 'Video' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 rounded-2xl p-3.5 cursor-pointer hover:border-purple-400 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-500/10 transition-all text-xs font-bold text-zinc-800 dark:text-zinc-200"
                  >
                    <input
                      type="radio"
                      name="exec_type"
                      value={opt.value}
                      defaultChecked={execType === opt.value}
                      className="accent-purple-600 w-4 h-4"
                    />
                    <span className="text-lg">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 sm:px-8 border-t border-zinc-100 dark:border-zinc-800/80 shrink-0 bg-white dark:bg-[#09090b] flex items-center justify-end gap-3 rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-400"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-6 py-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all shadow-md shadow-purple-500/20 disabled:opacity-60"
            >
              {pending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sub-component: Add Participant Modal ──────────────────────────────────────

function AddParticipantModal({
  taskId,
  execType,
  workspaceId,
  existingAssignmentUserIds,
  allMembers,
  onClose,
}: {
  taskId: string;
  execType: string;
  workspaceId: string;
  existingAssignmentUserIds: string[];
  allMembers: WorkspaceMemberSimple[];
  onClose: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const availableMembers = allMembers.filter((m) => {
    const uId = m.userId || m.id;
    return uId && !existingAssignmentUserIds.includes(uId);
  });

  const handleAdd = () => {
    if (!selectedUserId) {
      setError('Pilih peserta terlebih dahulu.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addAssessmentAssignment(taskId, selectedUserId, workspaceId, execType);
      if (res.success) {
        onClose();
      } else {
        setError(res.error ?? 'Gagal menambahkan peserta.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={(e) => e.stopPropagation()}>
      <div className="w-full max-w-md bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 text-left" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>➕</span>
            <span>Tambah Peserta Assessment</span>
          </h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm">✕</button>
        </div>

        {error && <p className="text-xs text-red-500 font-medium">⚠️ {error}</p>}

        {availableMembers.length === 0 ? (
          <p className="text-xs text-zinc-400 py-4 text-center">Seluruh anggota workspace sudah terdaftar pada assessment ini.</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Pilih Peserta OJT / Anggota Workspace:
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500"
            >
              <option value="">-- Pilih Peserta --</option>
              {availableMembers.map((m) => {
                const uId = m.userId || m.id || '';
                return (
                  <option key={uId} value={uId}>
                    {m.name} ({m.email})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-500"
          >
            Batal
          </button>
          {availableMembers.length > 0 && (
            <button
              type="button"
              onClick={handleAdd}
              disabled={pending || !selectedUserId}
              className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-md disabled:opacity-50"
            >
              {pending ? 'Menambahkan...' : 'Tambah Peserta'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-component: Assessment Task Card (Mentor) ──────────────────────────────

function MentorTaskCard({
  task,
  assignments,
  reactionsMap,
  workspaceId,
  isCoordinator,
  canManage = true,
  currentUserId,
  allWorkspaceMembers = [],
  isTarget = false,
}: {
  task: TaskRow;
  assignments: AssignmentRow[];
  reactionsMap?: Record<string, ReactionItem[]>;
  workspaceId: string;
  isCoordinator: boolean;
  canManage?: boolean;
  currentUserId: string;
  allWorkspaceMembers?: WorkspaceMemberSimple[];
  isTarget?: boolean;
}) {
  const [isCardExpanded,           setIsCardExpanded]           = useState(isTarget);
  const [showSubmissions,          setShowSubmissions]          = useState(isTarget);
  const [showEditModal,            setShowEditModal]            = useState(false);
  const [showConfirmDelete,        setShowConfirmDelete]        = useState(false);
  const [showAddParticipantModal,  setShowAddParticipantModal]  = useState(false);
  const [showMultiplierModal,      setShowMultiplierModal]      = useState(false);
  const [showExtendModal,          setShowExtendModal]          = useState(false);
  const [pendingApprove,           startApproveTransition]      = useTransition();
  const [pendingDelete,            startDeleteTransition]       = useTransition();

  const [sparksToGrant, setSparksToGrant] = useState<number>(5);
  const [showBriefRevisionForm, setShowBriefRevisionForm] = useState(false);
  const [briefRevisionNote, setBriefRevisionNote] = useState('');
  const [pendingRevision, startRevisionTransition] = useTransition();

  const isPendingCoordinatorApproval = task.status === 'WAITING_REVIEW';
  const total     = assignments.length;
  const submitted = task.status === 'APPROVED'
    ? assignments.filter((a) => a.status === 'APPROVED' || a.status === 'RESUBMITTED' || (a.status === 'WAITING_REVIEW' && a.result_url != null)).length
    : 0;
  const approved  = assignments.filter((a) => a.status === 'APPROVED').length;

  const execType = assignments[0]?.assignment_role ?? 'DESIGNER';
  const execLabel = EXEC_TYPE_LABEL[execType] ?? execType;

  // Authorization: Only the creator of the assessment task or Coordinator/Admin can Edit/Delete
  const canEditOrDelete = isCoordinator || (task.created_by != null && task.created_by === currentUserId);

  const handlePublishAssessment = () => {
    startApproveTransition(async () => {
      await approveAssessmentTask(task.id, workspaceId, execType, sparksToGrant);
    });
  };

  const handleRequestBriefRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefRevisionNote.trim()) return;
    startRevisionTransition(async () => {
      const res = await requestAssessmentBriefRevision(task.id, workspaceId, briefRevisionNote);
      if (res.success) {
        setShowBriefRevisionForm(false);
        setBriefRevisionNote('');
      }
    });
  };

  const handleDeleteAssessment = () => {
    startDeleteTransition(async () => {
      const res = await deleteAssessmentTask(task.id, workspaceId);
      if (res.success) {
        setShowConfirmDelete(false);
      }
    });
  };

  const isScheduled = task.start_at && task.start_at > Date.now();

  return (
    <div
      id={`task_card_${task.id}`}
      className={`border bg-white dark:bg-zinc-900/30 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all ${
        isTarget ? 'border-purple-500 ring-2 ring-purple-500 shadow-xl shadow-purple-500/20' : 'border-zinc-200/80 dark:border-zinc-800/80'
      }`}
    >
      {/* Modal Edit Assessment (rendered at root level so it works even when collapsed) */}
      {showEditModal && (
        <EditAssessmentTaskModal
          task={task}
          execType={execType}
          workspaceId={workspaceId}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Modal Confirm Delete (rendered at root level) */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-md bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center text-2xl mx-auto">
              ⚠️
            </div>
            <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
              Hapus Assessment Ini?
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Tugas assessment <span className="font-bold text-zinc-900 dark:text-zinc-100">&ldquo;{task.title}&rdquo;</span> beserta seluruh submission peserta OJT akan dihapus dari sistem.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                disabled={pendingDelete}
                className="flex-1 py-2.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-400"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteAssessment}
                disabled={pendingDelete}
                className="flex-1 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all shadow-md shadow-red-500/20 disabled:opacity-60"
              >
                {pendingDelete ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Participant */}
      {showAddParticipantModal && (
        <AddParticipantModal
          taskId={task.id}
          execType={execType}
          workspaceId={workspaceId}
          existingAssignmentUserIds={assignments.map((a) => a.user_id)}
          allMembers={allWorkspaceMembers}
          onClose={() => setShowAddParticipantModal(false)}
        />
      )}

      {/* Modal Edit Task Multiplier (Koordinator/Admin) */}
      {showMultiplierModal && (
        <EditTaskMultiplierModal
          taskId={task.id}
          taskTitle={task.title}
          currentMultiplier={task.sparks_multiplier || 1.0}
          isOpen={showMultiplierModal}
          onClose={() => setShowMultiplierModal(false)}
          onSuccess={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      )}

      {/* Modal Extend Deadline Task */}
      {showExtendModal && (
        <ExtendDeadlineModal
          taskId={task.id}
          taskTitle={task.title}
          currentDeadline={task.deadline || null}
          currentExtendedDeadline={task.extended_deadline || null}
          workspaceId={workspaceId}
          isOpen={showExtendModal}
          onClose={() => setShowExtendModal(false)}
        />
      )}

      {/* Accordion Task Header */}
      <div
        onClick={() => setIsCardExpanded((prev) => !prev)}
        className="p-5 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-all select-none"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-500/8 border border-purple-500/15 px-2.5 py-1 rounded-xl">
                {execLabel}
              </span>
              {task.assessment_category === 'GROUP' ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <span>👥</span>
                  <span>Assessment Kelompok</span>
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <span>👤</span>
                  <span>Assessment Individu</span>
                </span>
              )}
              {task.sparks_multiplier && task.sparks_multiplier > 1.0 && (
                <span
                  onClick={(e) => {
                    if (isCoordinator) {
                      e.stopPropagation();
                      setShowMultiplierModal(true);
                    }
                  }}
                  title={isCoordinator ? "Set Sparks Multiplier Khusus Task" : "Sparks Multiplier Khusus Task"}
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-xl border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1 font-mono transition-all ${
                    isCoordinator ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                  }`}
                >
                  ⚡ {task.sparks_multiplier}x
                </span>
              )}
              {task.creator_name && (
                <span className="text-[9px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1 max-w-full truncate" title="Mentor Pembuat Assessment">
                  <span>🎓</span>
                  <span className="truncate">Mentor: {task.creator_name}</span>
                </span>
              )}
              {task.status === 'WAITING_REVIEW' ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <span>⏳</span>
                  <span>Menunggu ACC Brief</span>
                </span>
              ) : task.status === 'REVISION_REQUESTED' ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <span>↩</span>
                  <span>Revisi Brief Diminta</span>
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <span>✅</span>
                  <span>Brief Di-ACC {task.sparks != null && `(${task.sparks} ✨)`}</span>
                </span>
              )}
              {task.start_at && (
                <span className={`text-[9px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1 border ${
                  isScheduled
                    ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 border-indigo-500/20 font-bold'
                    : 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                }`}>
                  <span>📅</span>
                  <span>{isScheduled ? 'Mulai: ' : 'Mulai: '}{new Date(task.start_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })}</span>
                  {isScheduled && <span className="text-[8px] bg-indigo-500 text-white px-1.5 py-0.2 rounded-full">Dijadwalkan</span>}
                </span>
              )}
              {task.extended_deadline && task.extended_deadline > (task.deadline || 0) ? (() => {
                const daysExtended = task.deadline ? Math.max(1, Math.ceil((task.extended_deadline - task.deadline) / (24 * 3600 * 1000))) : 1;
                const penalty = Math.min(100, daysExtended * 10);
                const hText = `H+${daysExtended} • Sparks -${penalty}%`;
                const isOverdue = Date.now() > task.extended_deadline;
                return (
                  <span className={`text-[9px] font-black ${isOverdue ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse' : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'} px-2.5 py-1 rounded-xl flex items-center gap-1 font-mono border`}>
                    <span>{isOverdue ? '⚠️ Overdue Extended' : `⏳ Extended (${hText})`}:</span>
                    <span>{new Date(task.extended_deadline).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </span>
                );
              })() : task.deadline ? (
                <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 bg-rose-500/8 border border-rose-500/15 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <span>⏰</span>
                  <span>{new Date(task.deadline).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })}</span>
                </span>
              ) : null}
            </div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-snug break-words">{task.title}</h3>
          </div>

          {/* Progress ring summary + Edit / Delete / Multiplier buttons + Accordion Chevron */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/50 shrink-0">
            <div className="text-right mr-1">
              <p className="text-[10px] font-black text-zinc-500">
                {submitted}/{total} submit
              </p>
              {approved > 0 && (
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                  {approved} approved
                </p>
              )}
            </div>
            {canEditOrDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExtendModal(true);
                }}
                title="Extend Deadline Assessment Task"
                className="w-8 h-8 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all flex items-center justify-center text-xs shrink-0 cursor-pointer"
              >
                ⏳
              </button>
            )}
            {isCoordinator && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMultiplierModal(true);
                }}
                title="Set Sparks Multiplier Khusus Task (Koordinator/Admin)"
                className="w-8 h-8 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all flex items-center justify-center text-xs font-black shrink-0 cursor-pointer"
              >
                ⚡
              </button>
            )}
            {canEditOrDelete && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditModal(true);
                  }}
                  title="Edit Assessment Ini"
                  className="w-8 h-8 rounded-xl bg-zinc-100/80 hover:bg-purple-500/10 dark:bg-zinc-800/80 dark:hover:bg-purple-500/20 text-zinc-400 hover:text-purple-500 transition-all flex items-center justify-center text-xs shrink-0"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfirmDelete(true);
                  }}
                  title="Hapus Assessment Ini"
                  className="w-8 h-8 rounded-xl bg-zinc-100/80 hover:bg-red-500/10 dark:bg-zinc-800/80 dark:hover:bg-red-500/20 text-zinc-400 hover:text-red-500 transition-all flex items-center justify-center text-xs shrink-0"
                >
                  🗑️
                </button>
              </>
            )}
            <div className="w-7 h-7 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center text-xs font-black shrink-0 transition-transform">
              {isCardExpanded ? '▲' : '▼'}
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Content Body */}
      {isCardExpanded && (
        <div className="px-5 pb-5 pt-0 space-y-4 border-t border-zinc-100 dark:border-zinc-800/60 pt-4">

          {task.description && (
            <DocxDocumentViewer
              content={task.description}
              roleName={`Brief Assessment: ${task.title}`}
            />
          )}

          {/* Banner for REVISION_REQUESTED Brief */}
          {task.status === 'REVISION_REQUESTED' && (
            <div className="mt-3 bg-red-500/8 border border-red-500/20 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs">
                  <span>↩</span>
                  <span>Catatan Revisi Brief dari Koordinator</span>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all shadow-sm shrink-0"
                  >
                    <span>✏️</span>
                    <span>Perbaiki Brief & Ajukan Ulang</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                {task.revision_note || 'Brief perlu diperbaiki oleh Mentor sebelum di-ACC Koordinator.'}
              </p>
            </div>
          )}

          {/* Status Draft/Approval Banner */}
          {isPendingCoordinatorApproval && (
            <div className="mt-3 bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">⏳</span>
                  <div>
                    <p className="text-xs font-black text-amber-700 dark:text-amber-400">
                      Menunggu Review & Persetujuan Koordinator
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {isCoordinator
                        ? 'Anda adalah Koordinator. Berikan penilaian Sparks dan setujui ajuan ini untuk mempublikasikan tugas ke OJT, atau minta revisi.'
                        : 'Draft assessment telah diajukan. Tugas akan di-assign ke OJT setelah disetujui Koordinator.'}
                    </p>
                  </div>
                </div>
                {isCoordinator && !showBriefRevisionForm && (
                  <button
                    type="button"
                    onClick={() => setShowBriefRevisionForm(true)}
                    disabled={pendingApprove || pendingRevision}
                    className="px-3.5 py-2 text-xs font-bold border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/8 rounded-xl transition-all shrink-0"
                  >
                    ↩ Request Revisi Brief
                  </button>
                )}
              </div>

              {/* Coordinator Review Controls: 1-10 Sparks selector */}
              {isCoordinator && !showBriefRevisionForm && (
                <div className="space-y-2 pt-2 border-t border-amber-500/15">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                      ✨ Penilaian Kualitas Brief Mentor (1 - 10 Sparks)
                    </label>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
                      {sparksToGrant}/10 Sparks
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSparksToGrant(num)}
                        className={`py-1.5 rounded-xl text-xs font-black transition-all ${
                          sparksToGrant === num
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 scale-105 ring-2 ring-purple-500/30'
                            : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handlePublishAssessment}
                      disabled={pendingApprove}
                      className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {pendingApprove ? 'Memproses...' : `✓ ACC Brief (${sparksToGrant} ✨) & Publikasikan`}
                    </button>
                  </div>
                </div>
              )}

              {/* Brief Revision Form */}
              {isCoordinator && showBriefRevisionForm && (
                <form onSubmit={handleRequestBriefRevision} className="space-y-2 pt-2 border-t border-amber-500/15">
                  <label className="block text-[10px] font-black text-red-500 uppercase tracking-widest">
                    Tulis Catatan Revisi Brief untuk Mentor:
                  </label>
                  <textarea
                    value={briefRevisionNote}
                    onChange={(e) => setBriefRevisionNote(e.target.value)}
                    required
                    rows={2}
                    placeholder="Jelaskan bagian brief yang perlu diperbaiki (misal: perjelas instruksi, tambahkan link aset...)"
                    className="w-full bg-white dark:bg-zinc-900 border border-red-500/30 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-red-500 text-zinc-900 dark:text-zinc-100"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowBriefRevisionForm(false)}
                      className="px-3 py-1.5 text-xs font-bold border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={pendingRevision || !briefRevisionNote.trim()}
                      className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl disabled:opacity-50"
                    >
                      {pendingRevision ? 'Mengirim...' : 'Kirim Catatan Revisi Brief'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Progress bar */}
          {!isPendingCoordinatorApproval && (
            <div className="mt-3">
              <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: total > 0 ? `${(submitted / total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toggle submissions */}
      <button
        type="button"
        onClick={() => setShowSubmissions((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs font-bold text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-all"
      >
        <span>
          {showSubmissions ? '▲ Tutup Daftar Submission' : `▼ Lihat Semua (${total} peserta)`}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
          submitted === total
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
        }`}>
          {submitted === total ? '✅ Semua Submit' : `⏳ ${total - submitted} Belum`}
        </span>
      </button>

      {/* Submissions list */}
      {showSubmissions && (
        <div className="px-5 pb-5 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          {canManage && (
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                Daftar Kepesertaan ({assignments.length})
              </span>
              <button
                type="button"
                onClick={() => setShowAddParticipantModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-xl transition-all active:scale-95 shadow-2xs"
              >
                <span>➕</span>
                <span>Tambah Peserta</span>
              </button>
            </div>
          )}
          {assignments.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-4">Belum ada peserta yang di-assign.</p>
          ) : task.assessment_category === 'GROUP' ? (
            (() => {
              const groupMap: Record<string, AssignmentRow[]> = {};
              assignments.forEach((a) => {
                const gName = a.group_name || 'Kelompok Tim';
                if (!groupMap[gName]) groupMap[gName] = [];
                groupMap[gName].push(a);
              });
              return Object.entries(groupMap).map(([gName, gAssignments]) => (
                <div key={gName} className="border border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/5 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-purple-500/10 pb-2">
                    <span className="text-xs font-black text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                      <span>👥</span> {gName} ({gAssignments.length} Anggota)
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 truncate max-w-[50%]">
                      {gAssignments.map((m) => m.user_name ?? 'OJT User').join(', ')}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {gAssignments.map((a) => (
                      <MentorSubmissionCard
                        key={a.id}
                        assignment={a}
                        reactions={reactionsMap?.[a.id] ?? []}
                        workspaceId={workspaceId}
                        isCoordinator={isCoordinator}
                        canManage={canManage}
                        currentUserId={currentUserId}
                        taskCreatedBy={task.created_by}
                        taskStartAt={task.start_at}
                        taskDeadline={task.deadline}
                        taskExtendedDeadline={task.extended_deadline}
                      />
                    ))}
                  </div>
                </div>
              ));
            })()
          ) : (
            assignments.map((a) => (
              <MentorSubmissionCard
                key={a.id}
                assignment={a}
                reactions={reactionsMap?.[a.id] ?? []}
                workspaceId={workspaceId}
                isCoordinator={isCoordinator}
                canManage={canManage}
                currentUserId={currentUserId}
                taskCreatedBy={task.created_by}
                taskStartAt={task.start_at}
                taskDeadline={task.deadline}
                taskExtendedDeadline={task.extended_deadline}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-component: OJT Task Card ─────────────────────────────────────────────

function OJTTaskCard({
  task,
  assignment,
  reactions = [],
  workspaceId,
  isTarget = false,
}: {
  task: TaskRow;
  assignment: AssignmentRow;
  reactions?: ReactionItem[];
  workspaceId: string;
  isTarget?: boolean;
}) {
  const [isCardExpanded, setIsCardExpanded] = useState(isTarget);
  const [pending, startTransition] = useTransition();
  const execLabel = EXEC_TYPE_LABEL[assignment.assignment_role] ?? assignment.assignment_role;
  const meta = getTaskAssignmentStatusMeta(assignment.status, task.start_at, task.deadline, task.extended_deadline);
  const statusBadge = meta.badgeClass;
  const statusLabel = meta.label;

  const handleReaction = (emoji: string) => {
    startTransition(async () => {
      await toggleAssessmentReaction(assignment.id, emoji, workspaceId);
    });
  };

  return (
    <div
      id={`task_card_${task.id}`}
      className={`bg-white dark:bg-[#09090b] border rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all ${
        isTarget ? 'border-purple-500 ring-2 ring-purple-500 shadow-xl shadow-purple-500/20' : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      {/* Accordion Task Header */}
      <div
        onClick={() => setIsCardExpanded((prev) => !prev)}
        className="p-5 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-all select-none flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-500/8 border border-purple-500/15 px-2.5 py-1 rounded-xl">
              {execLabel}
            </span>
            {task.assessment_category === 'GROUP' ? (
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1">
                <span>👥</span>
                <span>Assessment Kelompok {assignment.group_name ? `(${assignment.group_name})` : ''}</span>
              </span>
            ) : (
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 rounded-xl flex items-center gap-1">
                <span>👤</span>
                <span>Assessment Individu</span>
              </span>
            )}
            {task.deadline && (
              <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 bg-rose-500/8 border border-rose-500/15 px-2.5 py-1 rounded-xl flex items-center gap-1">
                <span>⏰ Deadline:</span>
                <span>{new Date(task.deadline).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })}</span>
              </span>
            )}
          </div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-snug break-words">{task.title}</h3>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/50 shrink-0">
          <span className={`text-[9px] font-black border px-2.5 py-1 rounded-full shrink-0 ${statusBadge}`}>
            {statusLabel}
          </span>
          <div className="w-7 h-7 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center text-xs font-black shrink-0 transition-transform">
            {isCardExpanded ? '▲' : '▼'}
          </div>
        </div>
      </div>

      {/* Accordion Content Body */}
      {isCardExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-zinc-100 dark:border-zinc-800/60 pt-4">
          {/* Brief */}
          {task.description && (
            <DocxDocumentViewer
              content={task.description}
              roleName={`Brief Assessment: ${task.title}`}
            />
          )}

          {/* Approved result display */}
          {assignment.status === 'APPROVED' && (() => {
            const cleanedNote = cleanAppreciationNote((assignment as any).appreciation_note);
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">✅ Sudah Disetujui Koordinator</span>
                  {assignment.sparks != null && (() => {
                    const meta = getSparkMeta(assignment.sparks);
                    return (
                      <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${meta.color}`}>
                        {meta.emoji} {meta.label} ({assignment.sparks}/10)
                      </span>
                    );
                  })()}
                </div>

                {cleanedNote && (
                  <CollapsibleNoteViewer
                    content={cleanedNote}
                    badgeLabel="✨ Apresiasi"
                    type="APPRECIATION"
                  />
                )}
              </div>
            );
          })()}

          {/* Submit form */}
          {assignment.status !== 'APPROVED' && (
            <OJTSubmitForm assignment={assignment} task={task} workspaceId={workspaceId} />
          )}

          {/* Already submitted link & Reactions */}
          {assignment.result_url && (
            (assignment.result_url.includes('<') || assignment.result_url.includes('\n')) ? (
              <DocxDocumentViewer
                content={assignment.result_url}
                roleName="Hasil Submit Assessment Anda"
              />
            ) : (
              <SubmittedLinkPreviewer url={assignment.result_url} />
            )
          )}

          {/* Emoji Reactions Bar for OJT */}
          {assignment.result_url && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
              <span className="text-[10px] font-black uppercase text-zinc-400 mr-1">Feedback Mentor & Tim:</span>
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => handleReaction(r.emoji)}
                  disabled={pending}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-medium transition-all active:scale-95 ${
                    r.user_reacted
                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="text-[10px] font-bold">{r.count}</span>
                </button>
              ))}

              {DEFAULT_EMOJIS.filter((e) => !reactions.some((r) => r.emoji === e)).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReaction(emoji)}
                  disabled={pending}
                  className="px-2 py-0.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-900 transition-all opacity-60 hover:opacity-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main AssessmentPanel ──────────────────────────────────────────────────────

export function AssessmentPanel({
  workspaceId,
  tasks,
  assignmentsByTask,
  reactionsMap,
  currentUserId,
  isLeader,
  isCoordinator,
  isOJT,
  allWorkspaceMembers = [],
}: AssessmentPanelProps) {
  const searchParams = useSearchParams();
  const targetTaskId = searchParams ? searchParams.get('taskId') : null;

  useEffect(() => {
    if (targetTaskId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`task_card_${targetTaskId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [targetTaskId]);

  // Determine viewing role
  const canManage = isLeader || isCoordinator;
  const isOJTTrooper = isOJT && !isLeader;

  // Track reload trigger (simple key increment after creation)
  const [, setReload] = useState(0);

  // Filter assessment tasks only
  const assessmentTasks = tasks.filter((t) => t.status !== 'DELETED');

  if (assessmentTasks.length === 0 && !canManage) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center">
        <p className="text-3xl mb-3">📝</p>
        <p className="text-zinc-500 font-bold dark:text-zinc-400 text-sm">Belum ada assessment yang diberikan.</p>
        <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">Tunggu mentor memberikan tugas assessment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + create button (mentor only) */}
      {canManage && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-zinc-800 dark:text-zinc-200">
              Manajemen Assessment
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {assessmentTasks.length} assessment · {
                Object.values(assignmentsByTask).flat().filter((a) => a.status === 'WAITING_REVIEW').length
              } menunggu review
            </p>
          </div>
          <CreateAssessmentTaskForm
            workspaceId={workspaceId}
            onCreated={() => setReload((p) => p + 1)}
            allWorkspaceMembers={allWorkspaceMembers}
          />
        </div>
      )}

      {/* OJT header */}
      {isOJTTrooper && (
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-zinc-800 dark:text-zinc-200">Assessment Saya</h2>
          <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-500/8 border border-purple-500/15 px-2 py-0.5 rounded-full">
            {assessmentTasks.length} tugas
          </span>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-4">
        {[...assessmentTasks].sort((a, b) => {
          if (!a.deadline && !b.deadline) return a.created_at - b.created_at;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return a.deadline - b.deadline;
        }).map((task) => {
          const allAssignments = assignmentsByTask[task.id] ?? [];
          const isTarget = targetTaskId === task.id;

          if (canManage) {
            return (
              <MentorTaskCard
                key={task.id}
                task={task}
                assignments={allAssignments}
                reactionsMap={reactionsMap}
                workspaceId={workspaceId}
                isCoordinator={isCoordinator}
                canManage={canManage}
                currentUserId={currentUserId}
                allWorkspaceMembers={allWorkspaceMembers}
                isTarget={isTarget}
              />
            );
          }

          // OJT: only show their own assignment
          const myAssignment = allAssignments.find((a) => a.user_id === currentUserId);
          if (!myAssignment) return null;

          return (
            <OJTTaskCard
              key={task.id}
              task={task}
              assignment={myAssignment}
              reactions={reactionsMap?.[myAssignment.id] ?? []}
              workspaceId={workspaceId}
              isTarget={isTarget}
            />
          );
        })}

        {/* Empty state for manager */}
        {canManage && assessmentTasks.length === 0 && (
          <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center">
            <p className="text-3xl mb-3">📝</p>
            <p className="text-zinc-500 font-bold dark:text-zinc-400 text-sm">Belum ada assessment.</p>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">
              Klik &ldquo;Buat Assessment&rdquo; untuk memberi tugas ke semua OJT sekaligus.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
