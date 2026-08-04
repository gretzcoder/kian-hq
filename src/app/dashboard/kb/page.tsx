import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { createKBCategory, createKBItem } from '@/modules/knowledge-base/actions';
import DeleteCategoryButton from './components/DeleteCategoryButton';
import DeleteItemButton from './components/DeleteItemButton';
import Link from 'next/link';

interface KBCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
  created_at: number;
  item_count: number;
}

interface KBItem {
  id: string;
  category_id: string;
  title: string;
  url: string;
  description: string | null;
  created_at: number;
}

// Emoji icon options for category creation
const ICON_OPTIONS = [
  { emoji: '📁', label: 'Folder' },
  { emoji: '📋', label: 'Guideline' },
  { emoji: '🖼️', label: 'Foto/Gambar' },
  { emoji: '🎬', label: 'Video' },
  { emoji: '🎯', label: 'Event' },
  { emoji: '📐', label: 'Desain' },
  { emoji: '📊', label: 'Laporan' },
  { emoji: '🔗', label: 'Link' },
  { emoji: '📝', label: 'Dokumen' },
  { emoji: '🎨', label: 'Aset Kreatif' },
];

function getLinkDomain(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return 'link';
  }
}

function getLinkIcon(url: string) {
  try {
    const host = new URL(url).hostname;
    if (host.includes('drive.google')) return '🗂️';
    if (host.includes('docs.google')) return '📄';
    if (host.includes('youtube') || host.includes('youtu.be')) return '▶️';
    if (host.includes('figma')) return '🎨';
    if (host.includes('notion')) return '📝';
    if (host.includes('canva')) return '🖌️';
    if (host.includes('dropbox')) return '📦';
  } catch { /* ignore */ }
  return '🔗';
}

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { cat: activeCatParam } = await searchParams;
  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const canManage = ctx.can('KB_MANAGE');

  // Fetch all categories with item count
  const { results: rawCategories } = await db.prepare(`
    SELECT
      kc.*,
      COUNT(ki.id) AS item_count
    FROM knowledge_categories kc
    LEFT JOIN knowledge_items ki ON ki.category_id = kc.id
    GROUP BY kc.id
    ORDER BY kc.sort_order ASC, kc.created_at ASC
  `).all();

  const categories = rawCategories as unknown as KBCategory[];

  // Determine active category
  const activeCat = categories.find((c) => c.id === activeCatParam) ?? categories[0] ?? null;

  // Fetch items for active category
  let items: KBItem[] = [];
  if (activeCat) {
    const { results } = await db.prepare(`
      SELECT ki.*, u.name AS created_by_name
      FROM knowledge_items ki
      LEFT JOIN users u ON ki.created_by = u.id
      WHERE ki.category_id = ?
      ORDER BY ki.sort_order ASC, ki.created_at ASC
    `).bind(activeCat.id).all();
    items = results as unknown as KBItem[];
  }

  // Server actions
  async function handleCreateCategory(formData: FormData) {
    'use server';
    await createKBCategory(formData);
  }

  async function handleCreateItem(formData: FormData) {
    'use server';
    await createKBItem(formData);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Knowledge
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Akses guidelines, aset foto &amp; video, link event, dan dokumentasi tim.
          </p>
        </div>
        {canManage && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-500/8 border border-purple-500/15 px-3 py-1.5 rounded-full">
            ✦ Editor Mode
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left Sidebar: Categories ── */}
        <aside className="w-full lg:w-64 shrink-0 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-3 px-1">
            Kategori
          </p>

          {categories.length === 0 ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center text-zinc-400 text-xs">
              Belum ada kategori.
            </div>
          ) : (
            <nav className="space-y-1">
              {categories.map((cat) => {
                const isActive = cat.id === activeCat?.id;
                return (
                  <Link
                    key={cat.id}
                    href={`/dashboard/kb?cat=${cat.id}`}
                    className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-[0_2px_12px_rgba(147,51,234,0.25)]'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base leading-none shrink-0">{cat.icon}</span>
                      <span className="text-sm font-bold truncate">{cat.name}</span>
                    </span>
                    <span className={`text-[10px] font-mono font-bold shrink-0 ${isActive ? 'text-purple-200' : 'text-zinc-400 dark:text-zinc-600'}`}>
                      {cat.item_count}
                    </span>
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Delete category button — only shown in active category row when canManage */}
          {canManage && activeCat && (
            <div className="px-1 pt-1 flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600">Hapus &quot;{activeCat.name}&quot;:</span>
              <DeleteCategoryButton id={activeCat.id} name={activeCat.name} />
            </div>
          )}

          {/* Add Category Form */}
          {canManage && (
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
              <details className="group">
                <summary className="text-[11px] font-bold text-purple-600 dark:text-purple-400 cursor-pointer select-none list-none flex items-center gap-1.5 px-1 py-1 hover:text-purple-500 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-45">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Tambah Kategori
                </summary>
                <form action={handleCreateCategory} className="mt-3 space-y-3">
                  {/* Icon picker */}
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Icon</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ICON_OPTIONS.map((opt, i) => (
                        <label key={opt.emoji} className="cursor-pointer">
                          <input
                            type="radio"
                            name="icon"
                            value={opt.emoji}
                            defaultChecked={i === 0}
                            className="sr-only peer"
                          />
                          <span
                            title={opt.label}
                            className="text-base w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 peer-checked:border-purple-500 peer-checked:bg-purple-500/10 transition-all"
                          >
                            {opt.emoji}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Nama Kategori</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="mis. Video Kebutuhan Event"
                      className="w-full bg-zinc-100/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg px-3 py-2 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Deskripsi (opsional)</label>
                    <input
                      type="text"
                      name="description"
                      placeholder="Singkat tentang kategori ini..."
                      className="w-full bg-zinc-100/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg px-3 py-2 focus:outline-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg transition-all active:scale-[0.98]"
                  >
                    Buat Kategori
                  </button>
                </form>
              </details>
            </div>
          )}
        </aside>

        {/* ── Right Panel: Items ── */}
        <div className="flex-1 min-w-0">
          {!activeCat ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-16 text-center">
              <p className="text-zinc-400 text-sm font-medium">Buat kategori pertama untuk mulai mengisi knowledge base.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Active Category Header */}
              <div className="flex items-start gap-4">
                <span className="text-3xl leading-none mt-0.5">{activeCat.icon}</span>
                <div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">{activeCat.name}</h2>
                  {activeCat.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{activeCat.description}</p>
                  )}
                  <p className="text-[10px] font-mono text-zinc-400 mt-1">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Items Grid */}
              {items.length === 0 ? (
                <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-zinc-400 text-sm">
                  Belum ada item di kategori ini.{canManage ? ' Tambahkan link di bawah.' : ''}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="group relative border border-zinc-200/80 dark:border-zinc-800/60 bg-white dark:bg-[#0e0e10]/30 rounded-2xl p-4 hover:border-purple-500/30 dark:hover:border-purple-500/20 hover:shadow-md transition-all duration-200 flex flex-col gap-3"
                    >
                      {/* Delete button — top right, appears on hover */}
                      {canManage && (
                        <div className="absolute top-3 right-3">
                          <DeleteItemButton id={item.id} title={item.title} />
                        </div>
                      )}

                      {/* Link icon + domain badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none">{getLinkIcon(item.url)}</span>
                        <span className="text-[9px] font-mono font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded-full">
                          {getLinkDomain(item.url)}
                        </span>
                      </div>

                      {/* Title */}
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug pr-4">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Open link button */}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-colors group/link"
                      >
                        Buka Link
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Item Form — only for editors */}
              {canManage && (
                <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0e0e10]/40 rounded-2xl p-5 mt-2">
                  <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Tambah Item ke &quot;{activeCat.name}&quot;
                  </h3>
                  <form action={handleCreateItem} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="hidden" name="category_id" value={activeCat.id} />

                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Judul</label>
                      <input
                        type="text"
                        name="title"
                        required
                        placeholder="mis. Photo Pack – Ramadan 2025"
                        className="w-full bg-zinc-100/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">URL / Link</label>
                      <input
                        type="url"
                        name="url"
                        required
                        placeholder="https://drive.google.com/..."
                        className="w-full bg-zinc-100/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-2.5 focus:outline-none transition-all font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Deskripsi (opsional)</label>
                      <input
                        type="text"
                        name="description"
                        placeholder="Singkat tentang isi link ini..."
                        className="w-full bg-zinc-100/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm py-2.5 px-6 rounded-xl transition-all duration-200 shadow-[0_2px_12px_rgba(147,51,234,0.2)] hover:shadow-[0_4px_16px_rgba(147,51,234,0.3)] active:scale-[0.98]"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Tambah Item
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
