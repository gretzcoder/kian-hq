import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { createKBArticle } from '@/modules/knowledge-base/actions';

interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  author_name: string | null;
  created_at: number;
}

export default async function KnowledgeBasePage() {
  const session = await getSession();
  if (!session) return null;

  const db = await getDB();
  const [articlesRaw, ctx] = await Promise.all([
    db.prepare(`
      SELECT kb.*, u.name as author_name
      FROM knowledge_base kb
      LEFT JOIN users u ON kb.created_by = u.id
      ORDER BY kb.created_at DESC
    `).all(),
    getSessionContext(session.userId),
  ]);

  const articles = articlesRaw.results as unknown as KBArticle[];
  const canCreate = ctx.can('CREATE_KB');

  async function handleCreateKBArticle(formData: FormData) {
    'use server';
    await createKBArticle(formData);
  }

  const categoryLabels: Record<string, string> = {
    GENERAL: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/15',
    GUIDELINE: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15',
    ASSETS: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/15',
    DESIGN: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
          Knowledge
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Access guidelines, asset specs, design templates, and team documentations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Articles List Column */}
        <div className={canCreate ? 'lg:col-span-2 space-y-6' : 'lg:col-span-3 space-y-6'}>
          {articles.length === 0 ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 text-sm">
              No documentation articles added yet.
            </div>
          ) : (
            <div className="space-y-6">
              {articles.map((art) => (
                <div
                  key={art.id}
                  className="border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-[#0e0e10]/20 rounded-2xl p-6 hover:border-zinc-300 dark:hover:border-zinc-800 hover:shadow-sm transition-all duration-300"
                >
                  <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{art.title}</h3>
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">
                        Posted by: {art.author_name || 'System Operator'} on{' '}
                        {new Date(art.created_at * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        categoryLabels[art.category] || categoryLabels.GENERAL
                      }`}
                    >
                      {art.category}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {art.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Creation Form Column (Only if permitted) */}
        {canCreate && (
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0e0e10]/60 rounded-3xl p-6 shadow-sm">
            <h2 className="text-lg font-bold mb-1 text-zinc-900 dark:text-zinc-100">Create Document</h2>
            <p className="text-zinc-500 dark:text-zinc-500 text-xs mb-6">Contribute to the team knowledge base guidelines.</p>

            <form action={handleCreateKBArticle} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Document Title
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Design Export Specifications"
                  className="w-full bg-zinc-100/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Category Group
                </label>
                <select
                  name="category"
                  className="w-full bg-zinc-100/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-700 dark:text-zinc-300 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all cursor-pointer duration-200"
                >
                  <option value="GENERAL">General Info</option>
                  <option value="GUIDELINE">Guidelines &amp; Rules</option>
                  <option value="ASSETS">Creative Assets</option>
                  <option value="DESIGN">Design System</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Article Body (Content)
                </label>
                <textarea
                  name="content"
                  rows={8}
                  required
                  placeholder="Type guidelines, code snippets, asset specifications..."
                  className="w-full bg-zinc-100/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] mt-4"
              >
                Publish Document
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
