import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionContext, resolveWorkspacePermissions } from '@/modules/roles/rbac';
import WorkspaceStatusForm from './components/WorkspaceStatusForm';
import TeamMemberPanel from './components/TeamMemberPanel';
import CreateTaskForm from './components/CreateTaskForm';
import { LiveTaskAccordion } from './components/LiveTaskAccordion';
import WorkspaceTabs from './components/WorkspaceTabs';
import { WorkspaceChatRoom } from './components/WorkspaceChatRoom';
import { WorkspaceChatMessage } from '@/modules/workspaces/chatActions';
import WorkspaceReadTracker from '../components/WorkspaceReadTracker';
import { AssessmentPanel } from './components/AssessmentPanel';


interface WorkspaceRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: number | null;
  created_at: number;
  creator_name: string | null;
  ojt_coordinator_id: string | null;
  workspace_type: string; // TROOPERS | ASSESSMENT
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: number | null;
  created_at: number;
  task_type: string;
  parent_task_id: string | null;
}

interface AssignmentRow {
  id: string;
  task_id: string;
  user_id: string;
  assignment_role: string;
  status: string;
  result_url: string | null;
  revision_note: string | null;
  submitted_at: number | null;
  user_name: string | null;
}

interface UserRow {
  id: string;
  name: string;
}

interface ProjectRow {
  id: string;
  name: string;
}

interface PageProps {
  params: Promise<{ wsId: string }>;
}


const wsStatusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: 'Active',     color: 'text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/15' },
  COMPLETED: { label: 'Completed',  color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/15' },
  ARCHIVED:  { label: 'Archived',   color: 'text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800' },
};

