export default function DashboardLoading() {
  return (
    <div className="w-full min-h-[70vh] flex flex-col items-center justify-center space-y-3.5 animate-in fade-in duration-200">
      {/* Aesthetic Orbiting Circles Spinner (Pure Orbiting, No Scaling Ping) */}
      <div className="relative w-11 h-11 flex items-center justify-center">
        {/* Outer Orbiting Arc Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-zinc-200/30 dark:border-zinc-800/30 border-t-purple-600 dark:border-t-purple-400 animate-spin" />
        
        {/* Inner Counter-Orbiting Arc Ring */}
        <div className="absolute inset-2 rounded-full border-2 border-zinc-200/20 dark:border-zinc-800/20 border-b-pink-500 dark:border-b-pink-400 animate-[spin_1.5s_linear_infinite_reverse]" />
      </div>

      {/* Elegant 2-Word Text */}
      <p className="text-[10px] font-black tracking-[0.35em] text-zinc-400 dark:text-zinc-500 uppercase text-center pl-[0.35em] select-none">
        JUST MOMENT
      </p>
    </div>
  );
}
