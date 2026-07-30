import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionContext, resolveWorkspacePermissions } from '@/modules/roles/rbac';
import WorkspaceStatusForm from './components/WorkspaceStatusForm';
import TeamMemberPanel from './components/TeamMemberPanel';
import CreateTaskForm from './components/CreateTaskForm';
import TaskAccordion from './components/TaskAccordion';
import WorkspaceTabs from './components/WorkspaceTabs';
import { WorkspaceChatRoom } from './components/WorkspaceChatRoom';
import { WorkspaceChatMessage } from '@/modules/workspaces/chatActions';


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
      SELECT ws.*, u.name as creator_name
      FROM workspaces ws
      LEFT JOIN users u ON ws.created_by = u.id
      WHERE ws.id = ?
    `)
    .bind(wsId)
    .first() as WorkspaceRow | null;

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
      WHERE workspace_id = ?
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
    const isMentor = workspace.ojt_coordinator_id === session.userId || ojtCheck !== null;
    if (!isMember && !isMentor) {
      redirect('/dashboard');
    }
  }

  // Fetch assignments only when there are tasks (depends on tasks result above)
  const { results: assignmentsRaw } = tasks.length > 0
    ? await db
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
        .all()
    : { results: [] };


  const assignments = assignmentsRaw as unknown as AssignmentRow[];

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

  // Compute roles for the current user (from already-fetched member data — no extra DB call)
  const currentUserRoles: string[] = membersList.find((m) => m.userId === session.userId)?.teamRoles ?? [];
  const isLeader = currentUserRoles.includes('LEADER');
  const isMentor = workspace.ojt_coordinator_id === session.userId;
  const isCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));

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
              {workspace.creator_name && (
                <span>👤 Created by: {workspace.creator_name}</span>
              )}
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
        tasksTab={
          tasks.length === 0 ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center bg-white dark:bg-transparent">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-zinc-500 font-bold dark:text-zinc-400">
                Belum ada tugas di workspace ini.
              </p>
              {canCreateTask && (
                <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">
                  Klik tombol "+ Buat Tugas" di atas untuk memulai penugasan.
                </p>
              )}
            </div>
          ) : (
            <TaskAccordion
              tasks={tasks}
              assignmentsByTask={assignmentsByTask}
              currentUserId={session.userId}
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
          canCreateTask ? (
            <CreateTaskForm workspaceId={wsId} existingTasks={existingTasks} />
          ) : undefined
        }
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
