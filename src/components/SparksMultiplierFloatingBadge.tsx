'use client';

import { useState, useEffect } from 'react';

interface MultiplierData {
  designMultiplier: number;
  videoMultiplier: number;
  customTaskMultipliersCount: number;
  activeMultiplierTasks: {
    id: string;
    title: string;
    outputType: string;
    multiplier: number;
  }[];
}

export function SparksMultiplierFloatingBadge() {
  const [data, setData] = useState<MultiplierData | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch('/api/sparks/multipliers')
      .then((res) => res.json())
      .then((resData: any) => {
        if (resData && resData.success) {
          setData({
            designMultiplier: resData.designMultiplier || 1.0,
            videoMultiplier: resData.videoMultiplier || 1.0,
            customTaskMultipliersCount: resData.customTaskMultipliersCount || 0,
            activeMultiplierTasks: resData.activeMultiplierTasks || [],
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const hasActiveDesignMult = data.designMultiplier > 1.0;
  const hasActiveVideoMult = data.videoMultiplier > 1.0;
  const hasActiveCustomTasks = data.customTaskMultipliersCount > 0;
  const isBoostActive = hasActiveDesignMult || hasActiveVideoMult || hasActiveCustomTasks;

  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setCollapsed(false)}
          className={`p-2.5 rounded-full border shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center cursor-pointer ${
            isBoostActive
              ? 'bg-gradient-to-r from-amber-500 to-purple-600 text-white border-amber-300 ring-4 ring-amber-500/20 animate-pulse'
              : 'bg-zinc-900/90 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
          }`}
          title="Lihat Sparks Multipliers Active"
        >
          <span className="text-sm font-black flex items-center gap-1">
            <span>⚡</span>
            {isBoostActive && <span className="text-[10px] font-black uppercase">BOOST</span>}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-xs sm:max-w-sm">
      <div
        className={`p-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 space-y-2 ${
          isBoostActive
            ? 'bg-gradient-to-br from-zinc-950/95 via-purple-950/90 to-amber-950/90 border-purple-500/40 text-white ring-1 ring-purple-500/20 shadow-purple-500/10'
            : 'bg-white/95 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 dark:border-zinc-800 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
              isBoostActive ? 'bg-amber-500 text-zinc-950' : 'bg-purple-500/20 text-purple-400'
            }`}>
              ⚡
            </span>
            <p className="text-xs font-black tracking-tight truncate">
              {isBoostActive ? 'Sparks Multiplier Event Active!' : 'Sparks Multipliers'}
            </p>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="text-zinc-400 hover:text-zinc-200 text-xs font-bold px-1.5 py-0.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
            title="Minimize"
          >
            ✕
          </button>
        </div>

        {/* Multipliers List */}
        <div className="space-y-1.5 text-xs font-semibold">
          {/* Category Design */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span>🎨</span>
              <span>Design Tasks</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border font-mono ${
              hasActiveDesignMult
                ? 'bg-purple-500/20 text-purple-300 border-purple-400/40 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
            }`}>
              {data.designMultiplier}x
            </span>
          </div>

          {/* Category Video */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span>🎬</span>
              <span>Video Tasks</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border font-mono ${
              hasActiveVideoMult
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
            }`}>
              {data.videoMultiplier}x
            </span>
          </div>

          {/* Custom Task Event Multipliers */}
          {hasActiveCustomTasks && (
            <div className="pt-1.5 border-t border-white/10 dark:border-zinc-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-black text-amber-400">
                <span>📌 Custom Task Event Multipliers:</span>
                <span>{data.customTaskMultipliersCount} task(s)</span>
              </div>
              {data.activeMultiplierTasks.slice(0, 2).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-[10px] text-zinc-300 truncate gap-1">
                  <span className="truncate">• {t.title}</span>
                  <span className="font-bold text-amber-400 font-mono shrink-0">{t.multiplier}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
