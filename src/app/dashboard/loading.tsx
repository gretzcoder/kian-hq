export default function DashboardLoading() {
  return (
    <div className="w-full min-h-[70vh] flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-200">
      {/* Aesthetic Brand Spinner with Centered KIAN Logo */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute inset-0 rounded-full bg-purple-500/20 dark:bg-purple-500/25 blur-xl animate-pulse pointer-events-none" />
        
        {/* Outer Orbiting Arc Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-zinc-200/40 dark:border-zinc-800/40 border-t-purple-600 dark:border-t-purple-400 animate-spin" />
        
        {/* Inner Counter-Orbiting Arc Ring */}
        <div className="absolute inset-2 rounded-full border-2 border-zinc-200/30 dark:border-zinc-800/30 border-b-pink-500 dark:border-b-pink-400 animate-[spin_1.5s_linear_infinite_reverse]" />

        {/* Crisp Center Logo Badge */}
        <div className="relative z-10 w-8 h-8 flex items-center justify-center">
          <img
            src="/icon.svg?v=5"
            alt="Kian HQ"
            className="w-full h-full object-contain drop-shadow-md select-none"
          />
        </div>
      </div>

      {/* Elegant Brand Loading Label */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-[10px] font-black tracking-[0.35em] text-zinc-400 dark:text-zinc-500 uppercase text-center pl-[0.35em] select-none">
          JUST A MOMENT
        </p>
      </div>
    </div>
  );
}