export default async function WorkspaceDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/');

  const { wsId } = await params;
  const db = await getDB();

  // Fetch workspace first (needed for notFound() guard and to extract projectId)
  const workspace = await db
    .prepare(`
      SELECT ws.*, u.name as creator_name, m.name as mentor_name
      FROM workspaces ws
      LEFT JOIN users u ON ws.created_by = u.id
      LEFT JOIN users m ON ws.ojt_coordinator_id = m.id
      WHERE ws.id = ?
    `)
    .bind(wsId)
    .first() as (WorkspaceRow & { mentor_name?: string | null }) | null;

  if (!workspace) notFound();

  const projectId = workspace.project_id;

  // Fetch everything else IN PARALLEL — no sequential waterfall
  const [
    project,
    ojtCheck,
    { results: tasksRaw },
    { results: membersRaw },
    { results: usersRaw },
    { results: ojtUsersRaw },
    { results: chatMessagesRaw },
    ctx,
  ] = await Promise.all([
    db.prepare('SELECT id, name FROM projects WHERE id = ?').bind(projectId).first() as Promise<ProjectRow | null>,
    db.prepare("SELECT 1 FROM project_coordinators pc JOIN users u ON pc.user_id = u.id WHERE pc.project_id = ? AND u.user_type = 'OJT' LIMIT 1").bind(projectId).first(),
    db.prepare(`
      SELECT id, title, description, status, priority, deadline, created_at, task_type, parent_task_id
      FROM tasks
      WHERE workspace_id = ? AND status != 'DELETED'
      ORDER BY
        CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END,
        created_at ASC
    `).bind(wsId).all(),
    db.prepare(`
      SELECT wm.user_id as userId, u.name as userName, u.email as userEmail, wm.team_role as teamRole
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY wm.created_at ASC
    `).bind(wsId).all(),
    db.prepare('SELECT id, name FROM users ORDER BY name ASC').all(),
    db.prepare("SELECT id, name, email FROM users WHERE user_type = 'OJT' AND status = 'ACTIVE' ORDER BY email ASC").all(),
    db.prepare(`
      SELECT wc.id, wc.workspace_id, wc.user_id, wc.message, wc.created_at, u.name as user_name
      FROM workspace_chats wc
      LEFT JOIN users u ON wc.user_id = u.id
      WHERE wc.workspace_id = ?
      ORDER BY wc.created_at ASC
    `).bind(wsId).all(),
    getSessionContext(session.userId),
  ]);

  const isOjtWorkspace = ojtCheck !== null || workspace.ojt_coordinator_id !== null;
  const tasks = tasksRaw as unknown as TaskRow[];
  const users = usersRaw as unknown as UserRow[];
  const ojtUsers = ojtUsersRaw as unknown as { id: string; name: string; email: string }[];
  const members = (membersRaw as any[]);

  // SECURITY GATE: OJT interns must be a member or mentor of the workspace/project to view it
  if (ctx.userType === 'OJT') {
    const isMember = members.some((m) => m.userId === session.userId);
    const isMentor = workspace.ojt_coordinator_id === session.userId || ojtCheck !== null || ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
    if (!isMember && !isMentor) {
      redirect('/dashboard');
    }
  }

  // Fetch assignments & reactions when there are tasks
  const [{ results: assignmentsRaw }, { results: reactionsRaw }] = tasks.length > 0
    ? await Promise.all([
        db
          .prepare(`
            SELECT ta.id, ta.task_id, ta.user_id, ta.assignment_role,
                   ta.status, ta.result_url, ta.revision_note, ta.submitted_at,
                   ta.lead_approved, ta.mentor_approved, ta.coordinator_approved,
                   ta.sparks, ta.deadline, u.name as user_name
            FROM task_assignments ta
            LEFT JOIN users u ON ta.user_id = u.id
            WHERE ta.task_id IN (${tasks.map(() => '?').join(',')})
            ORDER BY ta.created_at ASC
          `)
          .bind(...tasks.map((t) => t.id))
          .all(),

        db
          .prepare(`
            SELECT r.assignment_id, r.emoji, COUNT(*) as count,
                   MAX(CASE WHEN r.user_id = ? THEN 1 ELSE 0 END) as user_reacted
            FROM assessment_submission_reactions r
            JOIN task_assignments ta ON r.assignment_id = ta.id
            WHERE ta.task_id IN (${tasks.map(() => '?').join(',')})
            GROUP BY r.assignment_id, r.emoji
          `)
          .bind(session.userId, ...tasks.map((t) => t.id))
          .all(),
      ])
    : [{ results: [] }, { results: [] }];

  const assignments = assignmentsRaw as unknown as AssignmentRow[];
  const reactionsMap: Record<string, { emoji: string; count: number; user_reacted: number }[]> = {};
  for (const r of (reactionsRaw as any[])) {
    if (!reactionsMap[r.assignment_id]) reactionsMap[r.assignment_id] = [];
    reactionsMap[r.assignment_id].push({
      emoji: r.emoji,
      count: Number(r.count),
      user_reacted: Number(r.user_reacted),
    });
  }

  // Group assignments by task_id
  const assignmentsByTask: Record<string, AssignmentRow[]> = {};
  for (const a of assignments) {
    if (!assignmentsByTask[a.task_id]) assignmentsByTask[a.task_id] = [];
    assignmentsByTask[a.task_id].push(a);
  }

  // Group roles by user to support multiple roles
  const membersMap: Record<string, { userId: string; userName: string | null; userEmail: string; teamRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[] }> = {};
  for (const m of (membersRaw as any[])) {
    if (!membersMap[m.userId]) {
      membersMap[m.userId] = {
        userId: m.userId,
        userName: m.userName,
        userEmail: m.userEmail,
        teamRoles: [],
      };
    }
    membersMap[m.userId].teamRoles.push(m.teamRole);
  }
  const membersList = Object.values(membersMap) as any[];

  // Compute roles for the current user
  const currentUserRoles: string[] = membersList.find((m) => m.userId === session.userId)?.teamRoles ?? [];
  const isAssessmentWs = workspace.workspace_type === 'ASSESSMENT';
  const hasMentorRole = isAssessmentWs && ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
  const isLeader = currentUserRoles.includes('LEADER') || hasMentorRole;
  const isMentor = workspace.ojt_coordinator_id === session.userId || hasMentorRole;
  const isCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));

  // Batch-resolve all permissions in ONE synchronous call (no extra DB/KV round-trips)
  const { canCreateTask, canAssignTask, canDeleteTask, canUpdateWs, canManageMembers } =
    resolveWorkspacePermissions(ctx, workspace.ojt_coordinator_id, currentUserRoles, session.userId);

  const isOJT = ctx.userType === 'OJT';

  const wsCfg = wsStatusConfig[workspace.status] ?? wsStatusConfig.ACTIVE;

  // Compile subset of tasks for prerequisite selection
  const existingTasks = tasks.map((t) => ({ id: t.id, title: t.title }));

  const chatMessages = chatMessagesRaw as unknown as WorkspaceChatMessage[];

  return (
    <div className="space-y-8">
      <WorkspaceReadTracker wsId={wsId} />
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
        {isOJT ? (
          <>
            <span>Projects</span>
            <span className="text-zinc-300 dark:text-zinc-700">›</span>
            <span>{project?.name ?? projectId}</span>
          </>
        ) : (
          <>
            <Link href="/dashboard/projects" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Projects
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">›</span>
            <Link href={`/dashboard/projects/${projectId}`} className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              {project?.name ?? projectId}
            </Link>
          </>
        )}
        <span className="text-zinc-300 dark:text-zinc-700">›</span>
        <span className="text-zinc-900 dark:text-white">{workspace.name}</span>
      </div>

      {/* Workspace Header Card */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-600 dark:from-white dark:via-zinc-200 dark:to-zinc-400 bg-clip-text text-transparent">
                {workspace.name}
              </h1>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${wsCfg.color}`}>
                {wsCfg.label}
              </span>
            </div>
            {workspace.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
                {workspace.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">
              {workspace.mentor_name ? (
                <span className="text-purple-600 dark:text-purple-400 font-black">🎓 Mentor: {workspace.mentor_name}</span>
              ) : workspace.creator_name ? (
                <span>👤 Created by: {workspace.creator_name}</span>
              ) : null}
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Workspace status controls */}
          {canUpdateWs && workspace.status === 'ACTIVE' && (
            <WorkspaceStatusForm workspaceId={wsId} currentStatus={workspace.status} />
          )}
        </div>
      </div>

      {/* Workspace Tabs Container */}
      <WorkspaceTabs
        tasksCount={tasks.length}
        membersCount={membersList.length}
        chatMessagesCount={chatMessages.length}
        isAssessment={workspace.workspace_type === 'ASSESSMENT'}
        tasksTab={
          workspace.workspace_type === 'ASSESSMENT' ? (
            <AssessmentPanel
              workspaceId={wsId}
              tasks={tasks as any}
              assignmentsByTask={assignmentsByTask as any}
              reactionsMap={reactionsMap}
              currentUserId={session.userId}
              isLeader={isLeader}
              isCoordinator={isCoordinator}
              isOJT={isOJT}
            />
          ) : (
            <LiveTaskAccordion
              workspaceId={wsId}
              initialTasks={tasks as any}
              initialAssignmentsByTask={assignmentsByTask as any}
              currentUserId={session.userId}
              canCreateTask={canCreateTask}
              canDeleteTask={canDeleteTask}
              canAssignTask={canAssignTask}
              isLeader={isLeader}
              isMentor={isMentor}
              isCoordinator={isCoordinator}
              isOjtWorkspace={isOjtWorkspace}
              users={users}
              members={members}
            />
          )
        }
        chatTab={
          <WorkspaceChatRoom
            workspaceId={wsId}
            currentUserId={session.userId}
            initialMessages={chatMessages}
            canDeleteAny={ctx.can('DELETE')}
          />
        }
        membersTab={
          <TeamMemberPanel
            workspaceId={wsId}
            members={membersList}
            canManageMembers={canManageMembers}
            isMentor={isMentor}
            ojtUsers={ojtUsers}
          />
        }
        createTaskForm={
          workspace.workspace_type !== 'ASSESSMENT' && canCreateTask ? (
            <CreateTaskForm workspaceId={wsId} existingTasks={existingTasks} />
          ) : undefined
        }
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
