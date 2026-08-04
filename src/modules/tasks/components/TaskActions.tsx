'use client';

import { useState } from 'react';
import Link from 'next/link';
import { submitResult, deleteTask, approveAssignment, requestRevision, startWork, updateSparks } from '../actions';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import MarkdownInput from '@/components/MarkdownInput';
import { useUI } from '@/components/ui/UIProvider';
import ReviewActions from '@/app/dashboard/review/components/ReviewActions';

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
            <path d="M6.194 20.942 2.4 14.4l5.742-9.942h7.716L9.116 14.4H14.4L8.658 24H2.4zm12.512-1.8-2.97-5.142H14.4L20.142 4.46 23.1 9.6l-2.514 4.342L23.1 18H15.6l-1.2 2.07H10.8L14.4 24h7.2l-2.894-4.858Z"/>
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
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
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
  id:              string;
  assignment_role: string;
  status:          string;
  result_url:      string | null;
  revision_note:   string | null;
  user_id:         string;
  user_name:       string | null;
  sparks?:         number;
  lead_approved?:   number;
  mentor_approved?: number;
  coordinator_approved?: number;
  deadline?:        number | null;
}


interface TaskActionsProps {
  taskId:          string;
  taskType?:       string;
  assignments:     TaskAssignment[];
  currentUserId:   string;
  canDelete:       boolean;
  isLeader?:       boolean;
  isMentor?:       boolean;
  isCoordinator?:  boolean;
  isOjt?:          boolean;
}

const statusColors: Record<string, string> = {
  DRAFT:              'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',
  ASSIGNED:           'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40',
  IN_PROGRESS:        'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40',
  SUBMITTED:          'text-orange-600 dark:text-orange-400 bg-orange-500/5 border-orange-500/15',
  WAITING_REVIEW:     'text-yellow-600 dark:text-yellow-400 bg-yellow-500/5 border-yellow-500/15',
  REVISION_REQUESTED: 'text-red-600 dark:text-red-400 bg-red-500/5 border-red-500/15',
  RESUBMITTED:        'text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 border-indigo-500/15',
  APPROVED:           'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/15',
  LOCKED:             'text-zinc-700 dark:text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
  PUBLISHED:          'text-purple-600 dark:text-purple-400 bg-purple-500/5 border-purple-500/15',
  DECLINED:           'text-red-800 dark:text-red-500 bg-red-800/10 border-red-800/20',
};

import EditSparksModal from './EditSparksModal';

