'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  SYSTEM_CHANGELOG,
  GIT_COMMIT_LOGS,
  getLatestSystemVersion,
} from '@/lib/changelog';

export default function ChangelogPage() {
  const latestVersion = getLatestSystemVersion();
  const [activeTab, setActiveTab] = useState<'RELEASES' | 'GIT_COMMITS'>('RELEASES');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const [commits, setCommits] = useState<{ id: string; message: string; date: string }[]>(
    GIT_COMMIT_LOGS.map((c) => ({ id: c.hash, message: c.message, date: c.date }))
  );
  const [isLiveSync, setIsLiveSync] = useState(false);

  useEffect(() => {
    fetch('/api/github/commits')
      .then((res) => res.json())
      .then((data: any) => {
        if (data && data.success && Array.isArray(data.commits) && data.commits.length > 0) {
          setCommits(data.commits);
          if (data.source === 'github_live') {
            setIsLiveSync(true);
          }
        }
      })
      .catch(() => {});
  }, []);

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

  // Filter git commits
  const filteredCommits = useMemo(() => {
    return commits.filter((commit) => {
      const matchesSearch =
        commit.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        commit.date.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [searchQuery, commits]);

  const totalReleases = SYSTEM_CHANGELOG.length;
  const totalCommitsCount = commits.length;
  const firstCommitDate = commits[commits.length - 1]?.date ?? '2026-07-23';

  return (
    <div className="min-h-screen space-y-5 sm:space-y-6 pb-12 max-w-6xl mx-auto px-1 sm:px-0">
      {/* Top Breadcrumb & Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-zinc-900/40 border border-purple-500/20 p-4 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-400 flex-wrap">
            <Link href="/dashboard" className="hover:underline flex items-center gap-1 text-zinc-400 hover:text-zinc-200">
              <span>🏠 Dashboard</span>
            </Link>
            <span>/</span>
            <span className="text-purple-400 truncate">📜 Log Update & System Changelog</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h1 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-snug">
                  📜 Log Update & Changelog
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-xs shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>KIAN {latestVersion}</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
                Catatan resmi pembaruan fitur, perbaikan sistem, dan riwayat perkembangan aplikasi KIAN HQ.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{isLiveSync ? '🟢 GitHub Live Track' : 'Production Live'}</span>
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-purple-500/15">
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl p-2.5 sm:p-3.5 border border-zinc-200/60 dark:border-zinc-800/60 min-w-0">
              <p className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">Versi Terbaru</p>
              <p className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5 truncate">{latestVersion}</p>
            </div>
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl p-2.5 sm:p-3.5 border border-zinc-200/60 dark:border-zinc-800/60 min-w-0">
              <p className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">Total Pembaruan</p>
              <p className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">{totalCommitsCount} Update</p>
            </div>
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl p-2.5 sm:p-3.5 border border-zinc-200/60 dark:border-zinc-800/60 min-w-0">
              <p className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">Versi Rilis</p>
              <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">{totalReleases} Versi Utama</p>
            </div>
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl p-2.5 sm:p-3.5 border border-zinc-200/60 dark:border-zinc-800/60 min-w-0">
              <p className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">Pertama Dirilis</p>
              <p className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200 mt-1 truncate">v1.0.0 ({firstCommitDate})</p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => { setActiveTab('RELEASES'); setSearchQuery(''); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl font-black text-xs transition-all shrink-0 whitespace-nowrap cursor-pointer ${
            activeTab === 'RELEASES'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          <span>⭐ Rilis Versi Utama ({totalReleases})</span>
        </button>
        <button
          onClick={() => { setActiveTab('GIT_COMMITS'); setSearchQuery(''); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl font-black text-xs transition-all shrink-0 whitespace-nowrap cursor-pointer ${
            activeTab === 'GIT_COMMITS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          <span>📜 Riwayat Pembaruan Detail ({totalCommitsCount})</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800/80 p-3 sm:p-3.5 rounded-2xl shadow-xs">
        {/* Category Pills */}
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
                className={`text-[11px] font-bold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
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
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>GitHub Live Repository Updates</span>
            </span>
          </div>
        )}

        {/* Search Input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'RELEASES' ? "Cari versi atau fitur..." : "Cari catatan pembaruan..."}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl pl-9 pr-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Content Tab 1: Semantic Releases */}
      {activeTab === 'RELEASES' && (
        <div className="space-y-5 sm:space-y-6 relative before:absolute before:inset-0 before:left-3.5 sm:before:left-8 before:w-0.5 before:bg-gradient-to-b before:from-purple-500 before:via-indigo-500/30 before:to-transparent">
          {filteredReleases.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/20">
              <p className="text-sm sm:text-base font-bold text-zinc-600 dark:text-zinc-400">Tidak ada log update yang sesuai pencarian.</p>
              <p className="text-xs text-zinc-400 mt-1">Coba sesuaikan kata kunci atau filter kategori Anda.</p>
            </div>
          ) : (
            filteredReleases.map((item) => {
              return (
                <div key={item.id} className="relative pl-8 sm:pl-16 group">
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
                    className={`bg-white dark:bg-[#09090b]/70 border rounded-3xl p-4 sm:p-6 shadow-sm transition-all duration-300 hover:shadow-xl ${
                      item.isLatest
                        ? 'border-purple-500/40 ring-1 ring-purple-500/20 shadow-purple-500/5'
                        : 'border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    {/* Header info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-3 sm:pb-4 mb-3 sm:mb-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-xl border border-purple-500/20">
                            {item.version}
                          </span>
                          {item.isLatest && (
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                              ✨ Latest Release
                            </span>
                          )}
                          {item.type === 'MAJOR' && (
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                              ⭐ Major Release
                            </span>
                          )}
                        </div>
                        <h2 className="text-sm sm:text-lg font-black text-zinc-900 dark:text-zinc-100 pt-1 leading-snug break-words">
                          {item.title}
                        </h2>
                      </div>

                      <span className="text-[11px] sm:text-xs font-bold text-zinc-400 dark:text-zinc-500 font-mono self-start sm:self-center shrink-0">
                        📅 {item.date}
                      </span>
                    </div>

                    {/* Summary */}
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3 sm:mb-4">
                      {item.summary}
                    </p>

                    {/* Changes List */}
                    <div className="space-y-2 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl p-3 sm:p-4 border border-zinc-100 dark:border-zinc-800/50">
                      <p className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
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
                            <div key={idx} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shrink-0 mt-0.5 ${categoryStyle}`}>
                                {change.category}
                              </span>
                              <span className="leading-relaxed flex-1 font-medium text-xs break-words">{change.description}</span>
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

      {/* Content Tab 2: Detail Updates List */}
      {activeTab === 'GIT_COMMITS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] sm:text-xs font-bold text-zinc-500">
              Menampilkan {filteredCommits.length} dari {commits.length} total catatan pembaruan:
            </span>
          </div>

          {filteredCommits.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/20">
              <p className="text-sm sm:text-base font-bold text-zinc-600 dark:text-zinc-400">Tidak ada pembaruan yang cocok.</p>
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
                    key={commit.id + idx}
                    className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#09090b]/80 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-indigo-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${commitTypeStyle}`}>
                        {isFeat ? '✨ FITUR' : isFix ? '🐛 FIX' : isStyle ? '🎨 TAMPILAN' : isChore ? '⚙️ SISTEM' : '📝 UPDATE'}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 break-words leading-relaxed flex-1">
                        {commit.message}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-medium font-mono self-end sm:self-center">
                      <span>📅</span>
                      <span>{commit.date}</span>
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
