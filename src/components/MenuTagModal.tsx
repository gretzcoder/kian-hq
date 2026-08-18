'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MenuTagOption, getAccessibleMenuOptions } from '@/modules/menu/menuTagActions';

interface MenuTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMenu: (menu: MenuTagOption) => void;
  initialQuery?: string;
}

export function MenuTagModal({
  isOpen,
  onClose,
  onSelectMenu,
  initialQuery = '',
}: MenuTagModalProps) {
  const [options, setOptions] = useState<MenuTagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialQuery || '');
      setLoading(true);
      getAccessibleMenuOptions()
        .then((res) => {
          setOptions(res);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, initialQuery]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(options.map((o) => o.category)));
    return ['ALL', ...cats];
  }, [options]);

  const filteredOptions = useMemo(() => {
    return options.filter((item) => {
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesCat;

      const matchesText =
        item.label.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.parentLabel && item.parentLabel.toLowerCase().includes(q));

      return matchesCat && matchesText;
    });
  }, [options, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2.5">
              <span className="text-xl p-2 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                📌
              </span>
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  Tag Menu & Sub-Menu Shortcut
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Pilih menu yang dapat diakses untuk disematkan sebagai pintasan langsung di pesan.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Search Box */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3 bg-white dark:bg-[#09090b]">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari menu, sub-menu, workspace, atau project..."
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Categories Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-black whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {cat === 'ALL' ? '🌟 Semua Menu' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Options List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="p-8 text-center space-y-2">
                <span className="text-2xl animate-spin inline-block">⏳</span>
                <p className="text-xs font-bold text-zinc-500">Memuat daftar menu yang dapat diakses...</p>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-8 text-center space-y-1 text-zinc-400">
                <span className="text-3xl">🔍</span>
                <p className="text-xs font-bold">Tidak ada menu yang sesuai pencarian.</p>
                <p className="text-[11px]">Coba gunakan kata kunci lain seperti "workspace", "knowledge", atau "brief".</p>
              </div>
            ) : (
              filteredOptions.map((menu) => (
                <div
                  key={menu.id}
                  onClick={() => {
                    onSelectMenu(menu);
                    onClose();
                  }}
                  className="group p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 hover:border-purple-500/50 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-purple-500/5 transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 shadow-xs shrink-0 group-hover:scale-110 transition-transform">
                      {menu.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          {menu.label}
                        </span>
                        {menu.isSubMenu && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-300">
                            Sub-Menu
                          </span>
                        )}
                      </div>
                      {menu.description && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-medium">
                          {menu.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold hidden sm:inline-block">
                      {menu.path}
                    </span>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-transform">
                      Tag ➔
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Info */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-4 font-medium">
            <span>💡 Tip: Anda juga dapat mengetik <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-purple-600 font-mono font-bold">#</code> di kolom obrolan.</span>
            <span>{filteredOptions.length} Menu</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
