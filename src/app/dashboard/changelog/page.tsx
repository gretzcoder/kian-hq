'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  SYSTEM_CHANGELOG,
  GIT_COMMIT_LOGS,
  getLatestSystemVersion,
  ChangelogItem,
  GitCommitLog,
} from '@/lib/changelog';

export default function ChangelogPage() {
  const latestVersion = getLatestSystemVersion();
  const [activeTab, setActiveTab] = useState<'RELEASES' | 'GIT_COMMITS'>('RELEASES');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('ALL');

  // Filter changelog releases
  const filteredReleases = useMemo(() => {
    return SYSTEM_CHANGELOG.filter((item) => {
      const matchesSearch =
        item.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.changes.some((c) => c.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedCategory === 'ALL') return true;
      if (selectedCategory === 'MAJOR') return item.type === 'MAJOR';
      if (selectedCategory === 'FEATURE') return item.changes.some((c) => c.category.includes('Feature'));
      if (selectedCategory === 'FIX') return item.changes.some((c) => c.category.includes('Fix'));
      if (selectedCategory === 'UI_UX') return item.changes.some((c) => c.category.includes('UI'));

      return true;
    });
  }, [searchQuery, selectedCategory]);

  // Unique authors from git commits
  const uniqueAuthors = useMemo(() => {
    const authors = Array.from(new Set(GIT_COMMIT_LOGS.map((c) => c.author)));
    return authors.sort();
  }, []);

  // Filter git commits
  const filteredCommits = useMemo(() => {
    return GIT_COMMIT_LOGS.filter((commit) => {
      const matchesSearch =
        commit.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
        commit.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        commit.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        commit.date.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedAuthor !== 'ALL' && commit.author !== selectedAuthor) {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedAuthor]);

  const totalReleases = SYSTEM_CHANGELOG.length;
  const totalCommitsCount = GIT_COMMIT_LOGS.length;
  const firstCommitDate = GIT_COMMIT_LOGS[GIT_COMMIT_LOGS.length - 1]?.date ?? '2026-07-23';

  return (
    <div className="min-h-screen space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Top Breadcrumb & Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-zinc-900/40 border border-purple-500/20 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
            <Link href="/dashboard" className="hover:underline flex items-center gap-1 text-zinc-400 hover:text-zinc-200">
              <span>🏠 Dashboard</span>
            </Link>
            <span>/</span>
            <span className="text-purple-400">📜 Log Update & System Changelog</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  📜 Log Update & Changelog
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>KIAN {latestVersion}</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
                Catatan resmi pembaruan rilis semantik (v1.0.0 &ndash; {latestVersion}) dan riwayat commit asli langsung dari repositori master GitHub KIAN HQ.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3.5 py-2 rounded-2xl border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Production Live</span>
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-purple-500/15">
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl p-3.5 border border-zinc-200/60 dark:border-zinc-800/60">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Versi Terbaru</p>
              <p className="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">{latestVersion}</p>
            </div>
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl p-3.5 border border-zinc-200/60 dark:border-zinc-800/60">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Git Commit</p>
              <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{totalCommitsCount} Commits</p>
            </div>
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl p-3.5 border border-zinc-200/60 dark:border-zinc-800/60">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Milestone Release</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{totalReleases} Rilis Utama</p>
            </div>
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl p-3.5 border border-zinc-200/60 dark:border-zinc-800/60">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pertama Dipublikasi</p>
              <p className="text-sm font-black text-zinc-800 dark:text-zinc-200 mt-1">v1.0.0 ({firstCommitDate})</p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => { setActiveTab('RELEASES'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'RELEASES'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          <span>⭐ Versi Rilis Semantik ({totalReleases})</span>
        </button>
        <button
          onClick={() => { setActiveTab('GIT_COMMITS'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'GIT_COMMITS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          <span>🌿 Master Git Commit History ({totalCommitsCount})</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800/80 p-3.5 rounded-2xl shadow-xs">
        {/* Category / Author Pills */}
        {activeTab === 'RELEASES' ? (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'Semua Release' },
              { id: 'MAJOR', label: '⭐ Versi Major' },
              { id: 'FEATURE', label: '✨ Fitur Baru' },
              { id: 'FIX', label: '🐛 Bug Fixes' },
              { id: 'UI_UX', label: '🎨 UI & UX' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-[11px] font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[10px] font-black text-zinc-400 uppercase mr-1 shrink-0">Author:</span>
            <button
              onClick={() => setSelectedAuthor('ALL')}
              className={`text-[11px] font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
                selectedAuthor === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              Semua Contributor
            </button>
            {uniqueAuthors.map((author) => (
              <button
                key={author}
                onClick={() => setSelectedAuthor(author)}
                className={`text-[11px] font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
                  selectedAuthor === author
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                👤 {author}
              </button>
            ))}
          </div>
        )}

        {/* Search Input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'RELEASES' ? "Cari versi atau fitur..." : "Cari commit hash / pesan..."}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl pl-9 pr-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Content Tab 1: Semantic Releases */}
      {activeTab === 'RELEASES' && (
        <div className="space-y-6 relative before:absolute before:inset-0 before:left-6 sm:before:left-8 before:w-0.5 before:bg-gradient-to-b before:from-purple-500 before:via-indigo-500/30 before:to-transparent">
          {filteredReleases.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/20">
              <p className="text-base font-bold text-zinc-600 dark:text-zinc-400">Tidak ada log update yang sesuai pencarian.</p>
              <p className="text-xs text-zinc-400 mt-1">Coba sesuaikan kata kunci atau filter kategori Anda.</p>
            </div>
          ) : (
            filteredReleases.map((item) => {
              return (
                <div key={item.id} className="relative pl-12 sm:pl-16 group">
                  {/* Timeline node icon */}
                  <div
                    className={`absolute left-3.5 sm:left-5 top-5 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border shadow-md transition-transform duration-300 group-hover:scale-125 ${
                      item.isLatest
                        ? 'bg-purple-600 border-purple-400 text-white ring-4 ring-purple-500/20'
                        : item.type === 'MAJOR'
                        ? 'bg-amber-500 border-amber-300 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-500'
                    }`}
                  >
                    {item.isLatest ? '⚡' : item.type === 'MAJOR' ? '⭐' : '📜'}
                  </div>

                  {/* Card item */}
                  <div
                    className={`bg-white dark:bg-[#09090b]/70 border rounded-3xl p-6 shadow-sm transition-all duration-300 hover:shadow-xl ${
                      item.isLatest
                        ? 'border-purple-500/40 ring-1 ring-purple-500/20 shadow-purple-500/5'
                        : 'border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    {/* Header info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-4 mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-xl border border-purple-500/20">
                            {item.version}
                          </span>
                          {item.isLatest && (
                            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                              ✨ Latest Release
                            </span>
                          )}
                          {item.type === 'MAJOR' && (
                            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                              ⭐ Major Release
                            </span>
                          )}
                        </div>
                        <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 pt-1">
                          {item.title}
                        </h2>
                      </div>

                      <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 font-mono self-start sm:self-center shrink-0">
                        📅 {item.date}
                      </span>
                    </div>

                    {/* Summary */}
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                      {item.summary}
                    </p>

                    {/* Changes List */}
                    <div className="space-y-2.5 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800/50">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                        Rincian Perubahan & Peningkatan:
                      </p>
                      <div className="space-y-2">
                        {item.changes.map((change, idx) => {
                          const isFeature = change.category.includes('Feature');
                          const isFix = change.category.includes('Fix');
                          const isUI = change.category.includes('UI');
                          const categoryStyle = isFeature
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : isFix
                            ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                            : isUI
                            ? 'text-pink-600 dark:text-pink-400 bg-pink-500/10 border-pink-500/20'
                            : 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20';

                          return (
                            <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 mt-0.5 ${categoryStyle}`}>
                                {change.category}
                              </span>
                              <span className="leading-relaxed flex-1 font-medium">{change.description}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Content Tab 2: Raw Git Commit History */}
      {activeTab === 'GIT_COMMITS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-zinc-500">
              Menampilkan {filteredCommits.length} dari {GIT_COMMIT_LOGS.length} total git commit master:
            </span>
          </div>

          {filteredCommits.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/20">
              <p className="text-base font-bold text-zinc-600 dark:text-zinc-400">Tidak ada git commit yang cocok.</p>
              <p className="text-xs text-zinc-400 mt-1">Coba sesuaikan kata kunci pencarian Anda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCommits.map((commit, idx) => {
                const msgLower = commit.message.toLowerCase();
                const isFeat = msgLower.startsWith('feat');
                const isFix = msgLower.startsWith('fix');
                const isStyle = msgLower.startsWith('style') || msgLower.startsWith('refactor');
                const isChore = msgLower.startsWith('chore') || msgLower.startsWith('ci');

                const commitTypeStyle = isFeat
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : isFix
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : isStyle
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';

                return (
                  <div
                    key={commit.hash + idx}
                    className="p-4 rounded-2xl bg-white dark:bg-[#09090b]/80 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-indigo-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <span className="font-mono text-xs font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-xl shrink-0">
                        {commit.hash}
                      </span>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.2 rounded-md border ${commitTypeStyle}`}>
                            {isFeat ? '✨ FEAT' : isFix ? '🐛 FIX' : isStyle ? '🎨 UI/REF' : isChore ? '⚙️ CHORE' : '📝 COMMIT'}
                          </span>
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {commit.message}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-xs text-zinc-400 dark:text-zinc-500 font-medium pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-900">
                      <span className="flex items-center gap-1">
                        <span>👤</span>
                        <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{commit.author}</strong>
                      </span>
                      <span>•</span>
                      <span className="font-mono">{commit.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
