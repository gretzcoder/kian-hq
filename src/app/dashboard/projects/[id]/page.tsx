import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { deleteProject, updateProject } from '@/modules/projects/actions';
import ProjectTabs from '@/modules/projects/components/ProjectTabs';
import ProjectDetailTabs from '@/modules/projects/components/ProjectDetailTabs';
import ProjectCoordinatorsManager from '@/modules/projects/components/ProjectCoordinatorsManager';
import EditProjectModal from '@/modules/projects/components/EditProjectModal';
import CreateWorkspaceForm from './components/CreateWorkspaceForm';
import DeleteWorkspaceButton from './components/DeleteWorkspaceButton';

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  ojt_coordinator_id: string | null;
}

interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
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
  const isOJT = ctx.userType === 'OJT';

  const projectMentor = await db
    .prepare('SELECT 1 FROM project_coordinators WHERE project_id = ? AND user_id = ?')
    .bind(projectId, session.userId)
    .first();
  const isProjectMentor = !!projectMentor;

  if (isOJT && !isProjectMentor) {
    redirect('/dashboard/workspace');
  }

  const canDeleteProject = ctx.can('PROJECT_MANAGE');
  const canEditBrief     = ctx.can('BRIEF_REVIEW');
  const canCreateWs      = ctx.can('WORKSPACE_MANAGE') || isProjectMentor;
  const canDeleteWs      = ctx.can('WORKSPACE_MANAGE') || isProjectMentor;

  // Fetch Workspaces for this project
  const { results: workspacesRaw } = await db
    .prepare(`
      SELECT ws.id, ws.name, ws.description, ws.status,
             COUNT(t.id) as task_count
      FROM workspaces ws
      LEFT JOIN tasks t ON t.workspace_id = ws.id
      WHERE ws.project_id = ? AND ws.deleted_at IS NULL
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
      LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.assignment_role = 'PIC'
      LEFT JOIN users u ON ta.user_id = u.id
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

  // Fetch Mentor Troopers for workspace mentor selection dropdown
  const { results: mentorsRaw } = await db
    .prepare(`
      SELECT DISTINCT u.id, u.name, u.email
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.status = 'ACTIVE'
        AND (r.id = 'role_mentor_troopers' OR r.name = 'MENTOR TROOPERS')
      ORDER BY u.name ASC
    `)
    .all();
  const mentors = mentorsRaw as unknown as { id: string; name: string; email: string }[];

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

  // Fetch current project coordinators & all users for manager dropdown
  const [{ results: currentCoordinatorsRaw }, { results: allUsersRaw }] = await Promise.all([
    db.prepare(`
      SELECT u.id, u.name, u.email
      FROM project_coordinators pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.project_id = ?
      ORDER BY u.name ASC
    `).bind(projectId).all(),
    db.prepare('SELECT id, name, email FROM users WHERE status = "ACTIVE" ORDER BY name ASC').all(),
  ]);
  const currentCoordinators = currentCoordinatorsRaw as unknown as Array<{ id: string; name: string; email: string }>;
  const availableUsers = allUsersRaw as unknown as Array<{ id: string; name: string; email: string }>;
  const canUpdateProject = ctx.can('UPDATE');

  // Server Actions
  async function handleDeleteProject() {
    'use server';
    await deleteProject(projectId);
    redirect('/dashboard/projects');
  }

  return (
    <div className="space-y-8">
      {/* Back + Controls */}
      <div className="flex justify-between items-center">
        <Link
          href={isOJT ? "/dashboard/workspace" : "/dashboard/projects"}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors font-bold flex items-center gap-1"
        >
          ← {isOJT ? "Back to Workspace" : "Back to Registry"}
        </Link>
        <div className="flex items-center gap-2">
          {canDeleteProject && (
            <EditProjectModal
              projectId={projectId}
              initialName={project.name}
              initialDescription={project.description}
              onUpdate={async (formData: FormData) => {
                'use server';
                return await updateProject(projectId, formData);
              }}
            />
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

      {/* Project Banner (Title & Description) */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="mb-3">
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-600 dark:from-white dark:via-zinc-200 dark:to-zinc-400 bg-clip-text text-transparent">
            {project.name}
          </h1>
        </div>

        <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed max-w-3xl font-medium">
          {project.description || 'Tidak ada deskripsi proyek.'}
        </p>
      </div>

      {/* Project Coordinators Manager */}
      {canUpdateProject && (
        <ProjectCoordinatorsManager
          projectId={projectId}
          currentCoordinators={currentCoordinators}
          availableUsers={availableUsers}
        />
      )}

      {/* Project Detail Clean Tabbed Container */}
      <ProjectDetailTabs
        workspacesCount={workspaces.length}
        eventsCount={events.length}
        workspacesTab={
          workspaces.length === 0 ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center">
              <p className="text-2xl mb-2">🏠</p>
              <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm">
                Belum ada workspace di proyek ini.
              </p>
              {canCreateWs && (
                <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">
                  Klik tombol "+ Buat Workspace" untuk memulai penugasan kampanye.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((ws) => {
                const wsCfg = wsStatusColors[ws.status] ?? wsStatusColors.ACTIVE;
                return (
                  <div key={ws.id} className="relative group/wscard">
                    <Link
                      href={`/dashboard/workspace/${ws.id}`}
                      className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-2xl p-5 hover:border-purple-500/30 dark:hover:border-purple-500/30 hover:shadow-md transition-all duration-300 group block"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {ws.name}
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${wsCfg}`}
                          >
                            {ws.status}
                          </span>
                          {canDeleteWs && (
                            <DeleteWorkspaceButton workspaceId={ws.id} workspaceName={ws.name} />
                          )}
                        </div>
                      </div>
                      {ws.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3">
                          {ws.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-bold">
                        <span>
                          {ws.task_count} task{Number(ws.task_count) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )
        }
        timelineTab={
          <div className="max-w-3xl">
            <ProjectTabs
              projectId={projectId}
              tasks={[]}
              users={users}
              brief={null}
              events={events}
              canCreateTask={false}
              canApproveTask={false}
              canDeleteTask={false}
              canEditBrief={false}
              currentUserId={session.userId}
              handleCreateTask={async () => {
                'use server';
              }}
            />
          </div>
        }
        createWorkspaceForm={
          canCreateWs ? <CreateWorkspaceForm projectId={projectId} mentors={mentors} /> : undefined
        }
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