export default function TaskActions({
  taskId,
  taskType,
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
  const [editingSparksAssignId, setEditingSparksAssignId] = useState<string | null>(null);
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [showSubmitMap, setShowSubmitMap] = useState<Record<string, boolean>>({});
  const [expandedTextMap, setExpandedTextMap] = useState<Record<string, boolean>>({});
  const [revisionInputs, setRevisionInputs] = useState<Record<string, string>>({});
  const [showRevisionMap, setShowRevisionMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});


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

    setLoading(assignmentId);
    setErrorMap((prev) => ({ ...prev, [assignmentId]: '' }));
    try {
      const res = await submitResult(assignmentId, url.trim());
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

  // Identify OJT assignments
  const ojtAssignments = assignments.filter((a) => ['RESEARCHER', 'PLANNER', 'CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(a.assignment_role));
  const isOjtTask = isOjt || ojtAssignments.length > 0;

  // Collapsible step state: track user explicit toggles (role -> boolean)
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

    return (
      <div className="space-y-4 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-200 dark:before:bg-zinc-800">
        {steps.map((step) => {
          const assign = assignments.find((a) => a.assignment_role === step.role);
          const isActive = previousStepApproved;
          
          // Check if this step is approved or unassigned
          const isApproved = assign && ['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(assign.status);
          
          // Update sequential gate: unassigned steps or approved steps do not block the next step
          previousStepApproved = !assign || (isApproved ?? false);

          const isMe = assign?.user_id === currentUserId;
          const statusBadge = assign ? statusColors[assign.status] ?? 'bg-zinc-100 text-zinc-500' : '';
          
          // Auto-expand step if it's the active/in-progress step, unless explicitly collapsed by user
          const defaultOpen = step.role === activeRole;
          const isCollapsed = collapsedStepsMap[step.role] !== undefined
            ? collapsedStepsMap[step.role]
            : !defaultOpen;

          return (
            <div key={step.role} className="relative group">
              {/* Step indicator node */}
              <div className={`absolute -left-[23px] top-3.5 w-3.5 h-3.5 rounded-full border-2 transition-colors z-10 ${
                isApproved 
                  ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-400 dark:border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : assign?.status === 'WAITING_REVIEW'
                  ? 'bg-yellow-500 border-yellow-500 dark:bg-yellow-400 dark:border-yellow-400 animate-pulse'
                  : assign?.status === 'IN_PROGRESS'
                  ? 'bg-indigo-500 border-indigo-500'
                  : isActive
                  ? 'bg-white dark:bg-zinc-900 border-purple-500'
                  : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700'
              }`} />

              <div className={`rounded-2xl border transition-all overflow-hidden ${
                isApproved
                  ? 'bg-emerald-500/5 border-emerald-500/10 dark:border-emerald-500/5'
                  : assign?.status === 'WAITING_REVIEW'
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
                    <span className={`text-zinc-400 dark:text-zinc-500 text-xs font-bold transition-transform duration-200 shrink-0 ${
                      isCollapsed ? '' : 'rotate-180'
                    }`}>
                      ▾
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate">{step.label}</h4>
                      {isCollapsed && assign?.user_name && (
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          Assignee:{' '}
                          <Link
                            href="/dashboard/profile"
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold hover:text-purple-600 dark:hover:text-purple-400 hover:underline"
                          >
                            {assign.user_name}
                          </Link>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {assign?.sparks !== undefined && assign.sparks > 0 && (
                      <span className="text-[10px] font-black bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <span>✨</span> {assign.sparks} Sparks
                      </span>
                    )}
                    {assign && getDeadlineBadge(assign.deadline, isApproved ?? false)}
                    {assign ? (
                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${statusBadge}`}>
                        {assign.status.replace('_', ' ')}
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
                  <div className="px-4 pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800/40 space-y-2">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{step.desc}</p>


                {assign && (
                  <div className="text-[11px] space-y-2 pt-1">
                    {/* User info */}
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-zinc-500 dark:text-zinc-400">Assignee:</span>
                      <span className="text-zinc-800 dark:text-zinc-200">{assign.user_name}</span>
                      {isMe && <span className="text-[9px] text-purple-600 dark:text-purple-400 font-black">(you)</span>}
                    </div>

                    {/* Result Content / Link */}
                    {assign.result_url && (
                      <div className="space-y-2">
                        <span className="text-zinc-500 dark:text-zinc-400 font-bold block">
                          {['CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assign.assignment_role) ? 'Aset Hasil Karya (Google Drive):' : 'Laporan Hasil Pengerjaan:'}
                        </span>

                        {['CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assign.assignment_role) ? (
                          <CreatorDrivePreview url={assign.result_url} />
                        ) : (
                          /* Text report rendered via MarkdownViewer */
                          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-3 text-xs text-zinc-800 dark:text-zinc-200">
                            <div
                              className={`leading-relaxed ${
                                !expandedTextMap[assign.id] && assign.result_url.length > 200 ? 'line-clamp-3 overflow-hidden' : ''
                              }`}
                            >
                              <MarkdownViewer content={assign.result_url} />
                            </div>


                            {assign.result_url.length > 200 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedTextMap((prev) => ({ ...prev, [assign.id]: !prev[assign.id] }))
                                }
                                className="mt-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline focus:outline-none"
                              >
                                {expandedTextMap[assign.id] ? '↑ Ciutkan Teks' : '↓ Baca Selengkapnya'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Revision Note */}
                    {assign.revision_note && ['REVISION_REQUESTED', 'DECLINED'].includes(assign.status) && (
                      <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-[10px] text-red-700 dark:text-red-400 space-y-1">
                        <span className="font-bold block">📝 Catatan Revisi:</span>
                        <p>{assign.revision_note}</p>
                      </div>
                    )}

                    {/* Clean Consolidated QC Approval Indicator */}
                    {['WAITING_REVIEW', 'APPROVED'].includes(assign.status) && (() => {
                      const approvedCount = (assign.lead_approved || 0) + (assign.mentor_approved || 0) + (assign.coordinator_approved || 0);
                      const isFullyApproved = approvedCount === 3;

                      return (
                        <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-2 mt-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                              Status QC:
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                                isFullyApproved
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

                      {/* Intern Assignee Actions */}
                      {isMe && (
                        <>
                          {!isActive && !isApproved ? (
                            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 text-[10px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-2">
                              <span>🔒</span>
                              <span>Step ini masih terkunci. Menunggu Step sebelumnya disetujui QC.</span>
                            </div>
                          ) : (
                            <>
                              {assign.status === 'ASSIGNED' && (
                                <button
                                  type="button"
                                  onClick={() => handleStartWork(assign.id)}
                                  disabled={loading === assign.id}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all active:scale-[0.98]"
                                >
                                  {loading === assign.id ? 'Starting...' : '🚀 Mulai Pengerjaan'}
                                </button>
                              )}

                              {['DRAFT', 'REVISION_REQUESTED', 'DECLINED', 'IN_PROGRESS'].includes(assign.status) && (
                                <div className="space-y-2">
                                  {showSubmitMap[assign.id] ? (
                                    <form onSubmit={(e) => handleSubmitResult(e, assign.id)} className="space-y-2">
                                      {['CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assign.assignment_role) ? (
                                        <div className="flex gap-2">
                                          <input
                                            type="url"
                                            value={urlInputs[assign.id] ?? ''}
                                            onChange={(e) => setUrlInputs((prev) => ({ ...prev, [assign.id]: e.target.value }))}
                                            placeholder="Paste Link Google Drive hasil karya..."
                                            required
                                            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 transition-all text-zinc-900 dark:text-zinc-100"
                                          />
                                          <button
                                            type="submit"
                                            disabled={loading === assign.id}
                                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                                          >
                                            {loading === assign.id ? '...' : 'Submit'}
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          <MarkdownInput
                                            value={urlInputs[assign.id] ?? ''}
                                            onChange={(val) => setUrlInputs((prev) => ({ ...prev, [assign.id]: val }))}
                                            rows={4}
                                            placeholder={`Tulis laporan hasil pengerjaan ${step.label} (mendukung Markdown: **bold**, *italic*, - list, etc)...`}
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
                                              disabled={loading === assign.id || !urlInputs[assign.id]?.trim()}
                                              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                                            >
                                              {loading === assign.id ? 'Submitting...' : 'Kirim Laporan Teks'}
                                            </button>
                                          </div>
                                        </div>

                                      )}
                                    </form>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setShowSubmitMap((prev) => ({ ...prev, [assign.id]: true }))}
                                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all active:scale-[0.98]"
                                    >
                                      {['CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assign.assignment_role)
                                        ? '📤 Kirim Hasil Karya (Google Drive URL)'
                                        : '📝 Kirim Laporan Teks Hasil Pengerjaan'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}


                      {/* QC Approver Actions — Only show if status is WAITING_REVIEW and user hasn't approved yet */}
                      {assign.status === 'WAITING_REVIEW' && (() => {
                        const alreadyApproved =
                          (isLeader && assign.lead_approved === 1) ||
                          (isMentor && assign.mentor_approved === 1) ||
                          (isCoordinator && assign.coordinator_approved === 1);

                        if (alreadyApproved) {
                          return (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-2">
                              <span>✓ Anda telah memberikan persetujuan (QC). Menunggu reviewer lain.</span>
                            </div>
                          );
                        }

                        if (!isLeader && !isMentor && !isCoordinator) return null;

                        return (
                          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/60 mt-2">
                            <p className="text-[9px] font-black text-zinc-500 dark:text-zinc-400">
                              Persetujuan QC (Anda sebagai:{' '}
                              {[
                                isLeader ? 'Ketua Tim' : '',
                                isMentor ? 'Mentor' : '',
                                isCoordinator ? 'Koordinator' : '',
                              ]
                                .filter(Boolean)
                                .join(', ')}
                              )
                            </p>

                            <ReviewActions
                              assignmentId={assign.id}
                              canRequestRevision={isLeader || isMentor || isCoordinator}
                              canAwardBadge={isMentor || isCoordinator}
                            />
                          </div>
                        );
                      })()}

                      {/* Edit Sparks Control (for Leader, Mentor, Coordinator) */}
                      {(isLeader || isMentor || isCoordinator) && ['WAITING_REVIEW', 'APPROVED', 'DONE', 'PUBLISHED'].includes(assign.status) && (
                        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            ✨ Sparks: <strong>{assign.sparks || 0} Poin</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingSparksAssignId(assign.id)}
                            className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 active:scale-95 transition-all shadow-sm flex items-center gap-1"
                          >
                            <span>✏️</span> Ubah Sparks
                          </button>

                          {editingSparksAssignId === assign.id && (
                            <EditSparksModal
                              assignmentId={assign.id}
                              assigneeName={assign.user_name ?? 'Assignee'}
                              currentSparks={assign.sparks || 8}
                              isOpen={true}
                              onClose={() => setEditingSparksAssignId(null)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
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

  // Render normal assignments (for non-OJT / regular tasks)
  const renderNormalAssignments = () => {
    return (
      <div className="space-y-2">
        <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Assignments</p>
        {assignments.map((a) => {
          const isMe = a.user_id === currentUserId;
          const role = a.assignment_role;
          const status = statusColors[a.status] ?? statusColors.DRAFT;

          return (
            <div
              key={a.id}
              className={`rounded-xl border p-3 space-y-2 text-xs ${
                isMe
                  ? 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800'
                  : 'bg-zinc-50/50 dark:bg-zinc-900/20 border-zinc-100 dark:border-zinc-800/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border text-purple-600 bg-purple-500/10 border-purple-500/15">
                    {role}
                  </span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-bold">{a.user_name ?? 'Unknown'}</span>
                  {isMe && <span className="text-[9px] text-purple-600 dark:text-purple-400 font-black">(you)</span>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {getDeadlineBadge(a.deadline, ['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(a.status))}
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${status}`}>
                    {a.status.replace('_', ' ')}
                  </span>
                </div>
              </div>


              {a.revision_note && ['REVISION_REQUESTED', 'DECLINED'].includes(a.status) && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2 text-[10px] text-red-700 dark:text-red-400">
                  📝 {a.revision_note}
                </div>
              )}

              {a.result_url && (
                <a
                  href={a.result_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-500 hover:underline font-bold truncate"
                >
                  🔗 View result
                </a>
              )}

              {isMe && (
                <div className="space-y-2 pt-1">
                  {errorMap[a.id] && <p className="text-[10px] text-red-600 dark:text-red-400 font-bold">{errorMap[a.id]}</p>}

                  {a.status === 'ASSIGNED' && (
                    <button
                      type="button"
                      onClick={() => handleStartWork(a.id)}
                      disabled={loading === a.id}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all"
                    >
                      {loading === a.id ? 'Starting...' : '🚀 Start Work'}
                    </button>
                  )}

                  {['DRAFT', 'REVISION_REQUESTED', 'DECLINED', 'IN_PROGRESS'].includes(a.status) && (
                    <>
                      {showSubmitMap[a.id] ? (
                        <form onSubmit={(e) => handleSubmitResult(e, a.id)} className="flex gap-1.5">
                          <input
                            type="url"
                            value={urlInputs[a.id] ?? ''}
                            onChange={(e) => setUrlInputs((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            placeholder="Paste result link..."
                            required
                            className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-zinc-900 dark:text-zinc-100"
                          />
                          <button
                            type="submit"
                            disabled={loading === a.id}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all"
                          >
                            {loading === a.id ? '...' : 'Submit'}
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowSubmitMap((prev) => ({ ...prev, [a.id]: true }))}
                          className="w-full bg-purple-500/5 hover:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/15 font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all"
                        >
                          {a.status === 'REVISION_REQUESTED'
                            ? '📤 Resubmit Result'
                            : a.status === 'DECLINED'
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
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/60 mt-4">
      {/* Dynamic Render based on Task Type */}
      {isOjtTask ? renderOJTRundown() : renderNormalAssignments()}

      {/* Delete task action */}
      {canDelete && (
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900/60 mt-2">
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
