import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionContext } from '@/modules/roles/rbac';
import ThemeToggle from '@/modules/theme/components/ThemeToggle';
import { NavLinks, MobileNavLinks } from './components/NavLinks';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/');
  }

  // Batch-fetch all needed permission flags in one call
  const ctx = await getSessionContext(session.userId);
  const canManage      = ctx.can('MANAGE');
  const canReview      = ctx.can('APPROVE') || ctx.can('REQUEST_REVISION');
  const canCreateBrief = ctx.can('CREATE_BRIEF') || ctx.can('APPROVE_BRIEF') || ctx.can('SUBMIT_BRIEF') || ctx.can('REQUEST_CHANGES') || ctx.can('UNLOCK_BRIEF');
  const canUseAI       = ctx.can('USE_AI');
  const isOJT          = ctx.userType === 'OJT';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#030303] text-zinc-900 dark:text-zinc-100 font-sans flex flex-col transition-colors duration-350">
      {/* Top Header */}
      <header className="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-[#09090b]/85 backdrop-blur-md sticky top-0 z-40 shadow-[0_1px_2px_rgba(0,0,0,0.01)] dark:shadow-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-black tracking-widest bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent">
              KIAN HQ
            </Link>
            
            {/* Dynamic Navigation — permission-aware */}
            <NavLinks
              canManage={canManage}
              canReview={canReview}
              canCreateBrief={canCreateBrief}
              canUseAI={canUseAI}
              isOJT={isOJT}
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Profile Link */}
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              {session.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.avatar} alt={session.name} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-sm uppercase">
                  {session.name.substring(0, 2)}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs text-zinc-900 dark:text-zinc-200 font-bold leading-none">{session.name}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide mt-1.5">{session.email}</p>
              </div>
            </Link>

            {/* Theme Toggle */}
            <ThemeToggle />

            <a
              href="/api/auth/logout"
              className="text-xs border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 transition-all duration-200 font-bold text-zinc-700 dark:text-zinc-300 active:scale-[0.98]"
            >
              Logout
            </a>
          </div>
        </div>
      </header>

      {/* Dynamic Mobile Navigation Bar Client Component */}
      <MobileNavLinks
        canManage={canManage}
        canReview={canReview}
        canCreateBrief={canCreateBrief}
        canUseAI={canUseAI}
        isOJT={isOJT}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
