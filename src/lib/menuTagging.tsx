'use client';

import React from 'react';
import Link from 'next/link';

export interface MenuTagInfo {
  label: string;
  path: string;
  icon: string;
}

// Map shorthand hashtags to standard menu items
export const SHORTHAND_MENU_MAP: Record<string, MenuTagInfo> = {
  '#dashboard': { label: 'Dashboard', path: '/dashboard', icon: '🏠' },
  '#projects': { label: 'Projects', path: '/dashboard/projects', icon: '📁' },
  '#workspace': { label: 'Workspace', path: '/dashboard/workspace', icon: '⚡' },
  '#my-workspace': { label: 'My Workspace', path: '/dashboard/workspace', icon: '⚡' },
  '#leaderboard': { label: 'Leaderboard', path: '/dashboard/leaderboard', icon: '🏆' },
  '#sparks-history': { label: 'Leaderboard > History Sparks', path: '/dashboard/leaderboard?tab=history', icon: '⚡' },
  '#badge': { label: 'Badge Gallery', path: '/dashboard/badges', icon: '🏅' },
  '#badges': { label: 'Badge Gallery', path: '/dashboard/badges', icon: '🏅' },
  '#community': { label: 'Community Chat', path: '/dashboard/community', icon: '💬' },
  '#messenger': { label: 'Messenger & Kontak', path: '/dashboard/friends', icon: '💬' },
  '#reviews': { label: 'Review Queue', path: '/dashboard/review', icon: '📋' },
  '#briefs': { label: 'Content Briefs', path: '/dashboard/briefs', icon: '📄' },
  '#buat-brief': { label: 'Content Briefs > Buat Brief Baru', path: '/dashboard/briefs/new', icon: '➕' },
  '#new-brief': { label: 'Content Briefs > Buat Brief Baru', path: '/dashboard/briefs/new', icon: '➕' },
  '#announcements': { label: 'Announcements', path: '/dashboard/announcements', icon: '📢' },
  '#updates': { label: 'Updates & Announcements', path: '/dashboard/announcements', icon: '📢' },
  '#kb': { label: 'Knowledge Base', path: '/dashboard/kb', icon: '📚' },
  '#knowledge-base': { label: 'Knowledge Base', path: '/dashboard/kb', icon: '📚' },
  '#knowledgebase': { label: 'Knowledge Base', path: '/dashboard/kb', icon: '📚' },
  '#ai': { label: 'AI Assistant', path: '/dashboard/ai', icon: '🤖' },
  '#ai-assistant': { label: 'AI Assistant', path: '/dashboard/ai', icon: '🤖' },
  '#analytics': { label: 'Analytics Console', path: '/dashboard/analytics', icon: '📊' },
  '#ojt': { label: 'OJT Directory', path: '/dashboard/ojt', icon: '🎓' },
  '#feedbacks': { label: 'Kritik & Saran', path: '/dashboard/feedbacks', icon: '💌' },
  '#kritik-saran': { label: 'Kritik & Saran', path: '/dashboard/feedbacks', icon: '💌' },
  '#changelog': { label: 'Log Update', path: '/dashboard/changelog', icon: '📜' },
  '#log-update': { label: 'Log Update', path: '/dashboard/changelog', icon: '📜' },
  '#users': { label: 'Users Management', path: '/dashboard/users', icon: '👥' },
  '#permissions': { label: 'Permissions & Roles', path: '/dashboard/permissions', icon: '🔒' },
  '#sparks': { label: 'Sparks Management', path: '/dashboard/sparks', icon: '✨' },
  '#profile': { label: 'Profile Saya', path: '/dashboard/profile', icon: '👤' },
  '#settings': { label: 'Settings', path: '/dashboard/settings/notifications', icon: '⚙️' },
};

function getIconForLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('dashboard')) return '🏠';
  if (l.includes('project')) return '📁';
  if (l.includes('workspace')) return '⚡';
  if (l.includes('leaderboard')) return '🏆';
  if (l.includes('badge')) return '🏅';
  if (l.includes('community')) return '💬';
  if (l.includes('messenger')) return '💬';
  if (l.includes('review')) return '📋';
  if (l.includes('brief')) return '📄';
  if (l.includes('announcement') || l.includes('update')) return '📢';
  if (l.includes('knowledge') || l.includes('kb')) return '📚';
  if (l.includes('ai')) return '🤖';
  if (l.includes('analytics')) return '📊';
  if (l.includes('ojt')) return '🎓';
  if (l.includes('kritik') || l.includes('feedback')) return '💌';
  if (l.includes('user')) return '👥';
  if (l.includes('permission') || l.includes('role')) return '🔒';
  if (l.includes('spark')) return '✨';
  if (l.includes('profile')) return '👤';
  if (l.includes('setting')) return '⚙️';
  return '📌';
}

function isImageUrl(url: string) {
  return (
    /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url) ||
    url.includes('imagedelivery.net') ||
    url.includes('cloudinary.com')
  );
}

export interface RenderOptions {
  isSelf?: boolean;
  memberList?: any[];
  onSelectMember?: (member: any) => void;
}

