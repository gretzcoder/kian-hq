'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface SwipeToDeleteWrapperProps {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  className?: string;
}

export function SwipeToDeleteWrapper({
  children,
  onDelete,
  deleteLabel = 'Hapus',
  className = '',
}: SwipeToDeleteWrapperProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartRef.current = { x: clientX, y: clientY, time: Date.now() };

    // Long press timer (500ms)
    longPressTimer.current = setTimeout(() => {
      setIsRevealed(true);
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dx = clientX - touchStartRef.current.x;
    const dy = clientY - touchStartRef.current.y;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }

    // Swipe left (negative dx)
    if (dx < -35 && Math.abs(dy) < 30) {
      setIsRevealed(true);
    } else if (dx > 35) {
      setIsRevealed(false);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div
      className={`relative overflow-hidden group/swipe select-none ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
    >
      {/* Background Red Action Area revealed on swipe */}
      <div className="absolute inset-y-0 right-0 w-24 bg-red-600 dark:bg-red-700 flex items-center justify-center text-white z-0 rounded-2xl">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsRevealed(false);
            onDelete();
          }}
          className="w-full h-full flex flex-col items-center justify-center text-xs font-black gap-0.5 active:scale-95 transition-transform"
        >
          <span className="text-base">🗑️</span>
          <span className="text-[10px] uppercase font-bold tracking-wider">{deleteLabel}</span>
        </button>
      </div>

      {/* Main Content Area (Translates Left on Swipe) */}
      <motion.div
        animate={{ x: isRevealed ? -80 : 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="relative z-10 bg-white dark:bg-[#09090b] h-full"
      >
        {children}

        {/* Desktop Hover Quick Delete Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/swipe:opacity-100 p-1.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 text-xs transition-all z-20 hidden sm:flex items-center gap-1 font-bold"
          title="Hapus dari tampilan Anda (POV)"
        >
          <span>🗑️</span>
        </button>
      </motion.div>
    </div>
  );
}
