'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUserBadgesAction } from '@/modules/badges/badgeActions';
import { BadgeItem, CATEGORY_META } from '@/modules/badges/badgeTypes';
import { UserAvatar } from '@/components/ui/UserAvatar';

export interface UserProfileData {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  userType?: string | null;
  role_name?: string | null;
  role_color?: string | null;
  is_online?: boolean;
}

interface UserProfileModalProps {
  user: UserProfileData | null;
  onClose: () => void;
  onMention?: (name: string) => void;
}

export function UserProfileModal({ user, onClose, onMention }: UserProfileModalProps) {
  const [memberBadges, setMemberBadges] = useState<BadgeItem[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setLoadingBadges(true);
      getUserBadgesAction(user.id)
        .then((b) => setMemberBadges(b))
        .catch(() => setMemberBadges([]))
        .finally(() => setLoadingBadges(false));
    } else {
      setMemberBadges([]);
    }
  }, [user?.id]);

  if (!user) return null;

  const roleColor = user.role_color || (user.userType === 'STAFF' ? '#8b5cf6' : user.userType === 'OJT' ? '#3b82f6' : '#7c3aed');
  const roleTitle = user.role_name || (user.userType === 'STAFF' ? 'Staff / Admin' : user.userType === 'OJT' ? 'Trooper OJT' : 'Anggota Tim');

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-[#09090b] rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-150 relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Banner Gradient */}
        <div
          className="h-28 w-full relative p-3"
          style={{
            backgroundImage: `linear-gradient(to right, ${roleColor}, #6366f1, #ec4899)`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Avatar Overlapping Header */}
        <div className="px-6 relative pb-6">
          <div className="-mt-12 mb-3 flex items-end justify-between">
            <div className="relative">
              <UserAvatar
                src={user.avatar_url}
                name={user.name}
                size="lg"
                square
                className="ring-4 ring-white dark:ring-[#09090b] shadow-xl rounded-2xl"
              />
              {user.is_online !== undefined && (
                <span
                  className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-[#09090b] ${
                    user.is_online
                      ? 'bg-emerald-500 ring-2 ring-emerald-400'
                      : 'bg-zinc-400'
                  }`}
                />
              )}
            </div>

            <span
              className="px-3.5 py-1 rounded-full text-xs font-extrabold text-white shadow-sm"
              style={{ backgroundColor: roleColor }}
            >
              {roleTitle}
            </span>
          </div>

          {/* Member Details */}
          <div className="space-y-1">
            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 leading-snug">
              <span>{user.name}</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              {user.email}
            </p>
          </div>

          {/* Activity Status Card (if online status available) */}
          {user.is_online !== undefined && (
            <div className="mt-3.5 p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1.5">
              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                Status Kehadiran
              </p>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    user.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                  }`}
                />
                <span
                  className={
                    user.is_online
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-zinc-500'
                  }
                >
                  {user.is_online
                    ? 'Sedang Online (Aktif di System)'
                    : 'Offline / Tidak Aktif'}
                </span>
              </div>
            </div>
          )}

          {/* Badges Section */}
          <div className="mt-3.5 p-3.5 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/15 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <span>🏅</span> Pencapaian Badge ({memberBadges.length})
              </p>
              <Link
                href="/dashboard/badges"
                onClick={onClose}
                className="text-[9px] font-bold text-purple-500 hover:underline"
              >
                Lihat Galeri ➔
              </Link>
            </div>

            {loadingBadges ? (
              <p className="text-[10px] text-zinc-400 font-bold animate-pulse">Memuat badge...</p>
            ) : memberBadges.length === 0 ? (
              <p className="text-[10px] text-zinc-400 font-bold">Belum ada badge yang dimiliki.</p>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                {memberBadges.map((badge) => {
                  const meta = CATEGORY_META[badge.category] || CATEGORY_META.TROOPER;
                  return (
                    <div
                      key={badge.id}
                      title={`${badge.name} (${meta.label})`}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${meta.border} bg-gradient-to-r ${meta.bgGradient} shrink-0 text-xs shadow-2xs`}
                    >
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {badge.iconUrl ? (
                          <img src={badge.iconUrl} alt={badge.name} className="w-full h-full object-contain" />
                        ) : (
                          <span>{meta.icon}</span>
                        )}
                      </div>
                      <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-100 max-w-[90px] truncate">
                        {badge.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800 flex flex-col gap-2">
            <div className={`grid ${onMention ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
              {onMention && (
                <button
                  type="button"
                  onClick={() => {
                    const firstName = user.name.split(' ')[0];
                    onMention(firstName);
                    onClose();
                  }}
                  className="px-3 py-2.5 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <span>💬</span>
                  <span>Mention @{user.name.split(' ')[0]}</span>
                </button>
              )}

              <Link
                href={`/dashboard/profile?userId=${user.id}`}
                onClick={onClose}
                className="px-3 py-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all text-center active:scale-95"
              >
                <span>👤</span>
                <span>Lihat Profil Lengkap</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