/**
 * Parses message text containing menu tags (#[Label](/path)), shorthand tags (#kb), @mentions, and URLs,
 * rendering them into interactive JSX components.
 */
export function parseRichMessageContent(text: string, options: RenderOptions = {}): React.ReactNode[] {
  if (!text) return [];

  // Match:
  // 1. Structured menu tags: #[Label](/path)
  // 2. User mentions: @handle
  // 3. Shorthand menu hashtags: #hashtag
  // 4. URLs: http:// or https://
  const regex = /(\#\[[^\]]+\]\([^)]+\)|@[a-zA-Z0-9_.-]+|#(?:[a-zA-Z0-9_-]+)|https?:\/\/[^\s<"']+)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // ── 1. Structured Menu Tag: #[Label](/path) ──
    if (part.startsWith('#[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/^\#\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        const label = match[1];
        const path = match[2];
        const icon = getIconForLabel(label);

        return (
          <Link
            key={index}
            href={path}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-lg text-xs font-black transition-all duration-200 active:scale-95 cursor-pointer shadow-xs border bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/25 hover:border-purple-500/50 hover:shadow-md align-baseline"
            title={`Buka menu ${label}`}
          >
            <span className="text-xs">{icon}</span>
            <span className="underline decoration-purple-400/50">{label}</span>
            <span className="text-[10px] opacity-75 font-mono">↗</span>
          </Link>
        );
      }
    }

    // ── 2. Shorthand Menu Hashtags: #knowledge-base, #dashboard, etc. ──
    if (part.startsWith('#') && !part.startsWith('#[')) {
      const tagLower = part.toLowerCase();
      const mapped = SHORTHAND_MENU_MAP[tagLower];

      if (mapped) {
        return (
          <Link
            key={index}
            href={mapped.path}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-lg text-xs font-black transition-all duration-200 active:scale-95 cursor-pointer shadow-xs border bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/25 hover:border-purple-500/50 hover:shadow-md align-baseline"
            title={`Buka menu ${mapped.label}`}
          >
            <span className="text-xs">{mapped.icon}</span>
            <span className="underline decoration-purple-400/50">{mapped.label}</span>
            <span className="text-[10px] opacity-75 font-mono">↗</span>
          </Link>
        );
      } else if (part.length > 1) {
        // Generic styled hashtag
        return (
          <span key={index} className="inline-block px-1 py-0.2 mx-0.5 rounded font-extrabold text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            {part}
          </span>
        );
      }
    }

    // ── 3. User Mentions: @handle ──
    if (part.startsWith('@') && part.length > 1) {
      const handle = part.substring(1).toLowerCase();
      const memberList = options.memberList || [];
      const matchingMember = memberList.find((m) => {
        const firstName = (m.name || '').split(' ')[0].toLowerCase();
        const fullName = (m.name || '').toLowerCase();
        const emailUser = (m.email || '').split('@')[0].toLowerCase();
        return firstName === handle || fullName === handle || emailUser === handle || fullName.startsWith(handle);
      });

      return (
        <button
          key={index}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (options.onSelectMember) {
              if (matchingMember) {
                options.onSelectMember(matchingMember);
              } else {
                options.onSelectMember({
                  id: `mention_${handle}`,
                  name: part.substring(1),
                  email: `${handle}@kian.com`,
                  role_name: 'Anggota Komunitas',
                  role_color: '#7c3aed',
                  is_online: false,
                });
              }
            }
          }}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-black transition-all active:scale-95 cursor-pointer bg-purple-500/15 text-purple-600 dark:text-purple-300 hover:bg-purple-500/25 hover:underline"
          title={`Lihat profil ${matchingMember ? matchingMember.name : part}`}
        >
          <span>@</span>
          <span>{matchingMember ? matchingMember.name.split(' ')[0] : part.substring(1)}</span>
        </button>
      );
    }

    // ── 4. URLs & Images ──
    if (part.startsWith('http://') || part.startsWith('https://')) {
      const isImg = isImageUrl(part);
      return (
        <span key={index} className="inline-block my-1 max-w-full min-w-0">
          <a
            href={part}
            target="_blank"
            rel="noreferrer"
            className="underline font-bold text-xs hover:opacity-80 transition-opacity text-blue-500 dark:text-blue-400 break-all [overflow-wrap:anywhere]"
          >
            {part} ➔
          </a>
          {isImg && (
            <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 max-w-sm shadow-md bg-zinc-950/40 group/img relative">
              <a href={part} target="_blank" rel="noreferrer" className="block relative group/zoom">
                <img
                  src={part}
                  alt="Pratinjau Gambar"
                  className="w-full max-h-64 object-cover rounded-2xl group-hover/zoom:scale-[1.02] transition-transform duration-200"
                  onError={(e) => {
                    (e.target as HTMLElement).parentElement?.parentElement?.remove();
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/zoom:opacity-100 transition-opacity p-2.5 flex items-end justify-between">
                  <span className="text-white text-[10px] font-bold truncate">Klik gambar penuh ↗</span>
                  <span className="text-white text-xs">🔍</span>
                </div>
              </a>
            </div>
          )}
        </span>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
