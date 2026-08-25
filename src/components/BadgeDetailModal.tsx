import { useState, useEffect, useTransition } from 'react';
import { BadgeItem, CATEGORY_META } from '@/modules/badges/badgeTypes';
import { deleteBadgeAction, claimBadgeSparksAction } from '@/modules/badges/badgeActions';
import { useUI } from '@/components/ui/UIProvider';
import { UserProfileModal, UserProfileData } from '@/components/UserProfileModal';
import Image from 'next/image';

interface BadgeDetailModalProps {
  badge: BadgeItem;
  isOpen: boolean;
  isManager: boolean;
  onClose: () => void;
  onEdit?: (badge: BadgeItem) => void;
  onAward?: (badge: BadgeItem) => void;
  onSuccess?: () => void;
}

export function BadgeDetailModal({
  badge,
  isOpen,
  isManager,
  onClose,
  onEdit,
  onAward,
  onSuccess,
}: BadgeDetailModalProps) {
  const { toast } = useUI();
  const [activeTab, setActiveTab] = useState<'REQUIREMENTS' | 'OWNERS'>('REQUIREMENTS');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [pendingDelete, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [localClaimed, setLocalClaimed] = useState<boolean | null>(null);
  const [selectedOwnerForProfile, setSelectedOwnerForProfile] = useState<UserProfileData | null>(null);

  useEffect(() => {
    setLocalClaimed(null);
  }, [badge.id]);

  if (!isOpen) return null;

  const catMeta = CATEGORY_META[badge.category] || CATEGORY_META.TROOPER;
  const isClaimed = localClaimed !== null ? localClaimed : badge.isSparksClaimed;

  const handleClaimSparks = async () => {
    setIsClaiming(true);
    try {
      const res = await claimBadgeSparksAction(badge.id);
      if (res.success) {
        setLocalClaimed(true);
        toast(`✓ Berhasil claim +${res.claimedSparks || badge.sparksReward} Sparks dari badge ${badge.name}!`, 'success');
        if (onSuccess) onSuccess();
      } else {
        toast(res.error || 'Gagal claim Sparks', 'error');
      }
    } catch (e: any) {
      toast(e?.message || 'Gagal claim Sparks', 'error');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleDelete = () => {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteBadgeAction(badge.id);
      if (res.success) {
        setShowConfirmDelete(false);
        onSuccess?.();
        onClose();
        if (typeof window !== 'undefined') window.location.reload();
      } else {
        setDeleteError(res.error || 'Gagal menghapus badge.');
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className={`relative p-6 bg-gradient-to-br ${catMeta.bgGradient} border-b ${catMeta.border} text-center flex flex-col items-center shrink-0`}>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center text-xs font-bold transition-all"
          >
            ✕
          </button>

          {/* Badge Icon / Logo or Eye-Catching Fallback */}
          <div className="relative mb-3 group">
            <div className="w-24 h-24 rounded-3xl bg-white/10 dark:bg-black/30 backdrop-blur-md border-2 border-white/30 dark:border-white/10 shadow-xl flex items-center justify-center p-3 transition-transform group-hover:scale-105">
              {badge.iconUrl ? (
                <img
                  src={badge.iconUrl}
                  alt={badge.name}
                  className="w-full h-full object-contain drop-shadow-md"
                  onError={(e) => {
                    // Fallback to category emoji icon if image URL fails to load
                    (e.target as HTMLElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent && !parent.querySelector('.fallback-emoji')) {
                      const span = document.createElement('span');
                      span.className = 'fallback-emoji text-5xl';
                      span.innerText = catMeta.icon;
                      parent.appendChild(span);
                    }
                  }}
                />
              ) : (
                <span className="text-5xl drop-shadow-lg animate-pulse">{catMeta.icon}</span>
              )}
            </div>

            {badge.isOwned && (
              <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md border-2 border-white dark:border-zinc-900 flex items-center gap-1">
                ✓ Owned
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border bg-white/40 dark:bg-black/40 ${catMeta.border} ${catMeta.textGradient}`}>
              {catMeta.label}
            </span>
            {badge.isContinuousEarning && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center gap-1 font-mono">
                <span>🔄 Continuous Earning</span>
                {badge.claimCount && badge.claimCount > 1 ? `(${badge.claimCount}x)` : ''}
              </span>
            )}
            {badge.sparksReward > 0 && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">
                ✨ +{badge.sparksReward} Sparks
              </span>
            )}
          </div>

          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-snug">
            {badge.name}
          </h2>

          {badge.description && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 max-w-md leading-relaxed">
              {badge.description}
            </p>
          )}

          {/* Progress / Status Bar */}
          <div className="w-full max-w-md mt-4 bg-white/50 dark:bg-black/40 border border-white/20 dark:border-white/10 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="text-left">
              <p className="text-[10px] font-black uppercase text-zinc-400">Status Anda</p>
              <p className="font-bold text-zinc-900 dark:text-zinc-100">
                {badge.isOwned
                  ? `✅ Dimiliki (${badge.awardedAt ? new Date(badge.awardedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : 'Terbuka'})`
                  : badge.progressPercent > 0
                  ? `⏳ Progress (${badge.progressPercent}%)`
                  : '🔒 Belum Dimiliki'}
              </p>
            </div>
            <div className="text-right font-mono">
              <p className="text-[10px] font-black uppercase text-zinc-400">Pemilik Badge</p>
              <p className="font-black text-purple-600 dark:text-purple-400">
                👥 {badge.totalOwners} Users
              </p>
            </div>
          </div>

          {/* Claim Sparks Action Section */}
          {badge.isOwned && badge.sparksReward > 0 && (
            <div className="w-full max-w-md mt-3">
              {isClaimed ? (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-between text-xs font-extrabold shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✅</span>
                    <span>Status Sparks: Sudah Di-claim</span>
                  </div>
                  <span className="font-mono text-emerald-500 font-black">+{badge.sparksReward} ✨</span>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-3 text-xs shadow-sm">
                  <div className="text-left">
                    <p className="font-black text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <span>✨</span> Reward Sparks Tersedia!
                    </p>
                    <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 font-bold mt-0.5">
                      Klaim bonus +{badge.sparksReward} Sparks dari badge ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClaimSparks}
                    disabled={isClaiming}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-white font-black text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    <span>{isClaiming ? '⏳ Claiming...' : `✨ Claim +${badge.sparksReward} Sparks`}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('REQUIREMENTS')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'REQUIREMENTS'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-[#09090b]'
                : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            📋 Syarat Kelayakan ({badge.requirements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('OWNERS')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'OWNERS'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-[#09090b]'
                : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            👥 Daftar Pemilik ({badge.owners.length})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'REQUIREMENTS' && (
            <div className="space-y-3">
              {badge.requirementType === 'NONE' || badge.requirements.length === 0 ? (
                <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/15 text-center space-y-1">
                  <span className="text-2xl">✨</span>
                  <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300">
                    Badge Eksklusif / Diberikan Manual
                  </h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Badge ini tidak memerlukan penyelesaian tugas khusus dan diberikan secara langsung oleh Management / Mentor kepada anggota yang berprestasi.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    Target {badge.requirementType === 'TASK' ? 'Tugas' : 'Workspace'} yang Harus Selesai
                  </p>
                  {badge.requirements.map((req) => (
                    <div
                      key={req.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all ${
                        req.completed
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                          : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{req.completed ? '✅' : '⏳'}</span>
                        <span className="font-bold truncate">{req.title}</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 font-mono ${
                        req.completed
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                      }`}>
                        {req.statusText}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'OWNERS' && (
            <div className="space-y-3">
              {badge.owners.length === 0 ? (
                <div className="p-8 text-center space-y-2 text-zinc-400">
                  <span className="text-3xl opacity-60">🛡️</span>
                  <p className="text-xs font-bold">Belum ada user yang memiliki badge ini.</p>
                  <p className="text-[10px] opacity-70">Jadilah yang pertama untuk mendapatkan badge {badge.name}!</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {badge.owners.map((owner) => (
                    <div
                      key={owner.userId}
                      onClick={() =>
                        setSelectedOwnerForProfile({
                          id: owner.userId,
                          name: owner.userName,
                          email: owner.userEmail,
                          avatar_url: owner.avatarUrl,
                          userType: owner.userType,
                        })
                      }
                      className="py-2.5 px-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:bg-purple-500/10 dark:hover:bg-purple-950/30 border border-transparent hover:border-purple-500/20 transition-all group select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden group-hover:scale-105 transition-transform shadow-xs">
                          {owner.avatarUrl ? (
                            <img src={owner.avatarUrl} alt={owner.userName} className="w-full h-full object-cover" />
                          ) : (
                            owner.userName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors flex items-center gap-1.5">
                            <span>{owner.userName}</span>
                            <span className="text-[9px] opacity-0 group-hover:opacity-100 text-purple-500 transition-opacity font-normal">👤 Popover</span>
                          </p>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                            {owner.userType || 'Trooper'} • {owner.userEmail}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-zinc-400 block">
                          {new Date(owner.awardedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[9px] font-bold text-purple-500 opacity-80 group-hover:opacity-100">
                          Lihat Profil ➔
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-all"
          >
            Tutup
          </button>

          {isManager && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAward?.(badge)}
                className="px-3.5 py-2 text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <span>🎁</span> Berikan ke User
              </button>
              <button
                type="button"
                onClick={() => onEdit?.(badge)}
                className="px-3.5 py-2 text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-xl transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <span>✏️</span> Edit
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="px-3.5 py-2 text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <span>🗑️</span> Hapus
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xl mx-auto">
              ⚠️
            </div>
            <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
              Hapus Badge Ini?
            </h3>
            <p className="text-xs text-zinc-500">
              Tindakan ini akan menghapus badge <strong>{badge.name}</strong> dan mencabut kepemilikan dari {badge.owners.length} user.
            </p>
            {deleteError && (
              <p className="text-xs text-rose-500 font-bold">{deleteError}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                disabled={pendingDelete}
                className="flex-1 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-500"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pendingDelete}
                className="flex-1 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md disabled:opacity-50"
              >
                {pendingDelete ? 'Hapus...' : 'Hapus Badge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating User Profile Modal */}
      {selectedOwnerForProfile && (
        <UserProfileModal
          user={selectedOwnerForProfile}
          onClose={() => setSelectedOwnerForProfile(null)}
        />
      )}
    </div>
  );
}
