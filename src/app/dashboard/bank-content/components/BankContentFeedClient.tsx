'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import UserAvatar from '@/components/ui/UserAvatar';
import { SubmittedLinkPreviewer } from '@/components/editor/SubmittedLinkPreviewer';
import {
  BankContentItem,
  BankContentFilters,
  getBankContentFeed,
  toggleBankContentPublishStatus,
  toggleBankContentLike,
  addBankContentComment,
  deleteBankContentComment,
} from '@/modules/bankContent/bankContentActions';

interface BankContentFeedClientProps {
  sessionUserId: string;
  canManage: boolean;
  initialFeed: {
    items: BankContentItem[];
    workspaces: { id: string; name: string }[];
    tasks: { id: string; title: string }[];
    submitters: { id: string; name: string }[];
  };
}

export default function BankContentFeedClient({
  sessionUserId,
  canManage,
  initialFeed,
}: BankContentFeedClientProps) {
  const [isPending, startTransition] = useTransition();

  // General category tab state
  const [generalCategory, setGeneralCategory] = useState<'ALL' | 'DESIGN' | 'VIDEO'>('ALL');

  // Inner filter states
  const [innerFilter, setInnerFilter] = useState<'ALL' | 'PUBLISHED' | 'NON_PUBLISHED'>('ALL');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('ALL');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');
  const [sortByDate, setSortByDate] = useState<'desc' | 'asc'>('desc');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Feed data state
  const [feedData, setFeedData] = useState(initialFeed);

  // Active expanded comments per card
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentingMap, setCommentingMap] = useState<Record<string, boolean>>({});

  // Active status toggle state per card
  const [togglingMap, setTogglingMap] = useState<Record<string, boolean>>({});

  // Lightbox Preview Modal state
  const [previewModalUrl, setPreviewModalUrl] = useState<{ url: string; title: string } | null>(null);

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Re-fetch feed when filters change
  const applyFilters = (overrides?: Partial<BankContentFilters>) => {
    const filters: BankContentFilters = {
      generalCategory: overrides?.generalCategory ?? generalCategory,
      innerFilter: overrides?.innerFilter ?? innerFilter,
      workspaceId: overrides?.workspaceId ?? selectedWorkspaceId,
      taskId: overrides?.taskId ?? selectedTaskId,
      userId: overrides?.userId ?? selectedUserId,
      sortByDate: overrides?.sortByDate ?? sortByDate,
      search: overrides?.search ?? searchQuery,
    };

    startTransition(async () => {
      try {
        const res = await getBankContentFeed(filters);
        setFeedData(res);
      } catch (err: any) {
        showToast(err.message || 'Gagal memuat data konten.', 'error');
      }
    });
  };

  // Handlers for category & filters
  const handleGeneralCategoryChange = (cat: 'ALL' | 'DESIGN' | 'VIDEO') => {
    setGeneralCategory(cat);
    applyFilters({ generalCategory: cat });
  };

  const handleInnerFilterChange = (status: 'ALL' | 'PUBLISHED' | 'NON_PUBLISHED') => {
    setInnerFilter(status);
    applyFilters({ innerFilter: status });
  };

  const handleWorkspaceChange = (wsId: string) => {
    setSelectedWorkspaceId(wsId);
    applyFilters({ workspaceId: wsId });
  };

  const handleTaskChange = (tId: string) => {
    setSelectedTaskId(tId);
    applyFilters({ taskId: tId });
  };

  const handleUserChange = (uId: string) => {
    setSelectedUserId(uId);
    applyFilters({ userId: uId });
  };

  const handleSortChange = (sort: 'desc' | 'asc') => {
    setSortByDate(sort);
    applyFilters({ sortByDate: sort });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  // Toggle Like handler
  const handleToggleLike = async (assignmentId: string) => {
    // Optimistic UI update
    setFeedData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.assignmentId === assignmentId) {
          const userLiked = !item.userLiked;
          const likesCount = userLiked ? item.likesCount + 1 : item.likesCount - 1;
          return { ...item, userLiked, likesCount };
        }
        return item;
      }),
    }));

    try {
      const res = await toggleBankContentLike(assignmentId);
      if (!res.success) {
        showToast(res.error || 'Gagal menyukai konten', 'error');
        // Revert on error
        applyFilters();
      }
    } catch {
      applyFilters();
    }
  };

  // Toggle Publish Status handler
  const handleTogglePublish = async (assignmentId: string, currentStatus: string) => {
    const targetStatus = currentStatus === 'PUBLISHED' ? 'NON_PUBLISHED' : 'PUBLISHED';

    setTogglingMap((prev) => ({ ...prev, [assignmentId]: true }));

    try {
      const res = await toggleBankContentPublishStatus(assignmentId, targetStatus);
      if (res.success) {
        showToast(res.message || 'Status berhasil diubah', 'success');
        applyFilters();
      } else {
        showToast(res.error || 'Gagal mengubah status publish', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status publish', 'error');
    } finally {
      setTogglingMap((prev) => ({ ...prev, [assignmentId]: false }));
    }
  };

  // Comment Add handler
  const handleAddComment = async (assignmentId: string) => {
    const text = commentInputs[assignmentId]?.trim();
    if (!text) return;

    setCommentingMap((prev) => ({ ...prev, [assignmentId]: true }));

    try {
      const res = await addBankContentComment(assignmentId, text);
      if (res.success) {
        setCommentInputs((prev) => ({ ...prev, [assignmentId]: '' }));
        applyFilters();
      } else {
        showToast(res.error || 'Gagal menambahkan komentar', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan komentar', 'error');
    } finally {
      setCommentingMap((prev) => ({ ...prev, [assignmentId]: false }));
    }
  };

  // Comment Delete handler
  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await deleteBankContentComment(commentId);
      if (res.success) {
        showToast('Komentar berhasil dihapus.', 'success');
        applyFilters();
      } else {
        showToast(res.error || 'Gagal menghapus komentar', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus komentar', 'error');
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = feedData.items.length;
    const published = feedData.items.filter((i) => i.publishStatus === 'PUBLISHED').length;
    const design = feedData.items.filter((i) => i.category === 'DESIGN').length;
    const video = feedData.items.filter((i) => i.category === 'VIDEO').length;
    return { total, published, design, video };
  }, [feedData.items]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 max-w-md text-xs font-bold ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
              : 'bg-red-950/90 text-red-200 border-red-500/30'
          }`}
        >
          <span className="text-base">{toastMessage.type === 'success' ? '✨' : '⚠️'}</span>
          <span className="flex-1">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-zinc-400 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-zinc-900 p-6 sm:p-8 text-white shadow-xl border border-purple-500/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-bold mb-1">
                <span>🎨</span>
                <span>Bank Content & Repository Karya</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-purple-100 to-pink-200 bg-clip-text text-transparent">
                Bank Content KIAN HQ
              </h1>
              <p className="text-xs sm:text-sm text-zinc-300 font-medium max-w-2xl">
                Tempat seluruh hasil submit karya Design & Video dari semua user berkumpul. Cari inspirasi, beri apresiasi like & komentar, dan dapatkan **+10 Sparks** bonus untuk karya ter-publish!
              </p>
            </div>

            {/* Quick Stats Summary */}
            <div className="flex items-center gap-2 sm:gap-3 bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/15 p-2.5 rounded-2xl shrink-0">
              <div className="px-3 py-1.5 text-center">
                <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Total Karya</p>
                <p className="text-lg font-black text-white">{stats.total}</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="px-3 py-1.5 text-center">
                <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">Published</p>
                <p className="text-lg font-black text-emerald-400">{stats.published}</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="px-3 py-1.5 text-center">
                <p className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">Design / Video</p>
                <p className="text-lg font-black text-purple-300">{stats.design} / {stats.video}</p>
              </div>
            </div>
          </div>

          {/* General Category Tabs (Semua / Design / Video) */}
          <div className="pt-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleGeneralCategoryChange('ALL')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                generalCategory === 'ALL'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-400'
                  : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10'
              }`}
            >
              <span>🖼️</span>
              <span>Semua Karya ({stats.total})</span>
            </button>

            <button
              onClick={() => handleGeneralCategoryChange('DESIGN')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                generalCategory === 'DESIGN'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-400'
                  : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10'
              }`}
            >
              <span>🎨</span>
              <span>Design ({stats.design})</span>
            </button>

            <button
              onClick={() => handleGeneralCategoryChange('VIDEO')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                generalCategory === 'VIDEO'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-400'
                  : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10'
              }`}
            >
              <span>📹</span>
              <span>Video ({stats.video})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comprehensive Filter Toolbar */}
      <div className="bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 p-4 rounded-3xl shadow-sm space-y-3">
        {/* Search & Status Pills Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px]">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="Cari judul task, nama submitter, atau workspace..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-20 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition-all cursor-pointer"
              >
                Cari
              </button>
            </div>
          </form>

          {/* Inner Publish Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 py-0.5">
            <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mr-1 shrink-0">
              Status:
            </span>
            <button
              onClick={() => handleInnerFilterChange('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                innerFilter === 'ALL'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              Keseluruhan
            </button>
            <button
              onClick={() => handleInnerFilterChange('PUBLISHED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                innerFilter === 'PUBLISHED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              <span>✨</span>
              <span>Publish</span>
            </button>
            <button
              onClick={() => handleInnerFilterChange('NON_PUBLISHED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                innerFilter === 'NON_PUBLISHED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              <span>⏳</span>
              <span>Non Publish</span>
            </button>
          </div>
        </div>

        {/* Dropdowns Row: Workspace, Task, User, Date Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 border-t border-zinc-100 dark:border-zinc-900/60">
          {/* Workspace Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">
              Workspace
            </label>
            <select
              value={selectedWorkspaceId}
              onChange={(e) => handleWorkspaceChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">⚡ Semua Workspace</option>
              {feedData.workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </div>

          {/* Task Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">
              Tugas (Task)
            </label>
            <select
              value={selectedTaskId}
              onChange={(e) => handleTaskChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">📋 Semua Tugas</option>
              {feedData.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* User / Submitter Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">
              Pembuat Submit (User)
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => handleUserChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">👥 Semua User</option>
              {feedData.submitters.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Date */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">
              Urutkan Tanggal Submit
            </label>
            <select
              value={sortByDate}
              onChange={(e) => handleSortChange(e.target.value as 'desc' | 'asc')}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="desc">📅 Terbaru Dulu (Newest)</option>
              <option value="asc">📅 Terlama Dulu (Oldest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {isPending && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-purple-500/20 shadow-md text-purple-600 dark:text-purple-400 text-xs font-bold animate-pulse">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span>Memperbarui daftar karya Bank Content...</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isPending && feedData.items.length === 0 && (
        <div className="bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center text-3xl mx-auto">
            🎨
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Belum Ada Konten Ditemukan
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Tidak ada konten karya yang cocok dengan kombinasi filter yang dipilih. Coba reset filter atau pilih kategori lain.
            </p>
          </div>
          <button
            onClick={() => {
              setGeneralCategory('ALL');
              setInnerFilter('ALL');
              setSelectedWorkspaceId('ALL');
              setSelectedTaskId('ALL');
              setSelectedUserId('ALL');
              setSearchQuery('');
              applyFilters({
                generalCategory: 'ALL',
                innerFilter: 'ALL',
                workspaceId: 'ALL',
                taskId: 'ALL',
                userId: 'ALL',
                search: '',
              });
            }}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            Reset Semua Filter
          </button>
        </div>
      )}

      {/* Content Grid */}
      {!isPending && feedData.items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {feedData.items.map((item) => {
            const isPublished = item.publishStatus === 'PUBLISHED';
            const commentsOpen = expandedComments[item.assignmentId] || false;
            const isToggling = togglingMap[item.assignmentId] || false;
            const isCommenting = commentingMap[item.assignmentId] || false;
            const commentText = commentInputs[item.assignmentId] || '';

            const dateStr = item.submittedAt
              ? new Date(item.submittedAt * 1000).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '-';

            return (
              <div
                key={item.assignmentId}
                className="bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
              >
                {/* Card Header: Submitter Avatar & Status Pill */}
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-900/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar
                      src={item.submitterAvatar}
                      name={item.submitterName}
                      size="sm"
                      square
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                        {item.submitterName}
                      </p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium truncate">
                        {dateStr}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                        isPublished
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      {isPublished ? (
                        <>
                          <span>✨</span>
                          <span>PUBLISHED</span>
                        </>
                      ) : (
                        <span>NON PUBLISH</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Task & Workspace Meta Banner */}
                <div className="px-4 py-2.5 bg-zinc-50/80 dark:bg-zinc-900/40 border-b border-zinc-100 dark:border-zinc-900/60 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                      {item.category}
                    </span>
                    {item.workspaceName && (
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 truncate">
                        ⚡ {item.workspaceName}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                    {item.taskTitle}
                  </h4>
                </div>

                {/* Media Link Previewer Container */}
                <div className="p-4 flex-1 space-y-3">
                  <SubmittedLinkPreviewer url={item.resultUrl} autoExpand={true} />

                  {/* Full Lightbox Preview Trigger */}
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500">
                    <button
                      type="button"
                      onClick={() => setPreviewModalUrl({ url: item.resultUrl, title: item.taskTitle })}
                      className="text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>🔍 Buka Lightbox Fullscreen</span>
                    </button>
                    {item.publishBonusAwarded && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <span>✨ +10 Sparks Claimed</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Bar (Like, Comment, Admin Publish Toggle) */}
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-900/60 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/40">
                  <div className="flex items-center justify-between gap-2">
                    {/* Social Interactions: Like & Comment Toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleLike(item.assignmentId)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          item.userLiked
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-rose-500/10 hover:text-rose-600'
                        }`}
                      >
                        <span>{item.userLiked ? '❤️' : '🤍'}</span>
                        <span>{item.likesCount}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedComments((prev) => ({
                            ...prev,
                            [item.assignmentId]: !prev[item.assignmentId],
                          }))
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-purple-500/10 hover:text-purple-600 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>💬</span>
                        <span>{item.commentsCount} Komentar</span>
                      </button>
                    </div>

                    {/* Admin / Coordinator / Mentor Publish Toggle Switch */}
                    {canManage && (
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleTogglePublish(item.assignmentId, item.publishStatus)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          isPublished
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        }`}
                        title={
                          isPublished
                            ? 'Ubah status menjadi Non Publish'
                            : 'Publish karya ini & berikan otomatis +10 Sparks bonus ke pemilik submit!'
                        }
                      >
                        {isToggling ? (
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : isPublished ? (
                          <>
                            <span>⏳</span>
                            <span>Unpublish</span>
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            <span>Publish (+10 Sparks)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expandable Comments Drawer */}
                  {commentsOpen && (
                    <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-3 animate-in fade-in duration-200">
                      {/* Comments List */}
                      <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                        {item.comments.length === 0 ? (
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center py-2 italic">
                            Belum ada komentar. Jadilah yang pertama memberikan masukan!
                          </p>
                        ) : (
                          item.comments.map((c) => (
                            <div
                              key={c.id}
                              className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/80 p-2.5 rounded-2xl space-y-1 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <UserAvatar
                                    src={c.userAvatar}
                                    name={c.userName}
                                    size="xs"
                                    square
                                  />
                                  <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                    {c.userName}
                                  </span>
                                </div>
                                {(c.userId === sessionUserId || canManage) && (
                                  <button
                                    onClick={() => handleDeleteComment(c.id)}
                                    className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                                    title="Hapus Komentar"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                              <p className="text-zinc-700 dark:text-zinc-300 text-xs pl-7 whitespace-pre-wrap">
                                {c.content}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Comment Input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Tulis komentar atau apresiasi..."
                          value={commentText}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [item.assignmentId]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddComment(item.assignmentId);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          disabled={isCommenting || !commentText.trim()}
                          onClick={() => handleAddComment(item.assignmentId)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer"
                        >
                          {isCommenting ? '...' : 'Kirim'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 sm:p-6 flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-2 truncate">
                <span className="text-xl">🎨</span>
                <h3 className="text-sm font-bold truncate">{previewModalUrl.title}</h3>
              </div>
              <button
                onClick={() => setPreviewModalUrl(null)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                ✕ Tutup Lightbox
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-black">
              <SubmittedLinkPreviewer url={previewModalUrl.url} autoExpand={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
