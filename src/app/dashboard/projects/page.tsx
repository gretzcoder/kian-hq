import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createProject } from '@/modules/projects/actions';

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
  const [projectsRaw, ctx] = await Promise.all([
    db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all(),
    getSessionContext(session.userId),
  ]);

  const projects = projectsRaw.results as unknown as Project[];
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

  async function handleCreateProject(formData: FormData) {
    'use server';
    await createProject(formData);
    redirect('/dashboard/projects');
  }

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
                      {project.deadline && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-medium">
                          Due: {new Date(project.deadline).toLocaleDateString()}
                        </span>
                      )}
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
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold mb-1 text-zinc-900 dark:text-zinc-100">Create New Project</h2>
              <p className="text-zinc-500 dark:text-zinc-500 text-xs">Initialize a creative campaign and map its storage root.</p>
            </div>

            {briefTitle && (
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-3.5 space-y-1">
                <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                  Linked Content Brief
                </span>
                <p className="text-xs text-zinc-800 dark:text-zinc-200 font-bold">{briefTitle}</p>
              </div>
            )}

            <form action={handleCreateProject} className="space-y-4">
              {briefId && <input type="hidden" name="briefId" value={briefId} />}

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={briefTitle || ''}
                  placeholder="e.g. Q3 Video Campaign"
                  className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Briefly describe the campaign goals..."
                  className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Storage URL (Google Drive folder)
                </label>
                <input
                  type="url"
                  name="gdriveFolderUrl"
                  placeholder="e.g. https://drive.google.com/..."
                  className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Deadline
                </label>
                <input
                  type="date"
                  name="deadline"
                  className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all text-zinc-500 dark:text-zinc-400 duration-200 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] mt-4"
              >
                Create Project
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
