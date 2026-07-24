'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLinksProps {
  canManage:      boolean;
  canReview:      boolean;
  canCreateBrief: boolean;
  canUseAI:       boolean;
}

const activeClass =
  'bg-purple-500/10 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400 font-extrabold';
const inactiveClass =
  'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/40';

function isActive(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function NavLinks({ canManage, canReview, canCreateBrief, canUseAI }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-1.5 text-sm font-bold">
      <Link href="/dashboard" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard', true) ? activeClass : inactiveClass}`}>
        Dashboard
      </Link>
      <Link href="/dashboard/projects" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard/projects') ? activeClass : inactiveClass}`}>
        Projects
      </Link>

      {/* Workspace: always show for CREATOR; also for others */}
      <Link href="/dashboard/workspace" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard/workspace') ? activeClass : inactiveClass}`}>
        Workspace
      </Link>

      {/* Review Queue: only for COORDINATOR/EXECUTIVE */}
      {canReview && (
        <Link href="/dashboard/review" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard/review') ? activeClass : inactiveClass}`}>
          Reviews
        </Link>
      )}

      {/* Briefs: for COLLABORATOR and COORDINATOR */}
      {canCreateBrief && (
        <Link href="/dashboard/briefs" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard/briefs') ? activeClass : inactiveClass}`}>
          Briefs
        </Link>
      )}

      <Link href="/dashboard/announcements" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard/announcements') ? activeClass : inactiveClass}`}>
        Updates
      </Link>
      <Link href="/dashboard/kb" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard/kb') ? activeClass : inactiveClass}`}>
        KB
      </Link>

      {/* AI: gated by USE_AI permission */}
      {canUseAI && (
        <Link href="/dashboard/ai" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard/ai') ? activeClass : inactiveClass}`}>
          AI
        </Link>
      )}

      <Link href="/dashboard/analytics" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard/analytics') ? activeClass : inactiveClass}`}>
        Analytics
      </Link>

      {/* Admin: MANAGE only */}
      {canManage && (
        <>
          <Link href="/dashboard/users" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard/users') ? activeClass : inactiveClass}`}>
            Users
          </Link>
          <Link href="/dashboard/permissions" className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${isActive(pathname, '/dashboard/permissions') ? activeClass : inactiveClass}`}>
            Permissions
          </Link>
        </>
      )}
    </nav>
  );
}

export function MobileNavLinks({ canManage, canReview, canCreateBrief, canUseAI }: NavLinksProps) {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard',              label: '🏠',        exact: true  },
    { href: '/dashboard/projects',     label: 'Projects',  exact: false },
    { href: '/dashboard/workspace',    label: 'Workspace', exact: false },
    ...(canReview      ? [{ href: '/dashboard/review',        label: 'Reviews',  exact: false }] : []),
    ...(canCreateBrief ? [{ href: '/dashboard/briefs',        label: 'Briefs',   exact: false }] : []),
    { href: '/dashboard/announcements',label: 'Updates',   exact: false },
    { href: '/dashboard/kb',           label: 'KB',        exact: false },
    ...(canUseAI  ? [{ href: '/dashboard/ai',          label: 'AI',       exact: false }] : []),
    { href: '/dashboard/analytics',    label: 'Analytics', exact: false },
    ...(canManage ? [
      { href: '/dashboard/users',       label: 'Users', exact: false },
      { href: '/dashboard/permissions', label: 'Perms', exact: false },
    ] : []),
  ];

  return (
    <div className="md:hidden border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-[#09090b] px-4 py-2.5 flex items-center justify-around text-xs font-bold shadow-sm dark:shadow-none overflow-x-auto gap-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-3 py-1.5 rounded-lg transition-all duration-150 shrink-0 ${
            isActive(pathname, link.href, link.exact) ? activeClass : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
