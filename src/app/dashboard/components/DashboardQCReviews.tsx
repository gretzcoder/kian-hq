import ReviewActions from '../review/components/ReviewActions';
import { SubmittedLinkPreviewer } from '@/components/editor/SubmittedLinkPreviewer';

export interface QCReviewItem {
  assignment_id: string;
  assignment_role: string;
  result_url: string | null;
  submitted_at: number | null;
  lead_approved: number;
  mentor_approved: number;
  coordinator_approved: number;
  task_id: string;
  task_title: string;
  task_priority: string;
  task_type?: string | null;
  task_created_by?: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  project_id: string;
  project_name: string;
  creator_name: string | null;
}

interface DashboardQCReviewsProps {
  pendingQCReviews: QCReviewItem[];
  currentUserId?: string;
}

export default function DashboardQCReviews({ pendingQCReviews, currentUserId }: DashboardQCReviewsProps) {
  if (pendingQCReviews.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>QC Reviews Pending My Approval</span>
            <span className="text-xs bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
              {pendingQCReviews.length} item{pendingQCReviews.length !== 1 ? 's' : ''}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Hasil kerja intern yang memerlukan persetujuan QC Anda.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pendingQCReviews.map((r) => (
          <div
            key={r.assignment_id}
            className="border border-yellow-500/20 dark:border-yellow-500/20 bg-yellow-500/[0.02] dark:bg-[#09090b]/60 rounded-3xl p-5 shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                    {r.project_name}
                  </span>
                  {r.workspace_name && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">›</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        {r.workspace_name}
                      </span>
                    </>
                  )}
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                  {r.task_title}
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Dikerjakan oleh:{' '}
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {r.creator_name ?? 'Unknown'}
                  </span>
                </p>
              </div>
              <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full border text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/15 shrink-0 font-bold">
                {r.assignment_role}
              </span>
            </div>

            {r.result_url && (
              <SubmittedLinkPreviewer url={r.result_url} autoExpand={false} />
            )}

            <ReviewActions
              assignmentId={r.assignment_id}
              canRequestRevision={true}
              taskType={r.task_type}
              isAssessmentMentorStep={r.task_type === 'ASSESSMENT' && r.task_created_by === currentUserId && r.mentor_approved === 0}
              creatorName={r.creator_name}
              isStaffOrCoord={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
