import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import AuthForm from '@/modules/auth/components/AuthForm';
import ThemeToggle from '@/modules/theme/components/ThemeToggle';

export default async function Home() {
  const session = await getSession();

  // If already authenticated, redirect to the dashboard
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#030303] text-zinc-900 dark:text-white font-sans flex flex-col justify-between selection:bg-purple-500 selection:text-white relative overflow-hidden transition-colors duration-300">
      {/* Dynamic Glowing Blur Backgrounds */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-purple-900/5 dark:bg-purple-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/5 dark:bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 sm:px-8 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 bg-clip-text text-transparent">
            KIAN HQ
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/50 font-bold tracking-wider">
            V1.2
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-xs text-zinc-400 dark:text-zinc-500 font-bold tracking-wider uppercase hidden sm:block">
            Local Security Active
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-6 sm:px-8 py-12 flex flex-col lg:flex-row items-center justify-center gap-16 lg:gap-24 flex-1 z-10">
        {/* Left Hero Description */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/10 dark:border-purple-500/20 bg-purple-500/5 text-purple-600 dark:text-purple-400 text-xs font-bold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Local credentials mode active
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.08] mb-6 bg-gradient-to-b from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Think Less.<br /> Create More.
          </h1>

          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6 font-medium">
            KIAN HQ is a locked-principles creative team operating system. 
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Collaborate on content briefs, track projects, manage timelines, and submit task deliverables through direct links, all backed by D1 SQLite and KV caching.
          </p>
        </div>

        {/* Right Auth Form */}
        <div className="w-full max-w-md flex justify-center">
          <AuthForm />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-6 sm:px-8 py-8 border-t border-zinc-200 dark:border-zinc-900/60 flex flex-col sm:flex-row justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 gap-4 z-10">
        <div>
          &copy; {new Date().getFullYear()} Kian HQ. Under Architecture Freeze Agreement v1.2.
        </div>
        <div className="flex gap-6 font-bold tracking-wider uppercase text-[10px] text-zinc-500 dark:text-zinc-400">
          <span className="hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-default">D1 SQL Storage</span>
          <span className="hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-default">Local Keys</span>
          <span className="hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-default">Edge Native</span>
        </div>
      </footer>
    </div>
  );
}

export const dynamic = 'force-dynamic';
