'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import ThemeToggle from '@/modules/theme/components/ThemeToggle';
import { getUnreadCount } from '@/modules/announcements/announcementReadState';
import { getUnreadWorkspaceCount } from '@/modules/workspaces/workspaceReadState';
import { getSidebarCounts, WorkspaceNotifItem } from '@/modules/notifications/notificationActions';
import ViewAsRoleTrigger from '@/modules/roles/components/ViewAsRoleTrigger';
import { ViewAsRoleItem, ActiveSimulatedRole } from '@/modules/roles/viewAsRoleActions';
import { ImpersonateUserItem, stopImpersonatingUser } from '@/modules/users/impersonationActions';

// ── Badge colour map ──────────────────────────────────────────────────────────
const BADGE_BG: Record<'red' | 'amber', string> = {
  red:   'bg-red-500',
  amber: 'bg-amber-500',
};

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact: boolean;
  badge?: number;
  badgeColor?: 'red' | 'amber';
}

interface SidebarProps {
  canManageUsers:  boolean;
  canManageRoles:  boolean;
  canViewOJT?:     boolean;
  canViewProjects?: boolean;
  canReview:       boolean;
  canCreateBrief:  boolean;
  canUseAI:        boolean;
  canManageSparks?: boolean;
  isOJT?:          boolean;
  isMentor?:       boolean;
  isLocked?:       boolean;
  announcementTimestamps?: number[];
  workspaceData?:  WorkspaceNotifItem[];
  pendingReviewCount?: number;
  availableRoles?: ViewAsRoleItem[];
  availableUsers?: ImpersonateUserItem[];
  activeSimulatedRole?: ActiveSimulatedRole | null;
  isImpersonating?: boolean;
  session: {
    name:   string;
    email:  string;
    avatar?: string | null;
  };
}

function isActive(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname.startsWith(href);
}

