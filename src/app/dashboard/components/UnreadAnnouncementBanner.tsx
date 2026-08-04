'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUnreadCount } from '@/modules/announcements/announcementReadState';

interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  author_name: string | null;
  created_at: number;
}

interface UnreadAnnouncementBannerProps {
  latestAnnouncement: AnnouncementRow | null;
  announcementTimestamps?: number[];
}

export default function UnreadAnnouncementBanner({
  latestAnnouncement,
  announcementTimestamps = [],
}: UnreadAnnouncementBannerProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!latestAnnouncement) return;

    const check = () => {
      setUnreadCount(getUnreadCount(announcementTimestamps));
    };

    check();

    window.addEventListener('announcements_read', check);
    window.addEventListener('storage', check);
    return () => {
      window.removeEventListener('announcements_read', check);
      window.removeEventListener('storage', check);
    };
  }, [latestAnnouncement, announcementTimestamps]);

  if (unreadCount === 0 || !latestAnnouncement) return null;

  return (
    <div className="border border-purple-500/30 bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-purple-950/40 rounded-3xl p-5 shadow-lg shadow-purple-950/20 relative overflow-hidden backdrop-blur-md transition-all duration-300">
      {/* Glow highlight effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest bg-red-500 text-white px-2.5 py-0.5 rounded-full animate-pulse shadow-sm">
              📢 {unreadCount} Pengumuman Belum Terbaca
            </span>
            <span className="text-xs font-bold text-zinc-400">
              terbaru dari {latestAnnouncement.author_name || 'System Operator'}
            </span>
          </div>

          <h3 className="text-base font-extrabold text-zinc-100 line-clamp-1">
            {latestAnnouncement.title}
          </h3>

          <p className="text-xs text-zinc-300/80 line-clamp-1 leading-relaxed">
            {latestAnnouncement.content}
          </p>
        </div>

        <Link
          href="/dashboard/announcements"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 shrink-0"
        >
          <span>Baca Pengumuman</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
