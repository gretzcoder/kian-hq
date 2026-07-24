import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionContext } from '@/modules/roles/rbac';
import TaskActions from '@/modules/tasks/components/TaskActions';
import WorkspaceStatusForm from './components/WorkspaceStatusForm';
import TaskAssignmentPanel from './components/TaskAssignmentPanel';
import CreateTaskForm from './components/CreateTaskForm';

interface WorkspaceRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: number | null;
  created_at: number;
  creator_name: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: number | null;
  created_at: number;
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
  params: Promise<{ id: string; wsId: string }>;
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  TODO:        { label: 'Todo',        color: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',        dot: 'bg-zinc-400' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/15',                      dot: 'bg-blue-500' },
  SUBMITTED:   { label: 'Submitted',   color: 'text-orange-600 dark:text-orange-400 bg-orange-500/5 border-orange-500/15',              dot: 'bg-orange-500' },
  IN_REVIEW:   { label: 'In Review',   color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/5 border-yellow-500/15',              dot: 'bg-yellow-500' },
  REVISION:    { label: 'Revision',    color: 'text-red-600 dark:text-red-400 bg-red-500/5 border-red-500/15',                          dot: 'bg-red-500' },
  APPROVED:    { label: 'Approved',    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/15',          dot: 'bg-emerald-500' },
  DONE:        { label: 'Done',        color: 'text-purple-600 dark:text-purple-400 bg-purple-500/5 border-purple-500/15',              dot: 'bg-purple-500' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW:    { label: 'Low',    color: 'text-zinc-400' },
  NORMAL: { label: 'Normal', color: 'text-zinc-500' },
  HIGH:   { label: 'High',   color: 'text-orange-500' },
  URGENT: { label: 'Urgent', color: 'text-red-500 font-black' },
};

const wsStatusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: 'Active',     color: 'text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/15' },
  COMPLETED: { label: 'Completed',  color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/15' },
  ARCHIVED:  { label: 'Archived',   color: 'text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800' },
};

export default async function WorkspaceDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/');

  const { id: projectId, wsId } = await params;
  const db = await getDB();

  // Fetch workspace
  const workspace = await db
    .prepare(`
      SELECT ws.*, u.name as creator_name
      FROM workspaces ws
      LEFT JOIN users u ON ws.created_by = u.id
      WHERE ws.id = ? AND ws.project_id = ?
    `)
    .bind(wsId, projectId)
    .first() as WorkspaceRow | null;

  if (!workspace) notFound();

  // Fetch project for breadcrumb
  const project = await db
    .prepare('SELECT id, name FROM projects WHERE id = ?')
    .bind(projectId)
    .first() as ProjectRow | null;

  // Fetch tasks in this workspace
  const { results: tasksRaw } = await db
    .prepare(`
      SELECT id, title, description, status, priority, deadline, created_at
      FROM tasks
      WHERE workspace_id = ?
      ORDER BY
        CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END,
        created_at ASC
    `)
    .bind(wsId)
    .all();

  const tasks = tasksRaw as unknown as TaskRow[];

  // Fetch all assignments for all tasks in this workspace
  const { results: assignmentsRaw } = tasks.length > 0
    ? await db
        .prepare(`
          SELECT ta.id, ta.task_id, ta.user_id, ta.assignment_role,
                 ta.status, ta.result_url, ta.revision_note, ta.submitted_at,
                 u.name as user_name
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

  // Fetch all users for assignment dropdown
  const { results: usersRaw } = await db
    .prepare('SELECT id, name FROM users ORDER BY name ASC')
    .all();
  const users = usersRaw as unknown as UserRow[];

  // Permissions
  const ctx = await getSessionContext(session.userId);
  const canCreateTask  = ctx.can('CREATE_TASK');
  const canAssignTask  = ctx.can('ASSIGN_TASK');
  const canDeleteTask  = ctx.can('DELETE');
  const canUpdateWs    = ctx.can('UPDATE_WORKSPACE');

  const wsCfg = wsStatusConfig[workspace.status] ?? wsStatusConfig.ACTIVE;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
        <Link href="/dashboard/projects" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
          Projects
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">›</span>
        <Link href={`/dashboard/projects/${projectId}`} className="hover:text-zinc-900 dark:hover:text-white transition-colors">
          {project?.name ?? projectId}
        </Link>
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
              {workspace.deadline && (
                <span>📅 Due: {new Date(workspace.deadline).toLocaleDateString()}</span>
              )}
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

      {/* Task Flow Guide */}
      <div className="flex items-center gap-1 overflow-x-auto py-1 flex-wrap gap-y-2">
        {['TODO', 'IN_PROGRESS', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'DONE'].map((s, i, arr) => {
          const cfg = statusConfig[s];
          return (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.color}`}>
                {cfg.label}
              </span>
              {i < arr.length - 1 && (
                <span className="text-zinc-300 dark:text-zinc-700 text-xs">→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Task List */}
      <div className="space-y-5">
        {tasks.length === 0 ? (
          <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-zinc-500 font-bold dark:text-zinc-400">No tasks yet in this workspace.</p>
            {canCreateTask && (
              <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">Use the form below to create the first task.</p>
            )}
          </div>
        ) : (
          tasks.map((task) => {
            const taskAssignments = assignmentsByTask[task.id] ?? [];
            const cfg = statusConfig[task.status] ?? statusConfig.TODO;
            const pCfg = priorityConfig[task.priority] ?? priorityConfig.NORMAL;

            return (
              <div
                key={task.id}
                className={`border bg-white dark:bg-[#09090b]/40 rounded-3xl shadow-sm overflow-hidden transition-all duration-200 ${
                  task.status === 'REVISION'
                    ? 'border-red-500/20 dark:border-red-500/20'
                    : task.status === 'IN_REVIEW'
                    ? 'border-yellow-500/15 dark:border-yellow-500/15'
                    : 'border-zinc-200/80 dark:border-zinc-800/80'
                }`}
              >
                {/* Task Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${pCfg.color}`}>
                          {pCfg.label}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{task.title}</h3>
                      {task.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{task.description}</p>
                      )}
                    </div>
                    {task.deadline && (
                      <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                        📅 {new Date(task.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Assignments + Actions */}
                  <TaskActions
                    taskId={task.id}
                    assignments={taskAssignments}
                    currentUserId={session.userId}
                    canDelete={canDeleteTask}
                  />
                </div>

                {/* Assignment Panel — COORDINATOR only */}
                {canAssignTask && (
                  <div className="border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 px-5 py-4">
                    <TaskAssignmentPanel
                      taskId={task.id}
                      existingAssignments={taskAssignments}
                      users={users}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Task Form — COORDINATOR only */}
      {canCreateTask && (
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-1 text-zinc-900 dark:text-zinc-100">Create Task</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-5">Add a new task to this workspace.</p>
          <CreateTaskForm workspaceId={wsId} />
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
