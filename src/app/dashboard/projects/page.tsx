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
  created_at: number;
}

interface PageProps {
  searchParams: Promise<{
    briefId?: string;
  }>;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/');

  const db = await getDB();
  const [projectsRaw, ctx, usersRaw] = await Promise.all([
    db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all(),
    getSessionContext(session.userId),
    db.prepare("SELECT id, name, email FROM users WHERE status = 'ACTIVE' ORDER BY email ASC").all(),
  ]);

  if (ctx.userType === 'OJT' || (!ctx.can('PROJECT_CREATE') && !ctx.can('PROJECT_MANAGE') && !ctx.can('ADMIN_SYSTEM'))) {
    redirect('/dashboard/workspace');
  }

  const projects = projectsRaw.results as unknown as Project[];
  const usersList = usersRaw.results as unknown as { id: string; name: string; email: string }[];
  const canCreateProject = ctx.can('PROJECT_CREATE');

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

                  <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-900/60 flex items-center justify-end">
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
