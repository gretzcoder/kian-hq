import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CreateProjectForm from './components/CreateProjectForm';

interface Project {
  id: string;
  name: string;
  description: string | null;
  gdrive_folder_id: string | null;
  status: string;
  deadline: number | null;
  created_at: number;
}

interface PageProps {
  searchParams: Promise<{
    briefId?: string;
  }>;
}

const statusColors: Record<string, string> = {
  PLANNING: 'bg-blue-500/5 text-blue-600 border-blue-500/10 dark:text-blue-400 dark:border-blue-500/15',
  IN_PROGRESS: 'bg-purple-500/5 text-purple-600 border-purple-500/10 dark:text-purple-400 dark:border-purple-500/15',
  IN_REVIEW: 'bg-orange-500/5 text-orange-600 border-orange-500/10 dark:text-orange-400 dark:border-orange-500/15',
  PUBLISHED: 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/15',
  ARCHIVED: 'bg-zinc-500/5 text-zinc-500 border-zinc-500/10 dark:text-zinc-400 dark:border-zinc-500/15',
};

export default async function ProjectsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/');

  const db = await getDB();
  const [projectsRaw, ctx, usersRaw] = await Promise.all([
    db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all(),
    getSessionContext(session.userId),
    db.prepare("SELECT id, name, email FROM users WHERE status = 'ACTIVE' ORDER BY email ASC").all(),
  ]);

  if (ctx.userType === 'OJT') {
    redirect('/dashboard/workspace');
  }

  const projects = projectsRaw.results as unknown as Project[];
  const usersList = usersRaw.results as unknown as { id: string; name: string; email: string }[];
  const canCreateProject = ctx.can('CREATE_PROJECT');

  const { briefId } = await searchParams;
  let briefTitle: string | null = null;
  if (briefId) {
    const brief = await db
      .prepare('SELECT title FROM content_briefs WHERE id = ?')
      .bind(briefId)
      .first() as { title: string | null } | null;
    briefTitle = brief?.title || 'Untitled Brief';
  }

  // createProject action is imported and called inside CreateProjectForm client component

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Projects Registry
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Browse creative campaigns, track folder deliverables, and overview tasks.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left/Middle Column: Project List */}
        <div className={canCreateProject ? 'lg:col-span-2 space-y-4' : 'lg:col-span-3 space-y-4'}>
          {projects.length === 0 ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-12 text-center text-zinc-500">
              No projects created yet. Start by defining a project on the right panel.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 shadow-sm"
                >
                  <div>
                    <div className="flex justify-between items-start gap-3 mb-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider border ${
                          statusColors[project.status] || statusColors.PLANNING
                        }`}
                      >
                        {project.status.replace('_', ' ')}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="text-lg font-bold text-zinc-800 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors block mb-2"
                    >
                      {project.name}
                    </Link>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                      {project.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-900/60 flex items-center justify-between gap-4">
                    {project.gdrive_folder_id ? (
                      <a
                        href={project.gdrive_folder_id}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-500 font-bold inline-flex items-center gap-1.5"
                      >
                        📁 Storage Folder
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold">No storage URL</span>
                    )}

                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="text-xs border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900/50 transition-all font-bold tracking-wide active:scale-[0.98] shadow-sm"
                    >
                      Open &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Creation Panel (If permitted) */}
        {canCreateProject ? (
          <CreateProjectForm
            briefId={briefId || null}
            briefTitle={briefTitle}
            ojtList={usersList}
          />
        ) : null}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
