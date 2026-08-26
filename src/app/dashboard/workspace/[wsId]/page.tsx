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
import { getWorkspaceChats, WorkspaceChatMessage } from '@/modules/workspaces/chatActions';
import WorkspaceReadTracker from '../components/WorkspaceReadTracker';
import { AssessmentPanel } from './components/AssessmentPanel';
import EditWorkspaceModal from './components/EditWorkspaceModal';
import { repairAssessmentTaskStatuses } from '@/modules/workspaces/assessmentActions';
import { syncAndRepairTaskStatuses } from '@/modules/tasks/actions';


interface WorkspaceRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: string;
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
  start_at?: number | null;
  created_at: number;
  created_by?: string | null;
  task_type: string;
  parent_task_id: string | null;
  revision_note?: string | null;
  sparks?: number | null;
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
  ACTIVE: { label: 'Active', color: 'text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/15' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/15' },
  ARCHIVED: { label: 'Archived', color: 'text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800' },
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

  // Auto-repair any assessment tasks whose status was corrupted to WAITING_REVIEW by submissions
  await repairAssessmentTaskStatuses(db, wsId);
  await syncAndRepairTaskStatuses(db, wsId);

  // Fetch everything else IN PARALLEL — no sequential waterfall
  const [
    project,
    ojtCheck,
    { results: tasksRaw },
    { results: membersRaw },
    { results: usersRaw },
    chatMessages,
    ctx,
    { results: mentorsRaw },
    { results: memberAccountRolesRaw },
    projMentorCheck,
  ] = await Promise.all([
    db.prepare('SELECT id, name FROM projects WHERE id = ?').bind(projectId).first() as Promise<ProjectRow | null>,
    db.prepare("SELECT 1 FROM project_coordinators pc JOIN users u ON pc.user_id = u.id WHERE pc.project_id = ? AND u.user_type = 'OJT' LIMIT 1").bind(projectId).first(),
    db.prepare(`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.deadline, t.extended_deadline, t.start_at, t.created_at, t.task_type, t.parent_task_id, t.revision_note, t.sparks, t.sparks_multiplier, t.created_by, u.name as creator_name
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.workspace_id = ? AND t.status != 'DELETED'
      ORDER BY
        CASE WHEN t.deadline IS NULL THEN 1 ELSE 0 END ASC,
        t.deadline ASC,
        t.created_at ASC
    `).bind(wsId).all(),
    db.prepare(`
      SELECT wm.user_id as userId, u.name as userName, u.email as userEmail,
             wm.team_role as teamRole, u.user_type as userType, u.avatar_url as avatarUrl
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY wm.created_at ASC
    `).bind(wsId).all(),
    db.prepare(`
      SELECT u.id, u.name, u.email, u.user_type as userType,
             GROUP_CONCAT(DISTINCT r.name) AS roleNames,
             GROUP_CONCAT(DISTINCT r.id) AS roleIds
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.status = 'ACTIVE'
      GROUP BY u.id
      ORDER BY u.name ASC
    `).all(),
    getWorkspaceChats(wsId),
    getSessionContext(session.userId),
    db.prepare(`
      SELECT DISTINCT u.id, u.name, u.email
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.status = 'ACTIVE'
        AND (r.id = 'role_mentor_troopers' OR r.name = 'MENTOR TROOPERS')
      ORDER BY u.name ASC
    `).all(),
    db.prepare(`
      SELECT ur.user_id as userId, r.id as roleId, r.name as roleName
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id IN (
        SELECT user_id FROM workspace_members WHERE workspace_id = ?
      )
    `).bind(wsId).all(),
    db.prepare('SELECT 1 FROM project_coordinators WHERE project_id = ? AND user_id = ? LIMIT 1').bind(projectId, session.userId).first(),
  ]);

  const isOjtWorkspace = ojtCheck !== null || workspace.ojt_coordinator_id !== null;
  const users = usersRaw as unknown as UserRow[];
  const activeUsers = usersRaw as unknown as { id: string; name: string; email: string }[];
  const members = (membersRaw as any[]);
  const mentors = mentorsRaw as unknown as { id: string; name: string; email: string }[];

  // SECURITY GATE & ACCESS CONTROL:
  // Workspace and its contents can ONLY be accessed by workspace members, designated workspace mentor, project mentor, task creator, or Coordinator/Admin
  const isCoordinatorUser =
    (ctx.userType === 'STAFF' &&
      (ctx.roles.includes('COORDINATOR') ||
        ctx.roles.includes('EXECUTIVE') ||
        ctx.can('MANAGE') ||
        ctx.can('WORKSPACE_MANAGE'))) ||
    ctx.can('SPARKS_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  const isWorkspaceMember = members.some((m) => m.userId === session.userId);
  const isProjectCoordinator = projMentorCheck !== null;
  const hasMentorRole = ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
  const isTaskCreatorInWs = (tasksRaw as unknown as TaskRow[]).some((t) => t.created_by === session.userId);

  const isDesignatedMentor =
    workspace.ojt_coordinator_id === session.userId ||
    hasMentorRole ||
    isProjectCoordinator ||
    isTaskCreatorInWs;

  if (!isWorkspaceMember && !isDesignatedMentor && !isCoordinatorUser) {
    redirect('/dashboard/workspace');
  }

  const isManagerUser = isCoordinatorUser || isDesignatedMentor;
  const now = Date.now();
  const allTasks = (tasksRaw as unknown as TaskRow[]).filter((t) => t.status !== 'DELETED');
  const tasks = isManagerUser
    ? allTasks
    : allTasks.filter((t) => {
      if (t.start_at && t.start_at > now) return false;
      if (t.task_type === 'ASSESSMENT' || workspace.workspace_type === 'ASSESSMENT') {
        return t.status === 'APPROVED';
      }
      return true;
    });

  // Fetch assignments & reactions when there are tasks
  const [{ results: assignmentsRaw }, { results: reactionsRaw }] = tasks.length > 0
    ? await Promise.all([
      db
        .prepare(`
            SELECT ta.id, ta.task_id, ta.user_id, ta.assignment_role,
                   ta.status, ta.result_url,
                   COALESCE(ta.revision_note, (SELECT note FROM workflow_events WHERE (entity_id = ta.id OR entity_id = ta.task_id) AND (to_status = 'REVISION_REQUESTED' OR to_status = 'REVISION') AND note IS NOT NULL AND note != '' ORDER BY created_at DESC LIMIT 1)) AS revision_note,
                   COALESCE(ta.appreciation_note, (SELECT note FROM workflow_events WHERE entity_id = ta.id AND to_status IN ('APPROVED', 'DONE', 'PUBLISHED') AND note IS NOT NULL AND note != '' AND note NOT LIKE 'Result submitted%' ORDER BY created_at DESC LIMIT 1)) AS appreciation_note,
                   ta.submitted_at,
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

  // Build account roles map: userId → role names[]
  const memberAccountRolesMap: Record<string, string[]> = {};
  for (const ar of (memberAccountRolesRaw as any[])) {
    if (!memberAccountRolesMap[ar.userId]) memberAccountRolesMap[ar.userId] = [];
    memberAccountRolesMap[ar.userId].push(ar.roleName as string);
  }

  // Identify mentor user IDs (leaders, coordinators, staff, or mentor role holders)
  const mentorUserIds = new Set<string>();
  if (workspace.ojt_coordinator_id) mentorUserIds.add(workspace.ojt_coordinator_id);
  for (const m of (membersRaw as any[])) {
    if (m.teamRole === 'LEADER') mentorUserIds.add(m.userId);
  }
  for (const [uId, rNames] of Object.entries(memberAccountRolesMap)) {
    if (rNames.some((r) => r.toUpperCase().includes('MENTOR'))) {
      mentorUserIds.add(uId);
    }
  }

  // Filter out any mentor assignments for assessment tasks/workspaces
  const assessmentTaskIds = new Set(
    tasks.filter((t) => t.task_type === 'ASSESSMENT' || workspace.workspace_type === 'ASSESSMENT').map((t) => t.id)
  );

  const assignments = (assignmentsRaw as unknown as AssignmentRow[]).filter((a) => {
    if (assessmentTaskIds.has(a.task_id) && mentorUserIds.has(a.user_id)) {
      return false;
    }
    return true;
  });

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

  // Group workspace team-roles by user and merge account roles + userType
  const membersMap: Record<string, { userId: string; userName: string | null; userEmail: string; userType: string; avatarUrl?: string | null; accountRoles: string[]; teamRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[] }> = {};
  for (const m of (membersRaw as any[])) {
    if (!membersMap[m.userId]) {
      membersMap[m.userId] = {
        userId: m.userId,
        userName: m.userName,
        userEmail: m.userEmail,
        userType: (m.userType as string) ?? 'STAFF',
        avatarUrl: m.avatarUrl ?? null,
        accountRoles: memberAccountRolesMap[m.userId] ?? [],
        teamRoles: [],
      };
    }
    membersMap[m.userId].teamRoles.push(m.teamRole);
  }
  const membersList = Object.values(membersMap) as any[];

  // Compute roles for the current user
  const currentUserRoles: string[] = membersList.find((m) => m.userId === session.userId)?.teamRoles ?? [];
  const isMentor = isDesignatedMentor || hasMentorRole;
  const isLeader = currentUserRoles.includes('LEADER') || isMentor;
  const isCoordinator = isCoordinatorUser;
  const isOJT = ctx.userType === 'OJT' && !hasMentorRole;

  // Batch-resolve all permissions in ONE synchronous call (no extra DB/KV round-trips)
  const { canCreateTask, canAssignTask, canDeleteTask, canUpdateWs, canManageMembers } =
    resolveWorkspacePermissions(ctx, workspace.ojt_coordinator_id, currentUserRoles, session.userId, workspace.workspace_type, isProjectCoordinator, isTaskCreatorInWs);

  const wsCfg = wsStatusConfig[workspace.status] ?? wsStatusConfig.ACTIVE;

  // Compile subset of tasks for prerequisite selection
  const existingTasks = tasks.map((t) => ({ id: t.id, title: t.title }));

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

          {/* Workspace controls: Edit & Status */}
          <div className="flex flex-wrap items-center sm:flex-col sm:items-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
            {canUpdateWs && (
              <EditWorkspaceModal
                workspaceId={wsId}
                initialName={workspace.name}
                initialDescription={workspace.description}
                initialMentorId={workspace.ojt_coordinator_id}
                initialType={workspace.workspace_type as any}
                mentors={mentors}
                isAssessment={workspace.workspace_type === 'ASSESSMENT'}
              />
            )}
            {canUpdateWs && workspace.status === 'ACTIVE' && (
              <WorkspaceStatusForm workspaceId={wsId} currentStatus={workspace.status} />
            )}
          </div>
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
              allWorkspaceMembers={activeUsers as any}
            />
          ) : (
            <LiveTaskAccordion
              workspaceId={wsId}
              workspaceType={workspace.workspace_type}
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
            currentUserRole={members.find((m) => m.userId === session.userId)?.teamRole || ctx.roles?.[0] || null}
            currentUserType={ctx.userType}
            initialMessages={chatMessages}
            canDeleteAny={ctx.can('DELETE')}
            members={membersList.map((m: any) => ({
              id: m.userId || m.id || '',
              name: m.userName || m.name || 'Anggota',
              avatar_url: m.avatar_url || m.avatarUrl || null,
              role: m.teamRole || m.role || null,
            }))}
          />
        }
        membersTab={
          <TeamMemberPanel
            workspaceId={wsId}
            members={membersList}
            canManageMembers={canManageMembers}
            isMentor={isMentor}
            ojtUsers={activeUsers}
            isAssessment={workspace.workspace_type === 'ASSESSMENT'}
            mentorId={workspace.ojt_coordinator_id}
          />
        }
        createTaskForm={
          workspace.workspace_type !== 'ASSESSMENT' && canCreateTask ? (
            <CreateTaskForm workspaceId={wsId} existingTasks={existingTasks} members={membersList} />
          ) : undefined
        }
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
