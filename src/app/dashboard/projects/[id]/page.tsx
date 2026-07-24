import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { deleteProject, publishProject, archiveProject } from '@/modules/projects/actions';
import ProjectTabs from '@/modules/projects/components/ProjectTabs';
import CreateWorkspaceForm from './components/CreateWorkspaceForm';

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  gdrive_folder_id: string | null;
  status: string;
  deadline: number | null;
  created_at: number;
}

interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: number | null;
  task_count: number;
}

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  gdrive_asset_url: string | null;
  status: string;
  assigned_to: string | null;
  created_by: string;
  deadline: number | null;
  assigned_name: string | null;
  assigned_email: string | null;
  creator_name: string | null;
}

interface UserRow {
  id: string;
  name: string;
}

interface BriefRow {
  id: string;
  audience: string | null;
  objectives: string | null;
  key_messages: string | null;
  visual_style: string | null;
  status: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// Project workflow — visual step bar
const PROJECT_FLOW = [
  { status: 'PLANNING',       label: 'Planning' },
  { status: 'IN_PROGRESS',    label: 'In Progress' },
  { status: 'IN_REVIEW',      label: 'In Review' },
  { status: 'PUBLISHED',      label: 'Published' },
  { status: 'ARCHIVED',       label: 'Archived' },
];

const projectStatusColors: Record<string, string> = {
  DRAFT:            'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',
  BRIEF_IN_REVIEW:  'text-yellow-600 dark:text-yellow-400 bg-yellow-500/5 border-yellow-500/15',
  PLANNING:         'text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/15',
  IN_PROGRESS:      'text-purple-600 dark:text-purple-400 bg-purple-500/5 border-purple-500/15',
  IN_REVIEW:        'text-orange-600 dark:text-orange-400 bg-orange-500/5 border-orange-500/15',
  PUBLISHED:        'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/15',
  ARCHIVED:         'text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800',
};

const wsStatusColors: Record<string, string> = {
  ACTIVE:    'text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/15',
  COMPLETED: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/15',
  ARCHIVED:  'text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800',
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/');

  const { id: projectId } = await params;
  const db = await getDB();

  // Fetch Project Details
  const project = await db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .bind(projectId)
    .first() as ProjectRow | null;

  if (!project) notFound();

  // Batch permissions
  const ctx = await getSessionContext(session.userId);
  const canCreateTask    = ctx.can('CREATE_TASK');
  const canApproveTask   = ctx.can('APPROVE');
  const canDeleteTask    = ctx.can('DELETE');
  const canDeleteProject = ctx.can('DELETE');
  const canEditBrief     = ctx.can('UPDATE_BRIEF');
  const canCreateWs      = ctx.can('CREATE_WORKSPACE');
  const canPublish       = ctx.can('PUBLISH_PROJECT');
  const canArchive       = ctx.can('ARCHIVE_PROJECT');

  // Fetch Workspaces for this project
  const { results: workspacesRaw } = await db
    .prepare(`
      SELECT ws.id, ws.name, ws.description, ws.status, ws.deadline,
             COUNT(t.id) as task_count
      FROM workspaces ws
      LEFT JOIN tasks t ON t.workspace_id = ws.id
      WHERE ws.project_id = ?
      GROUP BY ws.id
      ORDER BY ws.created_at ASC
    `)
    .bind(projectId)
    .all();
  const workspaces = workspacesRaw as unknown as WorkspaceRow[];

  // Fetch legacy tasks (not yet in a workspace)
  const { results: tasksRaw } = await db
    .prepare(`
      SELECT t.*, u.name as assigned_name, u.email as assigned_email, c.name as creator_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.project_id = ? AND (t.workspace_id IS NULL)
      ORDER BY t.created_at ASC
    `)
    .bind(projectId)
    .all();
  const tasks = tasksRaw as unknown as TaskRow[];

  // Users (for legacy task form)
  const { results: usersRaw } = await db
    .prepare('SELECT id, name FROM users ORDER BY name ASC')
    .all();
  const users = usersRaw as unknown as UserRow[];

  // Content Brief
  const brief = await db
    .prepare('SELECT id, audience, objectives, key_messages, visual_style, status FROM content_briefs WHERE project_id = ?')
    .bind(projectId)
    .first() as BriefRow | null;

  // Fetch unified timeline events (audit trail)
  const { results: eventsRaw } = await db.prepare(`
    SELECT we.id, we.entity_type, we.entity_id, we.from_status, we.to_status, we.note, we.created_at,
           u.name AS user_name
    FROM workflow_events we
    LEFT JOIN users u ON we.triggered_by = u.id
    WHERE (we.entity_type = 'project' AND we.entity_id = ?)
       OR (we.entity_type = 'brief' AND we.entity_id IN (SELECT id FROM content_briefs WHERE project_id = ?))
       OR (we.entity_type = 'workspace' AND we.entity_id IN (SELECT id FROM workspaces WHERE project_id = ?))
       OR (we.entity_type = 'task' AND we.entity_id IN (SELECT id FROM tasks WHERE project_id = ?))
       OR (we.entity_type = 'task_assignment' AND we.entity_id IN (
           SELECT ta.id FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE t.project_id = ?
       ))
    ORDER BY we.created_at DESC
  `).bind(projectId, projectId, projectId, projectId, projectId).all();
  const events = eventsRaw as any[];

  // Server Actions
  async function handleDeleteProject() {
    'use server';
    await deleteProject(projectId);
    redirect('/dashboard/projects');
  }

  async function handlePublish() {
    'use server';
    await publishProject(projectId);
  }

  async function handleArchive() {
    'use server';
    await archiveProject(projectId);
  }

  const statusColor = projectStatusColors[project.status] ?? projectStatusColors.PLANNING;

  // Determine which steps are complete/current/future
  const flowStatuses = PROJECT_FLOW.map((step) => step.status);
  const currentIdx = flowStatuses.indexOf(project.status);

  return (
    <div className="space-y-8">
      {/* Back + Controls */}
      <div className="flex justify-between items-center">
        <Link
          href="/dashboard/projects"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors font-bold flex items-center gap-1"
        >
          ← Back to Registry
        </Link>
        <div className="flex items-center gap-2">
          {canPublish && project.status === 'IN_REVIEW' && (
            <form action={handlePublish}>
              <button
                type="submit"
                className="text-xs font-bold border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl transition-all active:scale-[0.97]"
              >
                🚀 Publish
              </button>
            </form>
          )}
          {canArchive && ['PUBLISHED', 'IN_REVIEW'].includes(project.status) && (
            <form action={handleArchive}>
              <button
                type="submit"
                className="text-xs font-bold border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-4 py-2 rounded-xl transition-all active:scale-[0.97]"
              >
                Archive
              </button>
            </form>
          )}
          {canDeleteProject && (
            <form action={handleDeleteProject}>
              <button
                type="submit"
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-500 font-bold border border-red-500/10 hover:border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all active:scale-[0.97]"
              >
                Delete
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Project Banner */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-600 dark:from-white dark:via-zinc-200 dark:to-zinc-400 bg-clip-text text-transparent">
              {project.name}
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-wider mt-1.5 uppercase">ID: {project.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor}`}>
              {project.status.replace('_', ' ')}
            </span>
            {project.deadline && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Due: {new Date(project.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed max-w-3xl font-medium">
          {project.description || 'No description provided.'}
        </p>

        {project.gdrive_folder_id && (
          <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-900/60">
            <a
              href={project.gdrive_folder_id}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold bg-purple-500/5 hover:bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/10 dark:border-purple-500/20 px-4 py-2 rounded-xl transition-all active:scale-[0.97]"
            >
              📁 Open Storage Folder
            </a>
          </div>
        )}

        {/* Workflow Step Bar */}
        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-900/60">
          <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Workflow Progress</p>
          <div className="flex items-center gap-0">
            {PROJECT_FLOW.map((step, i) => {
              const isPast    = i < currentIdx;
              const isCurrent = i === currentIdx;
              const isFuture  = i > currentIdx;
              return (
                <div key={step.status} className="flex items-center flex-1 min-w-0">
                  <div className={`flex-1 relative ${i > 0 ? 'before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:w-full before:h-0.5 before:content-[""]' : ''} ${
                    isPast ? 'before:bg-purple-500' : 'before:bg-zinc-200 dark:before:bg-zinc-800'
                  }`}>
                    <div className={`relative flex flex-col items-center gap-1.5 px-1`}>
                      <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                        isCurrent ? 'bg-purple-500 border-purple-500 ring-4 ring-purple-500/20' :
                        isPast    ? 'bg-purple-500 border-purple-500' :
                                    'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700'
                      }`} />
                      <span className={`text-[9px] font-black uppercase tracking-wide text-center leading-tight ${
                        isCurrent ? 'text-purple-600 dark:text-purple-400' :
                        isPast    ? 'text-zinc-500 dark:text-zinc-400' :
                                    'text-zinc-300 dark:text-zinc-600'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Workspaces Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Workspaces</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">Campaign units inside this project.</p>
          </div>
          {canCreateWs && <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">+ scroll down to create</span>}
        </div>

        {workspaces.length === 0 ? (
          <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center">
            <p className="text-2xl mb-2">🏠</p>
            <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm">No workspaces yet.</p>
            {canCreateWs && (
              <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">Create one below to start organizing tasks.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => {
              const wsCfg = wsStatusColors[ws.status] ?? wsStatusColors.ACTIVE;
              return (
                <Link
                  key={ws.id}
                  href={`/dashboard/projects/${projectId}/workspace/${ws.id}`}
                  className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-2xl p-5 hover:border-purple-500/30 dark:hover:border-purple-500/30 hover:shadow-md transition-all duration-300 group block"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {ws.name}
                    </h3>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${wsCfg}`}>
                      {ws.status}
                    </span>
                  </div>
                  {ws.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3">{ws.description}</p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-bold">
                    <span>{ws.task_count} task{Number(ws.task_count) !== 1 ? 's' : ''}</span>
                    {ws.deadline && (
                      <span className="font-mono">📅 {new Date(ws.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Create Workspace Form */}
        {canCreateWs && (
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm mt-2">
            <h3 className="text-base font-bold mb-1 text-zinc-900 dark:text-zinc-100">Create Workspace</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-4">Add a campaign unit (e.g. Instagram, Podcast, TikTok)</p>
            <CreateWorkspaceForm projectId={projectId} />
          </div>
        )}
      </div>

      {/* Legacy Tasks + Brief (ProjectTabs) */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">Other</h2>
        <ProjectTabs
          projectId={projectId}
          tasks={tasks}
          users={users}
          brief={brief}
          events={events}
          canCreateTask={canCreateTask}
          canApproveTask={canApproveTask}
          canDeleteTask={canDeleteTask}
          canEditBrief={canEditBrief}
          currentUserId={session.userId}
          handleCreateTask={async () => { 'use server'; }}
        />
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
