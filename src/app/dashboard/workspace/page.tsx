import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/modules/roles/rbac';
import Link from 'next/link';

interface AssignmentRow {
  assignment_id:   string;
  assignment_role: string;
  assignment_status: string;
  result_url:      string | null;
  revision_note:   string | null;
  task_id:         string;
  task_title:      string;
  task_deadline:   number | null;
  task_priority:   string;
  workspace_id:    string | null;
  workspace_name:  string | null;
  project_id:      string;
  project_name:    string;
}

const statusColors: Record<string, string> = {
  ASSIGNED:           'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
  IN_PROGRESS:        'bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/15',
  SUBMITTED:          'bg-orange-500/5 text-orange-600 dark:text-orange-400 border-orange-500/15',
  WAITING_REVIEW:     'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/15',
  REVISION_REQUESTED: 'bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/15',
  RESUBMITTED:        'bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/15',
  APPROVED:           'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/15',
  DECLINED:           'bg-red-800/10 text-red-800 dark:text-red-500 border-red-800/20',
};

const roleColors: Record<string, { text: string; bg: string }> = {
  RESEARCHER: { text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/15' },
  PLANNER:    { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/15' },
  CREATOR:    { text: 'text-pink-700 dark:text-pink-400', bg: 'bg-pink-500/10 border-pink-500/15' },
  PIC:        { text: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-500/10 border-purple-500/15' },
  REVIEWER:   { text: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/15' },
  HELPER:     { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/15' },
  APPROVER:   { text: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/15' },
};

const priorityColors: Record<string, string> = {
  LOW:    'text-zinc-400',
  NORMAL: 'text-zinc-500',
  HIGH:   'text-orange-500',
  URGENT: 'text-red-500 font-black',
};

export default async function WorkspacePage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);
  const db  = await getDB();

  // 1. Fetch workspaces where user is a member or coordinator
  const { results: rawWorkspaces } = await db.prepare(`
    SELECT DISTINCT ws.id, ws.name, ws.description, ws.status, ws.deadline, ws.project_id, p.name AS project_name
    FROM workspaces ws
    JOIN projects p ON ws.project_id = p.id
    LEFT JOIN workspace_members wm ON ws.id = wm.workspace_id
    WHERE wm.user_id = ? OR ws.ojt_coordinator_id = ?
    ORDER BY ws.created_at DESC
  `).bind(session.userId, session.userId).all();

  const userWorkspaces = rawWorkspaces as unknown as {
    id: string;
    name: string;
    description: string | null;
    status: string;
    deadline: number | null;
    project_id: string;
    project_name: string;
  }[];

  // 2. All active assignments for the current user
  const { results: rawAssignments } = await db.prepare(`
    SELECT
      ta.id            AS assignment_id,
      ta.assignment_role,
      ta.status        AS assignment_status,
      ta.result_url,
      ta.revision_note,
      t.id             AS task_id,
      t.title          AS task_title,
      t.deadline       AS task_deadline,
      t.priority       AS task_priority,
      t.workspace_id,
      ws.name          AS workspace_name,
      t.project_id,
      p.name           AS project_name
    FROM task_assignments ta
    JOIN tasks t      ON ta.task_id = t.id
    JOIN projects p   ON t.project_id = p.id
    LEFT JOIN workspaces ws ON t.workspace_id = ws.id
    WHERE ta.user_id = ? AND ta.status NOT IN ('APPROVED', 'DONE', 'LOCKED', 'PUBLISHED', 'ARCHIVED')
    ORDER BY
      CASE ta.status
        WHEN 'REVISION_REQUESTED' THEN 1
        WHEN 'DECLINED'           THEN 2
        WHEN 'WAITING_REVIEW'     THEN 3
        WHEN 'IN_PROGRESS'        THEN 4
        WHEN 'ASSIGNED'           THEN 5
        ELSE 6
      END,
      t.deadline ASC NULLS LAST
  `).bind(session.userId).all();

  const assignments = rawAssignments as unknown as AssignmentRow[];

  // Fetch projects where user is the mentor (ojt_coordinator_id)
  const { results: rawMentoredProjects } = await db.prepare(`
    SELECT id, name, description, status, deadline
    FROM projects
    WHERE ojt_coordinator_id = ?
    ORDER BY created_at DESC
  `).bind(session.userId).all();

  const mentoredProjects = rawMentoredProjects as unknown as {
    id: string;
    name: string;
    description: string | null;
    status: string;
    deadline: number | null;
  }[];

  // Group assignments by workspace
  const grouped: Record<string, { workspaceName: string; projectName: string; projectId: string; workspaceId: string | null; items: AssignmentRow[] }> = {};
  for (const a of assignments) {
    const key = a.workspace_id ?? a.project_id;
    if (!grouped[key]) {
      grouped[key] = {
        workspaceName: a.workspace_name ?? a.project_name,
        projectName:   a.project_name,
        projectId:     a.project_id,
        workspaceId:   a.workspace_id,
        items:         [],
      };
    }
    grouped[key].items.push(a);
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            My Workspace Console
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Access your team campaigns, view progress rundowns, and manage assigned task steps.
          </p>
        </div>
      </div>

      {/* Mentored Projects Section (for OJT mentors) */}
      {mentoredProjects.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Campaigns & Projects I Mentor</h2>
            <span className="text-xs text-zinc-400 font-mono font-bold">
              {mentoredProjects.length} project{mentoredProjects.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {mentoredProjects.map((p) => (
              <div
                key={p.id}
                className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between hover:shadow-md shadow-sm hover:-translate-y-0.5 group"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block mb-1">
                    Mentor Role
                  </span>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  )}
                </div>
                <div className="mt-8 pt-3 border-t border-zinc-100 dark:border-zinc-900/60 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/5 px-2.5 py-1 rounded-full border border-blue-500/10">
                    {p.status}
                  </span>
                  <Link
                    href={`/dashboard/projects/${p.id}`}
                    className="text-xs border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900/50 transition-all font-bold active:scale-[0.98] shadow-sm"
                  >
                    Manage Project &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workspaces List Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Active Teams & Workspaces</h2>
          <span className="text-xs text-zinc-400 font-mono font-bold">
            {userWorkspaces.length} workspace{userWorkspaces.length !== 1 ? 's' : ''}
          </span>
        </div>
        {userWorkspaces.length === 0 ? (
          <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-12 text-center text-zinc-400 text-xs font-bold leading-normal">
            📋 You are not assigned to any OJT workspaces yet.<br />
            Ask your Mentor to invite you.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {userWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between hover:shadow-md shadow-sm hover:-translate-y-0.5 group"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block mb-1">
                    {ws.project_name}
                  </span>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {ws.name}
                  </h3>
                  {ws.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                      {ws.description}
                    </p>
                  )}
                </div>
                <div className="mt-8 pt-3 border-t border-zinc-100 dark:border-zinc-900/60 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/5 px-2.5 py-1 rounded-full border border-blue-500/10">
                    {ws.status}
                  </span>
                  <Link
                    href={`/dashboard/workspace/${ws.id}`}
                    className="text-xs border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900/50 transition-all font-bold active:scale-[0.98] shadow-sm"
                  >
                    Open Console &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assignments List Section */}
      <div className="space-y-4 pt-6 border-t border-zinc-200 dark:border-zinc-800/80">
        <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">My Active Task Steps</h2>
        {assignments.length === 0 ? (
          <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
            <p className="text-3xl mb-3">🎉</p>
            <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm">No active tasks assigned to you right now.</p>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">Open your workspace console to see the team timeline and create new rundown items.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([key, group]) => (
              <div key={key} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                      {group.projectName}
                    </span>
                    {group.workspaceName !== group.projectName && (
                      <>
                        <span className="text-zinc-300 dark:text-zinc-700">›</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-bold">
                          {group.workspaceName}
                        </span>
                      </>
                    )}
                  </div>
                  <Link
                    href={group.workspaceId
                      ? `/dashboard/workspace/${group.workspaceId}`
                      : `/dashboard/projects/${group.projectId}`}
                    className="text-[10px] font-bold text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    Go to Workspace &rarr;
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.items.map((a) => {
                    const role = roleColors[a.assignment_role] ?? { text: 'text-zinc-500', bg: 'bg-zinc-100 border-zinc-200' };
                    return (
                      <div
                        key={a.assignment_id}
                        className={`border bg-white dark:bg-[#09090b]/40 rounded-3xl p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
                          ['REVISION_REQUESTED', 'DECLINED'].includes(a.assignment_status)
                            ? 'border-red-500/20 dark:border-red-500/20'
                            : 'border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">{a.task_title}</h3>
                            {a.task_deadline && (
                              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                Due: {new Date(a.task_deadline).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${role.bg} ${role.text}`}>
                              {a.assignment_role}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusColors[a.assignment_status] ?? statusColors.ASSIGNED}`}>
                              {a.assignment_status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {a.revision_note && ['REVISION_REQUESTED', 'DECLINED'].includes(a.assignment_status) && (
                          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 mb-3 text-xs text-red-700 dark:text-red-400">
                            <p className="font-bold uppercase tracking-wide text-[9px] mb-1">Catatan Revisi:</p>
                            <p>{a.revision_note}</p>
                          </div>
                        )}

                        {a.result_url && (
                          <div className="mb-3">
                            <a
                              href={a.result_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-500 font-bold underline truncate block"
                            >
                              🔗 Buka Link Google Drive
                            </a>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${priorityColors[a.task_priority] ?? priorityColors.NORMAL}`}>
                            {a.task_priority} priority
                          </span>
                          <Link
                            href={group.workspaceId
                              ? `/dashboard/workspace/${group.workspaceId}`
                              : `/dashboard/projects/${group.projectId}`}
                            className="text-[11px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900/50 px-3.5 py-1.5 rounded-lg transition-all font-bold"
                          >
                            Open Console &rarr;
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
