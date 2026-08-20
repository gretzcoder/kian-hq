'use client';

import { useState } from 'react';
import Link from 'next/link';
import { submitResult, submitDirectTaskResult, deleteTask, approveAssignment, requestRevision, startWork, updateSparks } from '../actions';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import TiptapEditor, { DocxDocumentViewer } from '@/components/editor/TiptapEditor';
import { SubmittedLinkPreviewer } from '@/components/editor/SubmittedLinkPreviewer';
import { useUI } from '@/components/ui/UIProvider';
import ReviewActions from '@/app/dashboard/review/components/ReviewActions';
import { cleanAppreciationNote } from '@/lib/noteUtils';
import SendReminderButton from '@/components/SendReminderButton';
import { CollapsibleNoteViewer } from '@/components/CollapsibleNoteViewer';

export function getDirectBriefCategories(description: string | null | undefined): string[] {
  if (!description) return [];
  const match = description.match(/\[DIRECT_BRIEF_CATEGORIES:\s*(\[[\s\S]*?\])\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => String(c).trim()).filter(Boolean);
      }
    } catch {}
  }
  return [];
}

// ─── CreatorDrivePreview ────────────────────────────────────────────────────
// Aspect-ratio aware, user-friendly Google Drive preview widget for Creator step
export function CreatorDrivePreview({ url }: { url: string }) {
  const [showPreview, setShowPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const getPreviewSrc = (rawUrl: string): string | null => {
    const fileMatch = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    const folderMatch = rawUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch?.[1]) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
    return null;
  };

  const previewSrc = getPreviewSrc(url);

  return (
    <div className="space-y-2 mt-1">
      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl
                     bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-sm shadow-purple-500/20
                     active:scale-[0.97]"
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.194 20.942 2.4 14.4l5.742-9.942h7.716L9.116 14.4H14.4L8.658 24H2.4zm12.512-1.8-2.97-5.142H14.4L20.142 4.46 23.1 9.6l-2.514 4.342L23.1 18H15.6l-1.2 2.07H10.8L14.4 24h7.2l-2.894-4.858Z" />
          </svg>
          Buka Google Drive
        </a>

        {previewSrc && (
          <button
            type="button"
            onClick={() => { setShowPreview((p) => !p); if (!showPreview) setLoaded(false); }}
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all border
              ${showPreview
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
          >
            {showPreview ? (
              <><span>▲</span> Tutup Preview</>
            ) : (
              <><span>▼</span> Lihat Preview</>
            )}
          </button>
        )}
      </div>

      {/* Collapsible preview panel */}
      {showPreview && previewSrc && (
        <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 shadow-sm">
          {/* Loading skeleton */}
          {!loaded && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-zinc-400 dark:text-zinc-500">
              <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-medium">Memuat preview…</span>
            </div>
          )}
          {/* Aspect ratio wrapper: 16:9 */}
          <div
            style={{ display: loaded ? 'block' : 'none' }}
            className="relative w-full"
          >
            {/* Padding-top trick for 16:9 aspect ratio */}
            <div className="relative" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={previewSrc}
                onLoad={() => setLoaded(true)}
                allow="autoplay"
                title="Google Drive Preview"
                className="absolute inset-0 w-full h-full border-0"
                style={{ background: 'transparent' }}
              />
            </div>
          </div>

          {/* Footer hint */}
          {loaded && (
            <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Preview Google Drive</span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
              >
                Buka di tab baru ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


interface TaskAssignment {
  id: string;
  assignment_role: string;
  status: string;
  result_url: string | null;
  revision_note: string | null;
  appreciation_note?: string | null;
  user_id: string;
  user_name: string | null;
  sparks?: number;
  lead_approved?: number;
  mentor_approved?: number;
  coordinator_approved?: number;
  deadline?: number | null;
}


import { ExtendDeadlineModal } from '@/components/ExtendDeadlineModal';

interface TaskActionsProps {
  taskId: string;
  taskTitle?: string;
  taskDeadline?: number | null;
  taskExtendedDeadline?: number | null;
  taskType?: string;
  taskDescription?: string | null;
  taskCreatedBy?: string | null;
  isDirectBrief?: boolean;
  workspaceType?: string;
  assignments: TaskAssignment[];
  currentUserId: string;
  canDelete: boolean;
  isLeader?: boolean;
  isMentor?: boolean;
  isCoordinator?: boolean;
  isOjt?: boolean;
}

const statusColors: Record<string, string> = {
  DRAFT: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',
  ASSIGNED: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40',
  IN_PROGRESS: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40',
  SUBMITTED: 'text-orange-600 dark:text-orange-400 bg-orange-500/5 border-orange-500/15',
  WAITING_REVIEW: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/5 border-yellow-500/15',
  REVISION_REQUESTED: 'text-red-600 dark:text-red-400 bg-red-500/5 border-red-500/15',
  RESUBMITTED: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 border-indigo-500/15',
  APPROVED: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/15',
  LOCKED: 'text-zinc-700 dark:text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
  PUBLISHED: 'text-purple-600 dark:text-purple-400 bg-purple-500/5 border-purple-500/15',
  DECLINED: 'text-red-800 dark:text-red-500 bg-red-800/10 border-red-800/20',
};

import EditSparksModal from './EditSparksModal';

export default function TaskActions({
  taskId,
  taskTitle,
  taskDeadline,
  taskExtendedDeadline,
  taskType,
  taskDescription,
  taskCreatedBy,
  isDirectBrief = false,
  workspaceType,
  assignments,
  currentUserId,
  canDelete,
  isLeader = false,
  isMentor = false,
  isCoordinator = false,
  isOjt = false,
}: TaskActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [editingSparksAssignId, setEditingSparksAssignId] = useState<string | null>(null);
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [showSubmitMap, setShowSubmitMap] = useState<Record<string, boolean>>({});
  const [expandedResultMap, setExpandedResultMap] = useState<Record<string, boolean>>({});
  const [expandedTextMap, setExpandedTextMap] = useState<Record<string, boolean>>({});
  const [revisionInputs, setRevisionInputs] = useState<Record<string, string>>({});
  const [showRevisionMap, setShowRevisionMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  const isTaskCreator = Boolean(taskCreatedBy && taskCreatedBy === currentUserId);


  const getDrivePreviewUrl = (url: string) => {
    // Convert view/sharing link to embed preview link if possible
    // e.g. https://drive.google.com/file/d/FILE_ID/view?usp=sharing -> https://drive.google.com/file/d/FILE_ID/preview
    // e.g. https://drive.google.com/open?id=FILE_ID -> https://drive.google.com/file/d/FILE_ID/preview
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
    }
    // Folder preview fallback
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch && folderMatch[1]) {
      return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
    }
    return null;
  };


  const { toast, confirm: confirmModal } = useUI();

  const handleDelete = async () => {
    const isConfirmed = await confirmModal({
      title: 'Hapus Tugas',
      message: 'Apakah Anda yakin ingin menghapus tugas ini beserta seluruh penugasannya? Tindakan ini tidak dapat dibatalkan.',
      confirmText: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    setDeleting(true);
    try {
      await deleteTask(taskId);
      toast('Tugas berhasil dihapus.', 'success');
    } catch {
      toast('Gagal menghapus tugas. Silakan coba lagi.', 'error');
      setDeleting(false);
    }
  };

  const handleStartWork = async (assignmentId: string) => {
    setLoading(assignmentId);
    setErrorMap((prev) => ({ ...prev, [assignmentId]: '' }));
    try {
      const res = await startWork(assignmentId);
      if (!res.success) {
        const msg = res.error ?? 'Failed to start work';
        setErrorMap((prev) => ({ ...prev, [assignmentId]: msg }));
        toast(msg, 'error');
      } else {
        setShowSubmitMap((prev) => ({ ...prev, [assignmentId]: true }));
        toast('Pengerjaan tugas dimulai!', 'success');
      }
    } catch (e: any) {
      setErrorMap((prev) => ({ ...prev, [assignmentId]: e.message }));
      toast(e.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleSubmitResult = async (e: React.FormEvent, assignmentId: string) => {
    e.preventDefault();
    const url = urlInputs[assignmentId];
    if (!url?.trim()) return;

    const categories = getDirectBriefCategories(taskDescription);
    const selectedCat = categoryInputs[assignmentId];
    if (isDirectBriefTask && categories.length > 0 && (!selectedCat || !selectedCat.trim())) {
      setErrorMap((prev) => ({ ...prev, [assignmentId]: 'Silakan pilih salah satu kategori output yang tersedia terlebih dahulu.' }));
      toast('Pilih salah satu kategori output yang tersedia terlebih dahulu.', 'warning');
      return;
    }

    setLoading(assignmentId);
    setErrorMap((prev) => ({ ...prev, [assignmentId]: '' }));
    try {
      const res = await submitResult(assignmentId, url.trim(), selectedCat);
      if (res.success) {
        setShowSubmitMap((prev) => ({ ...prev, [assignmentId]: false }));
        toast('Hasil pengerjaan berhasil dikirim untuk di-review!', 'success');
      } else {
        const msg = res.error ?? 'Failed to submit';
        setErrorMap((prev) => ({ ...prev, [assignmentId]: msg }));
        toast(msg, 'error');
      }
    } catch (e: any) {
      setErrorMap((prev) => ({ ...prev, [assignmentId]: e.message }));
      toast(e.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleApproveQC = async (assignmentId: string) => {
    setLoading(assignmentId);
    setErrorMap((prev) => ({ ...prev, [assignmentId]: '' }));
    try {
      const res = await approveAssignment(assignmentId);
      if (!res.success) {
        const msg = res.error ?? 'Approval failed';
        setErrorMap((prev) => ({ ...prev, [assignmentId]: msg }));
        toast(msg, 'error');
      } else {
        toast('Persetujuan QC berhasil disimpan!', 'success');
      }
    } catch (e: any) {
      setErrorMap((prev) => ({ ...prev, [assignmentId]: e.message }));
      toast(e.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleRequestRevision = async (assignmentId: string) => {
    const note = revisionInputs[assignmentId];
    if (!note?.trim()) return toast('Catatan revisi wajib diisi.', 'warning');

    setLoading(assignmentId);
    setErrorMap((prev) => ({ ...prev, [assignmentId]: '' }));
    try {
      const res = await requestRevision(assignmentId, note.trim());
      if (res.success) {
        setShowRevisionMap((prev) => ({ ...prev, [assignmentId]: false }));
        setRevisionInputs((prev) => ({ ...prev, [assignmentId]: '' }));
        toast('Permintaan revisi berhasil dikirim ke intern.', 'info');
      } else {
        const msg = res.error ?? 'Failed to request revision';
        setErrorMap((prev) => ({ ...prev, [assignmentId]: msg }));
        toast(msg, 'error');
      }
    } catch (e: any) {
      setErrorMap((prev) => ({ ...prev, [assignmentId]: e.message }));
      toast(e.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const getDeadlineBadge = (deadline: number | null | undefined, isFinished: boolean) => {
    if (!deadline) return null;
    const now = Date.now();
    const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    const dateStr = new Date(deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    if (isFinished) {
      return (
        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
          ✓ Target: {dateStr}
        </span>
      );
    }

    if (diffDays < 0) {
      const lateDays = Math.abs(diffDays);
      return (
        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse" title={`Target: ${dateStr}`}>
          ⚠️ Terlambat {lateDays} hr ({dateStr})
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" title={`Target: ${dateStr}`}>
          ⏳ Hari Ini ({dateStr})
        </span>
      );
    } else if (diffDays <= 3) {
      return (
        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" title={`Target: ${dateStr}`}>
          ⏱️ H-{diffDays} ({dateStr})
        </span>
      );
    } else {
      return (
        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
          🟢 On Track ({dateStr})
        </span>
      );
    }
  };

  // Identify Direct Brief & OJT assignments
  const isDirectBriefTask =
    taskType === 'DIRECT_BRIEF' ||
    isDirectBrief ||
    Boolean(taskDescription && taskDescription.includes('[DIRECT_BRIEF]'));
  const ojtAssignments = assignments.filter((a) => ['RESEARCHER', 'PLANNER', 'CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(a.assignment_role));
  const isOjtTask = !isDirectBriefTask && (isOjt || ojtAssignments.length > 0);

  // Direct Brief submission state
  const [directUrlInput, setDirectUrlInput] = useState('');
  const [selectedDirectCategory, setSelectedDirectCategory] = useState('');
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [slotSubmitMap, setSlotSubmitMap] = useState<Record<string, boolean>>({});
  const [slotUrlMap, setSlotUrlMap] = useState<Record<string, string>>({});
  const [showDirectForm, setShowDirectForm] = useState(false);

  const handleDirectSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!directUrlInput.trim()) return;

    const categories = getDirectBriefCategories(taskDescription);
    if (categories.length > 0 && (!selectedDirectCategory || !selectedDirectCategory.trim())) {
      alert('Silakan pilih salah satu kategori output yang tersedia terlebih dahulu.');
      return;
    }

    setLoading('direct_submit');
    try {
      const res = await submitDirectTaskResult(taskId, directUrlInput.trim(), selectedDirectCategory);
      if (res.success) {
        setDirectUrlInput('');
        setSelectedDirectCategory('');
        setShowDirectForm(false);
        toast('Hasil karya berhasil dikirim untuk di-review!', 'success');
      } else {
        alert(res.error ?? 'Gagal mengirimkan hasil karya.');
      }
    } catch (err: any) {
      alert(err.message ?? 'Terjadi kesalahan.');
    } finally {
      setLoading(null);
    }
  };
  const [collapsedStepsMap, setCollapsedStepsMap] = useState<Record<string, boolean>>({});

  const toggleStepCollapse = (stepRole: string) => {
    setCollapsedStepsMap((prev) => ({ ...prev, [stepRole]: !prev[stepRole] }));
  };

  // Render OJT rundown flow
  const renderOJTRundown = () => {
    // Filter steps strictly based on task_type (DESIGN vs VIDEO)
    const isVideoTask = taskType === 'VIDEO';
    const allowedStepRoles = isVideoTask
      ? ['RESEARCHER', 'PLANNER', 'VIDEO_EDITOR']
      : ['RESEARCHER', 'PLANNER', 'DESIGNER'];

    const steps = [
      { role: 'RESEARCHER', label: 'Step 1: Researcher (Mencari Ide)', desc: 'Mencari referensi & ide konten.' },
      { role: 'PLANNER', label: 'Step 2: Planner (Membuat Brief)', desc: 'Menyusun brief konten detail.' },
      { role: 'DESIGNER', label: 'Step 3: Designer (Desain Visual)', desc: 'Membuat aset desain visual, feed, & thumbnail.' },
      { role: 'VIDEO_EDITOR', label: 'Step 3: Video Editor (Editing Video)', desc: 'Editing video Reels/TikTok/YouTube.' },
      { role: 'CREATOR', label: 'Step 3: Creator (Produksi Konten)', desc: 'Membuat aset media / konten visual.' },
    ].filter(step => allowedStepRoles.includes(step.role));

    // Find the currently active step index (first step that is NOT approved)
    const activeStepIndex = steps.findIndex((step) => {
      const assign = assignments.find((a) => a.assignment_role === step.role);
      return !assign || !['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(assign.status);
    });

    // Default target active step (if all approved, expand the last step)
    const activeRole = activeStepIndex !== -1 ? steps[activeStepIndex].role : steps[steps.length - 1]?.role;

    let previousStepApproved = true;

    const isMentorWs = workspaceType === 'MENTOR';

    return (
      <div className="space-y-4 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-200 dark:before:bg-zinc-800">
        {steps.map((step) => {
          const allStepAssignments = assignments.filter((a) => a.assignment_role === step.role);
          let visibleAssignments: TaskAssignment[] = [];

          if (isMentorWs) {
            const isStep3 = ['DESIGNER', 'VIDEO_EDITOR', 'CREATOR'].includes(step.role);
            if (isStep3 || isCoordinator || canDelete) {
              // Step 3 or Coordinator/Admin: see ALL mentor assignments
              visibleAssignments = allStepAssignments;
            } else {
              // Step 1 & 2 for Mentor member: ONLY see own assignment!
              visibleAssignments = allStepAssignments.filter((a) => a.user_id === currentUserId);
            }
          } else {
            visibleAssignments = allStepAssignments;
          }

          const primaryAssign = visibleAssignments.find((a) => a.user_id === currentUserId) || visibleAssignments[0];
          const isActive = previousStepApproved;
          const isApproved = visibleAssignments.length > 0 && visibleAssignments.every((a) => ['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(a.status));
          previousStepApproved = visibleAssignments.length === 0 || isApproved;

          const statusBadge = primaryAssign ? statusColors[primaryAssign.status] ?? 'bg-zinc-100 text-zinc-500' : '';

          // Auto-expand step if it's the active/in-progress step, unless explicitly collapsed by user
          const defaultOpen = step.role === activeRole;
          const isCollapsed = collapsedStepsMap[step.role] !== undefined
            ? collapsedStepsMap[step.role]
            : !defaultOpen;

          return (
            <div key={step.role} className="relative group">
              {/* Step indicator node */}
              <div className={`absolute -left-[23px] top-3.5 w-3.5 h-3.5 rounded-full border-2 transition-colors z-10 ${isApproved
                  ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-400 dark:border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : primaryAssign?.status === 'WAITING_REVIEW'
                    ? 'bg-yellow-500 border-yellow-500 dark:bg-yellow-400 dark:border-yellow-400 animate-pulse'
                    : primaryAssign?.status === 'IN_PROGRESS'
                      ? 'bg-indigo-500 border-indigo-500'
                      : isActive
                        ? 'bg-white dark:bg-zinc-900 border-purple-500'
                        : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700'
                }`} />

              <div className={`rounded-2xl border transition-all overflow-hidden ${isApproved
                  ? 'bg-emerald-500/5 border-emerald-500/10 dark:border-emerald-500/5'
                  : primaryAssign?.status === 'WAITING_REVIEW'
                    ? 'bg-yellow-500/5 border-yellow-500/10 dark:border-yellow-500/5'
                    : isActive
                      ? 'bg-white dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800/80 shadow-sm'
                      : 'bg-zinc-50/50 dark:bg-zinc-950/20 border-zinc-100 dark:border-zinc-900/40 opacity-70'
                }`}>
                {/* Clickable Step Header */}
                <button
                  type="button"
                  onClick={() => toggleStepCollapse(step.role)}
                  className="w-full text-left p-3.5 flex flex-wrap items-center justify-between gap-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors focus:outline-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-zinc-400 dark:text-zinc-500 text-xs font-bold transition-transform duration-200 shrink-0 ${isCollapsed ? '' : 'rotate-180'
                      }`}>
                      ▾
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate">{step.label}</h4>
                      {isCollapsed && visibleAssignments.length > 0 && (
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {visibleAssignments.length === 1 ? (
                            <>
                              Assignee:{' '}
                              <Link
                                href={primaryAssign?.user_id ? `/dashboard/profile?userId=${primaryAssign.user_id}` : '/dashboard/profile'}
                                onClick={(e) => e.stopPropagation()}
                                className="font-semibold hover:text-purple-600 dark:hover:text-purple-400 hover:underline"
                              >
                                {primaryAssign.user_name}
                              </Link>
                            </>
                          ) : (
                            <span className="font-bold text-purple-600 dark:text-purple-400">
                              👥 {visibleAssignments.length} Mentors Peserta
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {primaryAssign?.sparks !== undefined && primaryAssign.sparks > 0 && (
                      <span className="text-[10px] font-black bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <span>✨</span> {primaryAssign.sparks} Sparks
                      </span>
                    )}
                    {primaryAssign && getDeadlineBadge(Math.max(taskExtendedDeadline || 0, taskDeadline || 0, primaryAssign.deadline || 0) || null, isApproved ?? false)}
                    {primaryAssign ? (
                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${statusBadge}`}>
                        {visibleAssignments.length > 1
                          ? `${visibleAssignments.filter(a => ['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(a.status)).length}/${visibleAssignments.length} Submitted`
                          : primaryAssign.status.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400">
                        Unassigned
                      </span>
                    )}
                  </div>
                </button>

                {/* Collapsible Step Content */}
                {!isCollapsed && (
                  <div className="px-4 pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800/40 space-y-4">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{step.desc}</p>

                    {visibleAssignments.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic py-2">Belum ada penugasan untuk step ini.</p>
                    ) : (
                      visibleAssignments.map((assign) => {
                        const isMe = assign.user_id === currentUserId;
                        const nowMs = Date.now();
                        const isApprovedState = assign.status === 'APPROVED';
                        const effectiveAssignDeadline = Math.max(taskExtendedDeadline || 0, taskDeadline || 0, assign.deadline || 0) || null;
                        const isPastDeadline = Boolean(effectiveAssignDeadline && effectiveAssignDeadline < nowMs && !['APPROVED', 'WAITING_REVIEW', 'RESUBMITTED'].includes(assign.status));
                        const isNotStarted = Boolean((assign as any).start_at && (assign as any).start_at > nowMs);

                        const displayStatusLabel = isApprovedState ? '✅ Disetujui'
                          : isNotStarted ? '⏳ Belum Dimulai'
                          : isPastDeadline ? (assign.status === 'REVISION_REQUESTED' ? '🚨 Revisi Terlambat' : '🚨 Melewati Deadline')
                          : assign.status === 'REVISION_REQUESTED' ? '↩ Revisi'
                          : assign.status === 'WAITING_REVIEW' ? '📤 Menunggu Review'
                          : assign.status === 'IN_PROGRESS' ? '⚙️ Sedang Dikerjakan'
                          : '📋 Belum Mulai';

                        const assignStatusBadge = isApprovedState ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold'
                          : isNotStarted ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold'
                          : isPastDeadline ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-black animate-pulse'
                          : statusColors[assign.status] ?? 'bg-zinc-100 text-zinc-500';

                        return (
                          <div key={assign.id} className="text-[11px] space-y-2 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 first:border-t-0 first:pt-0">
                            {/* User info */}
                            <div className="flex items-center justify-between gap-2 font-bold">
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-500 dark:text-zinc-400">Assignee:</span>
                                <span className="text-zinc-800 dark:text-zinc-200">{assign.user_name}</span>
                                {isMe && <span className="text-[9px] text-purple-600 dark:text-purple-400 font-black">(you)</span>}
                              </div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${assignStatusBadge}`}>
                                {displayStatusLabel}
                              </span>
                            </div>

                            {/* Result Content / Link - Collapsible (Default Open for Mentor/Coordinator Review) */}
                            {assign.result_url && (() => {
                              const isExpanded = expandedResultMap[assign.id] ?? true;
                              return (
                                <div className="space-y-2 my-2">
                                  <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2 font-bold text-zinc-700 dark:text-zinc-300">
                                      <span>📄</span>
                                      <span>
                                        {['CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assign.assignment_role)
                                          ? 'Aset Hasil Karya (Telah Diserahkan)'
                                          : 'Dokumen Laporan Teks (Telah Diserahkan)'}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedResultMap((prev) => ({ ...prev, [assign.id]: !isExpanded }))}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-lg bg-purple-600/10 text-purple-600 dark:text-purple-400 hover:bg-purple-600/20 transition-all border border-purple-500/20 active:scale-95 cursor-pointer"
                                    >
                                      {isExpanded ? '▲ Sembunyikan Hasil Submit' : '👁️ Lihat Hasil Submit'}
                                    </button>
                                  </div>

                                  {isExpanded && (
                                    <div className="pt-1">
                                      {assign.result_url.includes('<') || assign.result_url.includes('\n') ? (
                                        <DocxDocumentViewer
                                          content={assign.result_url}
                                          roleName={`Step: ${step.label} (${assign.assignment_role})`}
                                        />
                                      ) : (
                                        <SubmittedLinkPreviewer url={assign.result_url} autoExpand={true} />
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Collapsible Revision Note */}
                            {assign.revision_note && ['REVISION_REQUESTED', 'DECLINED'].includes(assign.status) && (
                              <CollapsibleNoteViewer
                                content={assign.revision_note}
                                badgeLabel="⚠️ Perlu Revisi"
                                type="REVISION"
                              />
                            )}

                            {/* Collapsible Appreciation Note */}
                            {['APPROVED', 'DONE', 'PUBLISHED'].includes(assign.status) && (() => {
                              const note = cleanAppreciationNote((assign as any).appreciation_note);
                              if (!note) return null;
                              return (
                                <CollapsibleNoteViewer
                                  content={note}
                                  badgeLabel="✨ Apresiasi"
                                  type="APPRECIATION"
                                />
                              );
                            })()}

                            {/* Clean Consolidated QC Approval Indicator */}
                            {['WAITING_REVIEW', 'APPROVED'].includes(assign.status) && (() => {
                              const isMentorWs = workspaceType === 'MENTOR';

                              if (isMentorWs) {
                                const isFullyApproved = assign.status === 'APPROVED' || assign.coordinator_approved === 1;
                                return (
                                  <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-2 mt-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                        Status QC:
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${isFullyApproved
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                          }`}
                                        title={`Detail: Persetujuan Koordinator (${assign.coordinator_approved ? '✓' : '⏳'})`}
                                      >
                                        <span>{isFullyApproved ? '✓ Selesai' : '⏳ Persetujuan Koordinator'}</span>
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              const approvedCount = (assign.lead_approved || 0) + (assign.mentor_approved || 0) + (assign.coordinator_approved || 0);
                              const isFullyApproved = approvedCount === 3;

                              return (
                                <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-2 mt-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                      Status QC:
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${isFullyApproved
                                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                        }`}
                                      title={`Detail: Ketua Tim (${assign.lead_approved ? '✓' : '⏳'}), Mentor (${assign.mentor_approved ? '✓' : '⏳'}), Koordinator (${assign.coordinator_approved ? '✓' : '⏳'})`}
                                    >
                                      <span>{isFullyApproved ? '✓ Selesai (3/3)' : `⏳ Persetujuan (${approvedCount}/3)`}</span>
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Action buttons */}
                            <div className="pt-2">
                              {errorMap[assign.id] && (
                                <p className="text-[10px] text-red-600 dark:text-red-400 font-bold mb-2">
                                  ⚠️ {errorMap[assign.id]}
                                </p>
                              )}

                              {/* Intern / Mentor Assignee Actions */}
                              {isMe && (
                                <>
                                  {!isActive && !isApproved ? (
                                    <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 text-[10px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-2">
                                      <span>🔒</span>
                                      <span>Step ini masih terkunci. Menunggu Step sebelumnya disetujui QC.</span>
                                    </div>
                                  ) : (
                                    <>
                                      {['ASSIGNED', 'DRAFT', 'REVISION_REQUESTED', 'DECLINED', 'IN_PROGRESS', 'WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(assign.status) && !isApproved && (
                                        <div className="space-y-2">
                                          {showSubmitMap[assign.id] ? (
                                            <form onSubmit={(e) => handleSubmitResult(e, assign.id)} className="space-y-2">
                                              {['CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assign.assignment_role) ? (
                                                <div className="flex gap-2">
                                                  <input
                                                    type="url"
                                                    value={urlInputs[assign.id] ?? ''}
                                                    onChange={(e) => setUrlInputs((prev) => ({ ...prev, [assign.id]: e.target.value }))}
                                                    placeholder="Paste Link Google Drive / Canva / Figma hasil karya..."
                                                    required
                                                    className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 transition-all text-zinc-900 dark:text-zinc-100"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => setShowSubmitMap((prev) => ({ ...prev, [assign.id]: false }))}
                                                    className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 font-bold text-[10px] px-3 py-1.5 rounded-lg"
                                                  >
                                                    Batal
                                                  </button>
                                                  <button
                                                    type="submit"
                                                    disabled={loading === assign.id}
                                                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                                                  >
                                                    {loading === assign.id ? '...' : (assign.result_url ? 'Simpan Perubahan' : 'Submit')}
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="space-y-2">
                                                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600 dark:text-zinc-300 pb-0.5">
                                                    <span>📝 Text Editor — {step.role === 'RESEARCHER' ? 'Step 1: Researcher' : 'Step 2: Planner'}</span>
                                                  </div>
                                                  <TiptapEditor
                                                    value={urlInputs[assign.id] ?? ''}
                                                    onChange={(val) => setUrlInputs((prev) => ({ ...prev, [assign.id]: val }))}
                                                    placeholder={`Tulis laporan ${step.label} dengan format kaya (Bold, Italic, Heading H1-H3, List, Link, dll)...`}
                                                  />
                                                  <div className="flex justify-end gap-2 pt-1">
                                                    <button
                                                      type="button"
                                                      onClick={() => setShowSubmitMap((prev) => ({ ...prev, [assign.id]: false }))}
                                                      className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 font-bold text-[10px] px-3 py-1.5 rounded-lg"
                                                    >
                                                      Batal
                                                    </button>
                                                    <button
                                                      type="submit"
                                                      disabled={loading === assign.id || !urlInputs[assign.id]?.replace(/<[^>]*>/g, '').trim()}
                                                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] px-4 py-2 rounded-xl shadow-xs transition-all disabled:opacity-50"
                                                    >
                                                      {loading === assign.id ? 'Submitting...' : (assign.result_url ? 'Simpan Perubahan Laporan' : 'Kirim Laporan')}
                                                    </button>
                                                  </div>
                                                </div>
                                              )}
                                            </form>
                                          ) : isPastDeadline ? (
                                            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center gap-2">
                                              <span>⏰</span>
                                              <span>Tenggat waktu (deadline) tugas ini telah berakhir. Pengumpulan ditutup.</span>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {assign.status === 'ASSIGNED' && !assign.result_url && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleStartWork(assign.id)}
                                                  disabled={loading === assign.id}
                                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all active:scale-[0.98]"
                                                >
                                                  {loading === assign.id ? 'Starting...' : '🚀 Mulai Pengerjaan'}
                                                </button>
                                              )}

                                              {assign.result_url ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setUrlInputs((prev) => ({ ...prev, [assign.id]: assign.result_url ?? '' }));
                                                    setShowSubmitMap((prev) => ({ ...prev, [assign.id]: true }));
                                                  }}
                                                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all active:scale-[0.98] flex items-center gap-1"
                                                >
                                                  ✏️ Edit Hasil Submit (Perbaiki Typos / Link)
                                                </button>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    if (assign.status === 'ASSIGNED') {
                                                      await handleStartWork(assign.id);
                                                    }
                                                    setUrlInputs((prev) => ({ ...prev, [assign.id]: prev[assign.id] ?? '' }));
                                                    setShowSubmitMap((prev) => ({ ...prev, [assign.id]: true }));
                                                  }}
                                                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all active:scale-[0.98]"
                                                >
                                                  {['CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assign.assignment_role)
                                                    ? '📤 Kirim Hasil Karya (Google Drive / Canva URL)'
                                                    : '📝 Kirim Laporan Teks Hasil Pengerjaan'}
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </>
                              )}

                              {/* QC Approver Actions: Only non-submitter, and for MENTOR workspace ONLY Coordinator or Task Creator */}
                              {['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(assign.status) &&
                                assign.user_id !== currentUserId &&
                                (isMentorWs ? (isCoordinator || isTaskCreator) : (isLeader || isMentor || isCoordinator)) && (
                                <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/60 mt-2">
                                  <p className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                                    Persetujuan QC & Pemberian Sparks
                                  </p>
                                  <ReviewActions
                                    assignmentId={assign.id}
                                    canRequestRevision={isMentorWs ? (isCoordinator || isTaskCreator) : (isLeader || isMentor || isCoordinator)}
                                    canAwardBadge={isMentorWs ? (isCoordinator || isTaskCreator) : (isMentor || isCoordinator)}
                                    isStaffOrCoord={isCoordinator || isTaskCreator}
                                    mentorApproved={assign.mentor_approved ?? 0}
                                    coordinatorApproved={assign.coordinator_approved ?? 0}
                                    isMentorWs={isMentorWs}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderNormalAssignments = () => {
    const isMentorWs = workspaceType === 'MENTOR';
    const isReviewer = isLeader || isMentor || isCoordinator;
    const canUserSubmitDirect = !isCoordinator; // Koordinator / Admin / Executive does NOT submit!

    // Deduplicate assignments by user_id for DIRECT_BRIEF tasks & filter for clean display
    let displayAssignments = assignments;
    if (isDirectBriefTask) {
      const userMap = new Map();
      for (const a of assignments) {
        const existing = userMap.get(a.user_id);
        if (!existing) {
          userMap.set(a.user_id, a);
        } else {
          // If existing is ASSIGNED but this one has a submission, pick the one with submission!
          if (existing.status === 'ASSIGNED' && a.status !== 'ASSIGNED') {
            userMap.set(a.user_id, a);
          }
        }
      }
      const deduplicated = Array.from(userMap.values());
      if (isReviewer) {
        // For Coordinator / Mentor view: show only actual submissions (where result_url is present or status != ASSIGNED)
        displayAssignments = deduplicated.filter(a => a.result_url || a.status !== 'ASSIGNED');
      } else {
        // For Participant view: show own assignment (or submitted ones)
        displayAssignments = deduplicated.filter(a => a.user_id === currentUserId || a.result_url || a.status !== 'ASSIGNED');
      }
    }

    // Helper to render Direct Brief submit box for participants/mentors (NOT for Koordinator)
    const renderDirectBriefSubmitBox = () => {
      if (!canUserSubmitDirect) return null; // Koordinator / Admin does NOT see submit form

      const mySubmission = assignments.find(a => a.user_id === currentUserId && (a.result_url || a.status !== 'ASSIGNED'));
      const categories = getDirectBriefCategories(taskDescription);

      if (mySubmission && !showDirectForm) {
        return (
          <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs mb-3">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                <span>✓</span> Anda Sudah Mengumpulkan Karya
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                ({mySubmission.status.replace('_', ' ')})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowDirectForm(true)}
              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline bg-purple-500/10 px-3 py-1 rounded-xl border border-purple-500/20 cursor-pointer"
            >
              📤 Kirim Ulang (Resubmit)
            </button>
          </div>
        );
      }

      return (
        <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10 border border-purple-500/20 rounded-2xl p-4 space-y-3 mb-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-purple-700 dark:text-purple-300 flex items-center gap-1.5 uppercase tracking-wider">
              <span>📤</span> {isMentorWs ? 'Submit Hasil Karya Mentor' : 'Submit Hasil Karya Saya'}
            </span>
            <span className="text-[10px] font-medium text-purple-600/80 dark:text-purple-300/80">
              {isMentorWs ? '(Peserta Workspace ini adalah Mentor)' : '(Masukkan link karya hasil pekerjaan Anda)'}
            </span>
          </div>

          <form onSubmit={handleDirectSubmit} className="space-y-3">
            {categories.length > 0 && (
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                  Pilih Kategori Output Karya Yang Dikerjakan <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedDirectCategory}
                  onChange={(e) => setSelectedDirectCategory(e.target.value)}
                  required
                  className="w-full bg-white dark:bg-zinc-900 border border-purple-500/30 text-xs rounded-xl px-3.5 py-2.5 font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                >
                  <option value="">-- Pilih Kategori Output Karya --</option>
                  {categories.map((cat) => {
                    const claimedAss = displayAssignments.find(
                      (a) => (a.result_url || a.status !== 'ASSIGNED') && (a.assignment_role === cat || a.assignment_role === `Kategori: ${cat}` || a.assignment_role.includes(cat))
                    );
                    const isClaimedByMe = mySubmission && (mySubmission.assignment_role === cat || mySubmission.assignment_role === `Kategori: ${cat}`);
                    const isClaimedByOther = claimedAss && !isClaimedByMe && (claimedAss.user_id !== currentUserId);

                    return (
                      <option key={cat} value={cat} disabled={Boolean(isClaimedByOther)}>
                        {isClaimedByOther ? `❌ ${cat} (Sudah diambil oleh ${claimedAss.user_name || 'Peserta lain'})` : `✓ ${cat}`}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="url"
                value={directUrlInput}
                onChange={(e) => setDirectUrlInput(e.target.value)}
                placeholder="Paste URL Karya (Google Drive / Figma / Canva / Youtube)..."
                required
                className="flex-1 bg-white dark:bg-zinc-900 border border-purple-500/30 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
              />
              <button
                type="submit"
                disabled={loading === 'direct_submit'}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-purple-500/20 shrink-0 cursor-pointer active:scale-95"
              >
                {loading === 'direct_submit' ? 'Mengirim...' : 'Kirim Submit'}
              </button>
            </div>
          </form>
        </div>
      );
    };

    const categories = getDirectBriefCategories(taskDescription);

    if (isDirectBriefTask && categories.length > 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 uppercase tracking-wide">
                <span>🎯</span> Slot Output Karya Berdasarkan Kategori ({categories.length} Slot)
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Pilih slot kategori yang masih tersedia untuk mengumpulkan karya Anda. Setiap kategori hanya dapat di-submit 1x oleh 1 peserta.
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
              {assignments.filter(a => a.result_url || a.status !== 'ASSIGNED').length}/{categories.length} Slot Terisi
            </span>
          </div>

          <div className="space-y-3">
            {categories.map((cat, idx) => {
              // Find matching assignment submitted for this category
              const categoryAss = assignments.find(
                (a) => (a.result_url || a.status !== 'ASSIGNED') && (
                  a.assignment_role === cat ||
                  a.assignment_role === `Kategori: ${cat}` ||
                  a.assignment_role.includes(cat) ||
                  cat.includes(a.assignment_role)
                )
              );

              const isTaken = Boolean(categoryAss);
              const isMine = categoryAss?.user_id === currentUserId;
              const canUserSubmit = !isCoordinator;
              const hasUserSubmittedAny = assignments.some(a => a.user_id === currentUserId && (a.result_url || a.status !== 'ASSIGNED'));

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border p-4 space-y-3 transition-all ${
                    isTaken
                      ? 'bg-emerald-500/[0.02] dark:bg-emerald-500/[0.04] border-emerald-500/25 shadow-xs'
                      : 'bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {/* Category Slot Header */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        isTaken ? 'bg-emerald-500 text-white' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      }`}>
                        #{idx + 1}
                      </span>
                      <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                        {cat}
                      </span>
                    </div>

                    {isTaken && categoryAss ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          ✓ Terisi oleh {categoryAss.user_name || 'Peserta'} {isMine && '(Anda)'}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${statusColors[categoryAss.status] ?? statusColors.DRAFT}`}>
                          {categoryAss.status.replace('_', ' ')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                        ⏳ Slot Tersedia
                      </span>
                    )}
                  </div>

                  {/* Content Body */}
                  {isTaken && categoryAss ? (
                    <div className="space-y-3 pt-1">
                      {/* Link Previewer - Visible to EVERYONE! */}
                      {categoryAss.result_url && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                            Hasil Karya Submitter ({categoryAss.user_name || 'Peserta'}):
                          </span>
                          <SubmittedLinkPreviewer url={categoryAss.result_url} autoExpand={true} />
                        </div>
                      )}

                      {/* Revision Note if any */}
                      {categoryAss.revision_note && ['REVISION_REQUESTED', 'DECLINED'].includes(categoryAss.status) && (
                        <CollapsibleNoteViewer
                          content={categoryAss.revision_note}
                          badgeLabel="⚠️ Catatan Revisi"
                          type="REVISION"
                        />
                      )}

                      {/* Appreciation Note if approved */}
                      {['APPROVED', 'DONE', 'PUBLISHED'].includes(categoryAss.status) && categoryAss.revision_note && (
                        <CollapsibleNoteViewer
                          content={categoryAss.revision_note}
                          badgeLabel="✨ Apresiasi & Catatan Review"
                          type="APPRECIATION"
                        />
                      )}

                      {/* QC Approver Actions for Reviewer */}
                      {['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(categoryAss.status) &&
                        categoryAss.user_id !== currentUserId &&
                        (isMentorWs ? (isCoordinator || isTaskCreator) : (isLeader || isMentor || isCoordinator)) && (
                        <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/60 mt-2">
                          <p className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                            Persetujuan QC & Pemberian Sparks
                          </p>
                          <ReviewActions
                            assignmentId={categoryAss.id}
                            canRequestRevision={isMentorWs ? (isCoordinator || isTaskCreator) : (isLeader || isMentor || isCoordinator)}
                            canAwardBadge={isMentorWs ? (isCoordinator || isTaskCreator) : (isMentor || isCoordinator)}
                            isStaffOrCoord={isCoordinator || isTaskCreator}
                            mentorApproved={categoryAss.mentor_approved ?? 0}
                            coordinatorApproved={categoryAss.coordinator_approved ?? 0}
                            isMentorWs={isMentorWs}
                          />
                        </div>
                      )}

                      {/* Resubmit button if it's my submission and in revision/assigned status */}
                      {isMine && ['ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'REVISION_REQUESTED', 'DECLINED'].includes(categoryAss.status) && (
                        <div className="pt-1">
                          {showSubmitMap[categoryAss.id] ? (
                            <form onSubmit={(e) => handleSubmitResult(e, categoryAss.id)} className="flex gap-2">
                              <input
                                type="url"
                                value={urlInputs[categoryAss.id] ?? ''}
                                onChange={(e) => setUrlInputs((prev) => ({ ...prev, [categoryAss.id]: e.target.value }))}
                                placeholder="Paste URL Karya (Google Drive / Canva / Figma / Youtube)..."
                                required
                                className="flex-1 bg-white dark:bg-zinc-900 border border-purple-500/30 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-zinc-900 dark:text-zinc-100"
                              />
                              <button
                                type="submit"
                                disabled={loading === categoryAss.id}
                                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer font-bold"
                              >
                                {loading === categoryAss.id ? '...' : 'Submit'}
                              </button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setShowSubmitMap((prev) => ({ ...prev, [categoryAss.id]: true }));
                                setCategoryInputs((prev) => ({ ...prev, [categoryAss.id]: cat }));
                              }}
                              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-purple-500/20 active:scale-[0.98] cursor-pointer"
                            >
                              📤 Kirim Ulang (Resubmit) untuk Kategori Ini
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Slot Available Form / Submit Button */
                    <div className="pt-1">
                      {canUserSubmit && !hasUserSubmittedAny ? (
                        <div>
                          {slotSubmitMap[cat] ? (
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const url = slotUrlMap[cat];
                                if (!url || !url.trim()) return;
                                setLoading(`slot_${cat}`);
                                try {
                                  const res = await submitDirectTaskResult(taskId, url.trim(), cat);
                                  if (res.success) {
                                    setSlotUrlMap((prev) => ({ ...prev, [cat]: '' }));
                                    setSlotSubmitMap((prev) => ({ ...prev, [cat]: false }));
                                    toast('Hasil karya berhasil dikirim!', 'success');
                                  } else {
                                    toast(res.error || 'Gagal submit.', 'error');
                                  }
                                } catch (err: any) {
                                  toast(err.message || 'Terjadi kesalahan.', 'error');
                                } finally {
                                  setLoading(null);
                                }
                              }}
                              className="space-y-2"
                            >
                              <p className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
                                Masukkan Link Hasil Karya untuk Kategori: <span className="underline">{cat}</span>
                              </p>
                              <div className="flex gap-2">
                                <input
                                  type="url"
                                  value={slotUrlMap[cat] || ''}
                                  onChange={(e) => setSlotUrlMap((prev) => ({ ...prev, [cat]: e.target.value }))}
                                  placeholder="Paste URL Google Drive / Canva / Figma / Youtube..."
                                  required
                                  className="flex-1 bg-white dark:bg-zinc-900 border border-purple-500/30 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-zinc-900 dark:text-zinc-100 font-medium"
                                />
                                <button
                                  type="submit"
                                  disabled={loading === `slot_${cat}`}
                                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer shrink-0"
                                >
                                  {loading === `slot_${cat}` ? '...' : 'Submit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSlotSubmitMap((prev) => ({ ...prev, [cat]: false }))}
                                  className="px-3 py-2.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer font-semibold"
                                >
                                  Batal
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSlotSubmitMap((prev) => ({ ...prev, [cat]: true }))}
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                            >
                              <span>📤</span>
                              <span>Submit Karya untuk Kategori Ini</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic">
                          {hasUserSubmittedAny
                            ? 'Anda telah melakukan submit pada salah satu kategori.'
                            : 'Slot ini masih tersedia dan belum diambil oleh peserta manapun.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (isDirectBriefTask && displayAssignments.length === 0) {
      return (
        <div className="space-y-3 my-2">
          {renderDirectBriefSubmitBox()}
          <div className="p-6 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-1.5 bg-zinc-50/50 dark:bg-zinc-900/20">
            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-1.5">
              <span>📌</span> {isMentorWs ? 'Belum Ada Submission dari Mentor' : 'Belum Ada Peserta yang Mengumpulkan Hasil Karya'}
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {isMentorWs
                ? 'Daftar hasil karya yang dikirimkan oleh mentor akan otomatis muncul di sini untuk Anda review & berikan Sparks.'
                : 'Daftar submission akan otomatis muncul di sini begitu peserta menempelkan link hasil karya mereka.'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {isDirectBriefTask && renderDirectBriefSubmitBox()}
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            {isDirectBriefTask
              ? (isMentorWs ? '⚡ Daftar Submit Peserta (Mentor)' : '⚡ Daftar Submit Peserta (Direct Brief)')
              : 'Assignments'}
          </p>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
            {displayAssignments.filter(a => ['APPROVED', 'DONE', 'PUBLISHED'].includes(a.status)).length}/{displayAssignments.length} Selesai ACC
          </span>
        </div>
        {displayAssignments.map((a) => {
          const isMe = a.user_id === currentUserId;
          const roleLabel = isDirectBriefTask ? 'Submitter' : a.assignment_role;
          const status = statusColors[a.status] ?? statusColors.DRAFT;
          return (
            <div
              key={a.id}
              className={`rounded-2xl border p-4 space-y-3 text-xs transition-all ${isMe
                  ? 'bg-purple-500/[0.02] dark:bg-purple-500/[0.04] border-purple-500/20 shadow-sm'
                  : 'bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200/80 dark:border-zinc-800/80'
                }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {!isDirectBriefTask && (
                    <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border text-purple-600 bg-purple-500/10 border-purple-500/15">
                      {roleLabel}
                    </span>
                  )}
                  <span className="text-zinc-900 dark:text-zinc-100 font-extrabold text-sm flex items-center gap-1.5">
                    <span>👤</span> {a.user_name ?? 'Peserta'}
                  </span>
                  {isMe && (
                    <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                      (Anda)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {getDeadlineBadge(Math.max(taskExtendedDeadline || 0, taskDeadline || 0, a.deadline || 0) || null, ['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(a.status))}
                  <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${status}`}>
                    {a.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              {a.revision_note && ['REVISION_REQUESTED', 'DECLINED'].includes(a.status) && (
                <CollapsibleNoteViewer
                  content={a.revision_note}
                  badgeLabel="⚠️ Catatan Revisi"
                  type="REVISION"
                />
              )}
              {a.result_url && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Hasil Karya Peserta:
                  </span>
                  <SubmittedLinkPreviewer url={a.result_url} autoExpand={true} />
                </div>
              )}
              {isMe && ['ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'REVISION_REQUESTED', 'DECLINED'].includes(a.status) && (
                <div className="pt-1">
                  {showSubmitMap[a.id] ? (
                    <form onSubmit={(e) => handleSubmitResult(e, a.id)} className="flex gap-2">
                      <input
                        type="url"
                        value={urlInputs[a.id] ?? ''}
                        onChange={(e) => setUrlInputs((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        placeholder="Paste Google Drive / Figma / Result URL..."
                        required
                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-zinc-900 dark:text-zinc-100"
                      />
                      <button
                        type="submit"
                        disabled={loading === a.id}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm"
                      >
                        {loading === a.id ? '...' : 'Submit'}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSubmitMap((prev) => ({ ...prev, [a.id]: true }))}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]"
                    >
                      {a.status === 'REVISION_REQUESTED' ? '📤 Resubmit Hasil Karya' : '📤 Submit Hasil Karya'}
                    </button>
                  )}
                </div>
              )}
              {/* QC Approver Actions: Only non-submitter, and for MENTOR workspace ONLY Coordinator or Task Creator */}
              {['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(a.status) &&
                a.user_id !== currentUserId &&
                (isMentorWs ? (isCoordinator || isTaskCreator) : (isLeader || isMentor || isCoordinator)) && (
                <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/60 mt-2">
                  <p className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                    Persetujuan QC & Pemberian Sparks
                  </p>
                  <ReviewActions
                    assignmentId={a.id}
                    canRequestRevision={isMentorWs ? (isCoordinator || isTaskCreator) : (isLeader || isMentor || isCoordinator)}
                    canAwardBadge={isMentorWs ? (isCoordinator || isTaskCreator) : (isMentor || isCoordinator)}
                    isStaffOrCoord={isCoordinator || isTaskCreator}
                    mentorApproved={a.mentor_approved ?? 0}
                    coordinatorApproved={a.coordinator_approved ?? 0}
                    isMentorWs={isMentorWs}
                  />
                </div>
              )}
              {['APPROVED', 'DONE', 'PUBLISHED'].includes(a.status) && (() => {
                const note = cleanAppreciationNote((a as any).appreciation_note);
                return (
                  <div className="space-y-2 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                    {note && (
                      <CollapsibleNoteViewer
                        content={note}
                        badgeLabel="✨ Apresiasi"
                        type="APPRECIATION"
                      />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-purple-600 dark:text-purple-400 flex items-center gap-1.5 bg-purple-500/10 px-3 py-1 rounded-xl border border-purple-500/20">
                        <span>✨ Sparks Diperoleh:</span>
                        <strong className="text-sm">{a.sparks || 0} Poin</strong>
                      </span>
                      {isCoordinator && (
                        <button
                          type="button"
                          onClick={() => setEditingSparksAssignId(a.id)}
                          className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 bg-purple-500/10 px-3 py-1 rounded-xl border border-purple-500/20 active:scale-95 transition-all flex items-center gap-1"
                        >
                          <span>✏️</span> Ubah Sparks
                        </button>
                      )}
                    </div>
                    {editingSparksAssignId === a.id && (
                      <EditSparksModal
                        assignmentId={a.id}
                        assigneeName={a.user_name ?? 'Peserta'}
                        currentSparks={a.sparks || 8}
                        isOpen={true}
                        onClose={() => setEditingSparksAssignId(null)}
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/60 mt-4">
      {/* Dynamic Render based on Task Type */}
      {isOjtTask ? renderOJTRundown() : renderNormalAssignments()}

      {/* Manage actions (Extend Deadline / Delete) */}
      {(canDelete || isCoordinator || isMentor || isLeader) && (
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900/60 mt-2 flex items-center justify-between gap-2 flex-wrap">
          {(isCoordinator || isMentor || isLeader) && (
            <button
              type="button"
              onClick={() => setShowExtendModal(true)}
              title="Extend Deadline Task"
              className="text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-amber-500/20 transition-all active:scale-[0.97] flex items-center gap-1 cursor-pointer"
            >
              <span>⏳</span>
              <span>Extend Deadline Task</span>
            </button>
          )}

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 dark:text-red-400 hover:bg-red-500/5 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-transparent hover:border-red-500/10 transition-all disabled:opacity-50 active:scale-[0.97]"
            >
              {deleting ? 'Deleting...' : 'Delete Task'}
            </button>
          )}
        </div>
      )}

      {/* Extend Deadline Modal */}
      {showExtendModal && (
        <ExtendDeadlineModal
          taskId={taskId}
          taskTitle={taskTitle || 'Tugas Workspace'}
          currentDeadline={taskDeadline || null}
          currentExtendedDeadline={taskExtendedDeadline || null}
          isOpen={showExtendModal}
          onClose={() => setShowExtendModal(false)}
        />
      )}
    </div>
  );
}
