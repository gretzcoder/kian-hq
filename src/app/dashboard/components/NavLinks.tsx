'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLinksProps {
  canManage: boolean;
}

export function NavLinks({ canManage }: NavLinksProps) {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Dashboard', exact: true },
    { href: '/dashboard/projects', label: 'Projects', exact: false },
    { href: '/dashboard/announcements', label: 'Announcements', exact: false },
    { href: '/dashboard/kb', label: 'Knowledge Base', exact: false },
    { href: '/dashboard/ai', label: 'AI Assistant', exact: false },
    { href: '/dashboard/analytics', label: 'Analytics', exact: false },
    ...(canManage ? [
      { href: '/dashboard/users', label: 'Users', exact: false },
      { href: '/dashboard/permissions', label: 'Permissions', exact: false },
    ] : []),
  ];

  return (
    <nav className="hidden md:flex items-center gap-1.5 text-sm font-bold">
      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${
              isActive
                ? 'bg-purple-500/10 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400 font-extrabold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/40'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavLinks({ canManage }: NavLinksProps) {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: '🏠', exact: true },
    { href: '/dashboard/projects', label: 'Projects', exact: false },
    { href: '/dashboard/announcements', label: 'Updates', exact: false },
    { href: '/dashboard/kb', label: 'KB', exact: false },
    { href: '/dashboard/ai', label: 'AI', exact: false },
    { href: '/dashboard/analytics', label: 'Analytics', exact: false },
    ...(canManage ? [
      { href: '/dashboard/users', label: 'Users', exact: false },
      { href: '/dashboard/permissions', label: 'Perms', exact: false },
    ] : []),
  ];

  return (
    <div className="md:hidden border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-[#09090b] px-4 py-2.5 flex items-center justify-around text-xs font-bold shadow-sm dark:shadow-none overflow-x-auto gap-1">
      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-lg transition-all duration-150 shrink-0 ${
              isActive
                ? 'bg-purple-500/10 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400 font-extrabold'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
