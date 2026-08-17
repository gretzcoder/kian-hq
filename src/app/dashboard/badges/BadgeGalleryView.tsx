'use client';

import { useState } from 'react';
import { BadgeCategory, BadgeItem, CATEGORY_META } from '@/modules/badges/badgeActions';
import { BadgeDetailModal } from '@/components/BadgeDetailModal';
import { CreateBadgeModal } from '@/components/CreateBadgeModal';
import { AwardBadgeModal } from '@/components/AwardBadgeModal';

interface BadgeGalleryViewProps {
  initialBadges: BadgeItem[];
  userOwnedCount: number;
  totalBadgeCount: number;
  isManager: boolean;
}

export default function BadgeGalleryView({
  initialBadges,
  userOwnedCount,
  totalBadgeCount,
  isManager,
}: BadgeGalleryViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<BadgeCategory | 'ALL'>('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'OWNED' | 'UNOWNED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);
  const [editingBadge, setEditingBadge] = useState<BadgeItem | null>(null);
  const [awardingBadge, setAwardingBadge] = useState<BadgeItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const percentOwned = totalBadgeCount > 0 ? Math.round((userOwnedCount / totalBadgeCount) * 100) : 0;

  const filteredBadges = initialBadges.filter((b) => {
    if (selectedCategory !== 'ALL' && b.category !== selectedCategory) return false;
    if (ownershipFilter === 'OWNED' && !b.isOwned) return false;
    if (ownershipFilter === 'UNOWNED' && b.isOwned) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = b.name.toLowerCase().includes(q);
      const descMatch = b.description?.toLowerCase().includes(q);
      if (!nameMatch && !descMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner & Header */}
      <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-zinc-900 border border-purple-500/20 shadow-2xl overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
              🏅 Hall of Badges & Achievements
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Pencapaian Badge
            </h1>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Kumpulkan badge kehormatan melalui penyelesaian tugas, keikutsertaan event, kontribusi client, serta prestasi luar biasa di KIAN HQ.
            </p>
          </div>

          {/* Stats Progress Card */}
          <div className="bg-white/10 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-3xl p-5 shrink-0 space-y-3 min-w-[260px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300">Pencapaian Anda</span>
              <span className="text-xs font-black text-purple-400 font-mono">{percentOwned}%</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white">{userOwnedCount}</span>
              <span className="text-sm font-bold text-zinc-400">/ {totalBadgeCount} Badge</span>
            </div>
            <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all duration-500"
                style={{ width: `${percentOwned}%` }}
              />
            </div>
            {isManager && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                <span>✨ Buat Badge Baru</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Controls & Search */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              👥 Semua Kategori
            </button>
            {(Object.keys(CATEGORY_META) as BadgeCategory[]).map((cat) => {
              const meta = CATEGORY_META[cat];
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? `bg-gradient-to-r ${meta.bgGradient} ${meta.border} text-zinc-900 dark:text-zinc-100 ring-2 ring-purple-500/40 shadow-sm`
                      : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search & Ownership Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama badge..."
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500"
            />
            <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setOwnershipFilter('ALL')}
                className={`px-3 py-1 rounded-xl transition-all ${ownershipFilter === 'ALL' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-400'}`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setOwnershipFilter('OWNED')}
                className={`px-3 py-1 rounded-xl transition-all ${ownershipFilter === 'OWNED' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-400'}`}
              >
                ✅ Dimiliki
              </button>
              <button
                type="button"
                onClick={() => setOwnershipFilter('UNOWNED')}
                className={`px-3 py-1 rounded-xl transition-all ${ownershipFilter === 'UNOWNED' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-400'}`}
              >
                🔒 Belum
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Badge Grid */}
      {filteredBadges.length === 0 ? (
        <div className="p-12 text-center bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-3">
          <span className="text-4xl opacity-50">🛡️</span>
          <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-300">
            Belum Ada Badge Ditemukan
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'ALL' || ownershipFilter !== 'ALL'
              ? 'Tidak ada badge yang cocok dengan kriteria pencarian atau filter Anda.'
              : 'Belum ada badge yang dibuat oleh Admin/Koordinator.'}
          </p>
          {isManager && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-xs font-bold bg-purple-600 text-white rounded-xl shadow-md hover:bg-purple-500 transition-all inline-flex items-center gap-1.5"
            >
              <span>✨ Buat Badge Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => {
            const meta = CATEGORY_META[badge.category] || CATEGORY_META.TROOPER;
            return (
              <div
                key={badge.id}
                onClick={() => setSelectedBadge(badge)}
                className={`group relative p-5 rounded-3xl border ${meta.border} bg-white dark:bg-[#09090b] hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                  badge.isOwned ? 'ring-1 ring-emerald-500/30' : 'opacity-90 hover:opacity-100'
                }`}
              >
                {/* Background glow gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${meta.bgGradient} opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none`} />

                <div>
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-white/50 dark:bg-black/50 ${meta.border} ${meta.textGradient}`}>
                      {meta.label}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      badge.isOwned
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700'
                    }`}>
                      {badge.isOwned ? '✅ Dimiliki' : '🔒 Belum'}
                    </span>
                  </div>

                  {/* Icon & Name */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-2 shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                      {badge.iconUrl ? (
                        <img
                          src={badge.iconUrl}
                          alt={badge.name}
                          className="w-full h-full object-contain drop-shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent && !parent.querySelector('.fallback-emoji')) {
                              const span = document.createElement('span');
                              span.className = 'fallback-emoji text-3xl';
                              span.innerText = meta.icon;
                              parent.appendChild(span);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-3xl drop-shadow-xs">{meta.icon}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2 leading-snug">
                        {badge.name}
                      </h3>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                        👥 {badge.totalOwners} Pemilik
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {badge.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-4">
                      {badge.description}
                    </p>
                  )}
                </div>

                {/* Bottom Progress Bar & Action CTA */}
                <div className="space-y-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 mt-2">
                  {!badge.isOwned && badge.requirements.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-zinc-400">
                        <span>Progress</span>
                        <span className="font-mono">{badge.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${badge.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-bold text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Lihat Syarat & Pemilik</span>
                    <span>➔</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Modals */}
      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge}
          isOpen={!!selectedBadge}
          isManager={isManager}
          onClose={() => setSelectedBadge(null)}
          onEdit={(b) => { setSelectedBadge(null); setEditingBadge(b); }}
          onAward={(b) => { setSelectedBadge(null); setAwardingBadge(b); }}
          onSuccess={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      )}

      {showCreateModal && (
        <CreateBadgeModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      )}

      {editingBadge && (
        <CreateBadgeModal
          editBadge={editingBadge}
          isOpen={!!editingBadge}
          onClose={() => setEditingBadge(null)}
          onSuccess={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      )}

      {awardingBadge && (
        <AwardBadgeModal
          badge={awardingBadge}
          isOpen={!!awardingBadge}
          onClose={() => setAwardingBadge(null)}
          onSuccess={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      )}
    </div>
  );
}
