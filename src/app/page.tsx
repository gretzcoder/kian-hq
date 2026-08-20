import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import AuthForm from '@/modules/auth/components/AuthForm';
import ThemeToggle from '@/modules/theme/components/ThemeToggle';
import HeadlineText from '@/components/HeadlineText';

export default async function Home() {
  const session = await getSession();

  // If already authenticated, redirect to the dashboard
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen min-h-[100dvh] overflow-x-hidden overflow-y-auto bg-zinc-50 dark:bg-[#030303] text-zinc-900 dark:text-white font-sans flex flex-col justify-between selection:bg-purple-500 selection:text-white relative transition-colors duration-300">
      {/* Dynamic Glowing Blur Backgrounds - strictly contained */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-purple-900/5 dark:bg-purple-900/10 blur-[130px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/5 dark:bg-indigo-900/10 blur-[130px]" />
      </div>

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 sm:px-8 py-3.5 sm:py-6 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 bg-clip-text text-transparent">
            KIAN HQ
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/50 font-bold tracking-wider">
            V1.8
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-bold tracking-wider uppercase">
            Backstage Pass
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-6 sm:px-8 py-4 sm:py-6 lg:py-12 flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-12 lg:gap-24 flex-1 z-10">
        {/* Left Hero Description */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-xl">
          <div className="hidden lg:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/10 dark:border-purple-500/20 bg-purple-500/5 text-purple-600 dark:text-purple-400 text-xs font-bold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Kreasi Inovasi Anak Nusantara
          </div>

          <HeadlineText />

          <p className="hidden lg:block text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6 font-medium">
            Kian HQ is the shared canvas where our collective imagination turns into reality.
          </p>
          <p className="hidden lg:block text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Together, we refine concepts, coordinate timelines, and craft digital experiences that leave a lasting mark.
          </p>
        </div>

        {/* Right Auth Form */}
        <div className="w-full max-w-md flex justify-center">
          <AuthForm />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-6 sm:px-8 py-3.5 sm:py-6 border-t border-zinc-200 dark:border-zinc-900/60 flex flex-col sm:flex-row justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 gap-3 sm:gap-4 z-10 shrink-0">
        <div>
          &copy; {new Date().getFullYear()} Kian HQ. Fueling creative minds.
        </div>
        <div className="flex gap-6 font-bold tracking-wider uppercase text-[10px] text-zinc-500 dark:text-zinc-400">
          <span className="hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-default">Studio Sandbox</span>
          <span className="hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-default">Safe Haven</span>
          <span className="hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-default">Frictionless Flow</span>
        </div>
      </footer>
    </div>
  );
}
