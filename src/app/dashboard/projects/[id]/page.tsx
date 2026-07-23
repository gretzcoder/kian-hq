import { getSession } from '@/modules/auth/session';
import { hasPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createTask } from '@/modules/tasks/actions';
import { deleteProject } from '@/modules/projects/actions';
import ProjectTabs from '@/modules/projects/components/ProjectTabs';

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  gdrive_folder_id: string | null;
  status: string;
  deadline: number | null;
  created_at: number;
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
  audience: string | null;
  objectives: string | null;
  key_messages: string | null;
  visual_style: string | null;
}

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/');

  // Await params as required by Next 15/16 guidelines
  const { id: projectId } = await params;

  const db = await getDB();

  // 1. Fetch Project Details
  const project = await db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .bind(projectId)
    .first() as ProjectRow | null;

  if (!project) {
    notFound();
  }

  // 2. Fetch Tasks inside Project
  const tasksQuery = `
    SELECT t.*, u.name as assigned_name, u.email as assigned_email, c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.project_id = ?
    ORDER BY t.created_at ASC
  `;
  const { results: tasksRaw } = await db.prepare(tasksQuery).bind(projectId).all();
  const tasks = tasksRaw as unknown as TaskRow[];

  // 3. Fetch all system users (for assignment dropdown)
  const { results: usersRaw } = await db.prepare('SELECT id, name FROM users ORDER BY name ASC').all();
  const users = usersRaw as unknown as UserRow[];

  // 4. Fetch Content Brief
  const brief = await db
    .prepare('SELECT audience, objectives, key_messages, visual_style FROM content_briefs WHERE project_id = ?')
    .bind(projectId)
    .first() as BriefRow | null;

  // 5. Permissions check
  const canCreateTask = await hasPermission(session.userId, 'CREATE');
  const canApproveTask = await hasPermission(session.userId, 'APPROVE');
  const canDeleteTask = await hasPermission(session.userId, 'DELETE');
  const canDeleteProject = await hasPermission(session.userId, 'DELETE');

  // Bind createTask action with projectId
  const createTaskWithProjectId = createTask.bind(null, projectId);

  async function handleCreateTask(formData: FormData) {
    'use server';
    await createTaskWithProjectId(formData);
  }

  // Bind deleteProject action with projectId
  const deleteProjectWithId = async () => {
    'use server';
    await deleteProject(projectId);
    redirect('/dashboard/projects');
  };

  return (
    <div className="space-y-8">
      {/* Back button and project controls */}
      <div className="flex justify-between items-center">
        <Link href="/dashboard/projects" className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors font-bold flex items-center gap-1">
          &larr; Back to Registry
        </Link>
        {canDeleteProject && (
          <form action={deleteProjectWithId}>
            <button
              type="submit"
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-500 font-bold border border-red-500/10 hover:border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all duration-300 active:scale-[0.98]"
            >
              Delete Project
            </button>
          </form>
        )}
      </div>

      {/* Project Details Banner Card */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-600 dark:from-white dark:via-zinc-200 dark:to-zinc-400 bg-clip-text text-transparent">
              {project.name}
            </h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-500 font-bold tracking-wider mt-1.5 uppercase">ID: {project.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-purple-600 dark:text-purple-400">
              Status: {project.status}
            </span>
            {project.deadline && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono font-medium">
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
              className="inline-flex items-center gap-2 text-xs font-bold bg-purple-500/5 hover:bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/10 dark:border-purple-500/20 px-4 py-2 rounded-xl transition-all duration-300 active:scale-[0.98] shadow-sm"
            >
              📁 Go to Storage Folder
            </a>
          </div>
        )}
      </div>

      {/* Interactive Tabs (Tasks, Brief, Timeline) */}
      <ProjectTabs
        projectId={projectId}
        tasks={tasks}
        users={users}
        brief={brief}
        canCreateTask={canCreateTask}
        canApproveTask={canApproveTask}
        canDeleteTask={canDeleteTask}
        currentUserId={session.userId}
        handleCreateTask={handleCreateTask}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