function BadgePill({ count, color }: { count: number; color: 'red' | 'amber' }) {
  if (count <= 0) return null;
  return (
    <span
      className={`text-[10px] font-black font-mono ${BADGE_BG[color]} text-white min-w-[20px] h-5 px-1.5 rounded-full shadow-sm animate-pulse ml-2 shrink-0 inline-flex items-center justify-center`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function CollapsedBadgeDot({ count, color }: { count: number; color: 'red' | 'amber' }) {
  if (count <= 0) return null;
  return (
    <span
      className={`min-w-[16px] h-4 text-[9px] font-black font-mono ${BADGE_BG[color]} text-white px-1 rounded-full absolute -top-1 -right-1 border-2 border-white dark:border-zinc-900 animate-pulse flex items-center justify-center`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function DashboardSidebar({
  canManageUsers,
  canManageRoles,
  canViewOJT    = false,
  canViewProjects = false,
  canReview,
  canCreateBrief,
  canUseAI,
  canManageSparks = false,
  isOJT         = false,
  isLocked      = false,
  announcementTimestamps = [],
  workspaceData  = [],
  pendingReviewCount = 0,
  availableRoles = [],
  availableUsers = [],
  activeSimulatedRole = null,
  isImpersonating = false,
  session,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  // ── Badge state ─────────────────────────────────────────────────────────────
  const [unreadCount,          setUnreadCount]          = useState(0);
  const [workspaceUnreadCount, setWorkspaceUnreadCount] = useState(0);
  const [reviewCount,          setReviewCount]          = useState(pendingReviewCount);

  // Refs hold latest data so polling callback stays stable (no re-registration)
  const annTsRef  = useRef<number[]>(announcementTimestamps);
  const wsDataRef = useRef<WorkspaceNotifItem[]>(workspaceData);

  // Recompute badge counts from current refs + localStorage
  const computeCounts = useCallback(() => {
    setUnreadCount(getUnreadCount(annTsRef.current));
    setWorkspaceUnreadCount(getUnreadWorkspaceCount(wsDataRef.current));
  }, []);

  // Run on mount + respond to localStorage "mark-read" events
  useEffect(() => {
    computeCounts();
    window.addEventListener('announcements_read', computeCounts);
    window.addEventListener('workspace_read',     computeCounts);
    window.addEventListener('storage',            computeCounts);
    return () => {
      window.removeEventListener('announcements_read', computeCounts);
      window.removeEventListener('workspace_read',     computeCounts);
      window.removeEventListener('storage',            computeCounts);
    };
  }, [computeCounts]);

  // Poll every 60 s — skip when tab is hidden to conserve D1 quota
  useEffect(() => {
    const poll = async () => {
      if (document.hidden) return;
      try {
        const counts = await getSidebarCounts();
        if (counts) {
          annTsRef.current  = counts.announcementTimestamps;
          wsDataRef.current = counts.workspaceData;
          setReviewCount(counts.pendingReviewCount);
          computeCounts();
        }
      } catch {
        // silently ignore — non-critical
      }
    };

    const interval = setInterval(poll, 60_000);
    const handleVisibility = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [computeCounts]);

  // ── Nav structure ────────────────────────────────────────────────────────────
  const isStaffWorkspaceManager =
    !isOJT && (canManageUsers || canManageRoles || canReview || canViewProjects);

  const navGroups: { title: string; items: NavItem[] }[] = [
    {
      title: 'UTAMA',
      items: [
        { href: '/dashboard',           label: 'Dashboard',   icon: '🏠', exact: true },
        ...(canViewProjects
          ? [{ href: '/dashboard/projects', label: 'Projects', icon: '📁', exact: false }]
          : []),
        {
          href: '/dashboard/workspace',
          label: isStaffWorkspaceManager ? 'Workspace' : 'My Workspace',
          icon: '⚡',
          exact: false,
          badge: workspaceUnreadCount,
          badgeColor: 'red' as const,
        },
        { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: '🏆', exact: false },
      ],
    },
    {
      title: 'KOLABORASI',
      items: [
        ...(canReview
          ? [{
              href: '/dashboard/review',
              label: 'Reviews',
              icon: '📋',
              exact: false,
              badge: reviewCount,
              badgeColor: 'amber' as const,
            }]
          : []),
        ...(canCreateBrief
          ? [{ href: '/dashboard/briefs', label: 'Content Briefs', icon: '📄', exact: false }]
          : []),
        {
          href: '/dashboard/announcements',
          label: 'Announcements',
          icon: '📢',
          exact: false,
          badge: unreadCount,
          badgeColor: 'red' as const,
        },
        { href: '/dashboard/kb', label: 'Knowledge Base', icon: '📚', exact: false },
      ],
    },
    {
      title: 'FITUR & PENGELOLAAN',
      items: [
        ...(canUseAI
          ? [{ href: '/dashboard/ai', label: 'AI Assistant', icon: '🤖', exact: false }]
          : []),
        ...(!isOJT
          ? [{ href: '/dashboard/analytics', label: 'Analytics', icon: '📊', exact: false }]
          : []),
        ...(canViewOJT
          ? [{ href: '/dashboard/ojt', label: 'OJT Directory', icon: '🎓', exact: false }]
          : []),
        ...(canManageUsers
          ? [{ href: '/dashboard/feedbacks', label: 'Kritik & Saran', icon: '💌', exact: false }]
          : []),
        ...(canManageUsers
          ? [{ href: '/dashboard/users', label: 'Users', icon: '👥', exact: false }]
          : []),
        ...(canManageRoles
          ? [{ href: '/dashboard/permissions', label: 'Permissions', icon: '🔒', exact: false }]
          : []),
        ...(canManageSparks
          ? [{ href: '/dashboard/sparks', label: 'Sparks', icon: '✨', exact: false }]
          : []),
      ],
    },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen((p) => !p)}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
          >
            ☰
          </button>
          <span className="text-base font-black tracking-widest bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent">
            KIAN HQ
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/dashboard/profile"
            className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 font-bold flex items-center justify-center text-xs border border-purple-500/20 overflow-hidden shrink-0"
          >
            {session.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.avatar} alt={session.name} className="w-full h-full object-cover" />
            ) : (
              session.name.substring(0, 2).toUpperCase()
            )}
          </Link>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 z-50 h-screen bg-white dark:bg-[#09090b] border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'left-0' : '-left-64 lg:left-0'} ${
          isLocked ? 'pointer-events-none select-none opacity-40 blur-[1px]' : ''
        }`}
      >
        {/* Logo & Collapse Toggle */}
        <div className="px-4 py-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900/60 overflow-hidden h-16 shrink-0">
          <Link
            href="/dashboard"
            onClick={(e) => {
              if (collapsed) {
                e.preventDefault();
                setCollapsed(false);
              }
            }}
            className="flex items-center gap-3 min-w-0 group"
            title={collapsed ? 'Klik Logo untuk Memperluas Navigasi' : undefined}
          >
            <span className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-purple-500/20 shrink-0 group-hover:scale-105 transition-transform duration-200">
              K
            </span>
            <span
              className={`text-lg font-black tracking-widest bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 bg-clip-text text-transparent whitespace-nowrap transition-all duration-300 ${
                collapsed ? 'opacity-0 w-0 pointer-events-none' : 'opacity-100 w-auto'
              }`}
            >
              KIAN HQ
            </span>
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="hidden lg:flex items-center justify-center w-7 h-7 rounded-xl bg-zinc-100/70 hover:bg-purple-500/10 dark:bg-zinc-900/70 dark:hover:bg-purple-500/20 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200 text-xs shrink-0 active:scale-95"
              title="Sembunyikan Navigasi"
            >
              ◀
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <div className="p-3 space-y-6 overflow-y-auto flex-1 min-h-0">
          {navGroups.map((group) => {
            if (group.items.length === 0) return null;
            return (
              <div key={group.title} className="space-y-1">
                {!collapsed && (
                  <p className="px-3 text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                    {group.title}
                  </p>
                )}
                {group.items.map((item) => {
                  const active     = isActive(pathname, item.href, item.exact);
                  const badgeCount = item.badge ?? 0;
                  const badgeColor = item.badgeColor ?? 'red';

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`relative flex items-center gap-3 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                        collapsed ? 'justify-center px-0' : 'px-3.5'
                      } ${
                        active
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="text-base shrink-0 flex items-center justify-center">
                        {item.icon}
                      </span>

                      {/* Expanded: label + inline badge */}
                      {!collapsed && (
                        <span className="truncate flex-1 flex items-center justify-between">
                          <span>{item.label}</span>
                          <BadgePill count={badgeCount} color={badgeColor} />
                        </span>
                      )}

                      {/* Collapsed: floating dot badge */}
                      {collapsed && (
                        <CollapsedBadgeDot count={badgeCount} color={badgeColor} />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* View As Role / User Trigger */}
        {((availableRoles && availableRoles.length > 0) || isImpersonating || !!activeSimulatedRole) && (
          <div className="px-2 pt-2 border-t border-zinc-100 dark:border-zinc-900/60 shrink-0 bg-white dark:bg-[#09090b]">
            <ViewAsRoleTrigger
              availableRoles={availableRoles}
              availableUsers={availableUsers}
              activeSimulatedRole={activeSimulatedRole}
              isImpersonating={isImpersonating}
              impersonatedName={session.name}
              collapsed={collapsed}
            />
          </div>
        )}

        {/* User Footer */}
        <div className="p-3 border-t border-zinc-100 dark:border-zinc-900/60 shrink-0 overflow-hidden bg-white dark:bg-[#09090b]">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <Link
              href="/dashboard/profile"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity overflow-hidden"
              title={session.name}
            >
              {session.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.avatar}
                  alt={session.name}
                  className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-sm uppercase shrink-0">
                  {session.name.substring(0, 2)}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-200 truncate leading-tight whitespace-nowrap">
                    {session.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium truncate mt-0.5 whitespace-nowrap">
                    {session.email}
                  </p>
                </div>
              )}
            </Link>

            {!collapsed && (
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                {isImpersonating && (
                  <button
                    type="button"
                    onClick={() => {
                      startTransition(async () => {
                        await stopImpersonatingUser();
                        router.refresh();
                      });
                    }}
                    title="Exit Impersonation Mode"
                    className="w-7 h-7 flex items-center justify-center rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 transition-all text-xs font-bold active:scale-95"
                  >
                    🎭✕
                  </button>
                )}
                <a
                  href="/api/auth/logout"
                  title="Keluar Akun"
                  className="w-7 h-7 flex items-center justify-center rounded-xl bg-zinc-100/70 hover:bg-red-500/10 dark:bg-zinc-900/70 dark:hover:bg-red-500/20 text-zinc-400 hover:text-red-500 transition-all duration-200 text-xs shrink-0 active:scale-95"
                >
                  ➔
                </a>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
