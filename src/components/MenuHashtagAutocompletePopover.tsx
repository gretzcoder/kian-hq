'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAccessibleMenuOptions, MenuTagOption } from '@/modules/menu/menuTagActions';

interface MenuHashtagAutocompletePopoverProps {
  inputText: string;
  onSelectTag: (formattedTag: string) => void;
  onClose?: () => void;
}

export interface AutocompleteMenuItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  isSubMenu?: boolean;
  parentLabel?: string;
  description?: string;
  isTopLevelPick?: boolean;
  subLabel?: string;
}

export function MenuHashtagAutocompletePopover({
  inputText,
  onSelectTag,
  onClose,
}: MenuHashtagAutocompletePopoverProps) {
  const [menuOptions, setMenuOptions] = useState<MenuTagOption[]>([]);
  const [selectedMainMenu, setSelectedMainMenu] = useState<MenuTagOption | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Detect active hashtag query at the end of input
  const activeHashtagMatch = useMemo(() => {
    const match = inputText.match(/#([a-zA-Z0-9_\-\s>]*)$/);
    if (!match) return null;
    return match[1].toLowerCase().trim();
  }, [inputText]);

  useEffect(() => {
    getAccessibleMenuOptions().then((opts) => setMenuOptions(opts));
  }, []);

  // Filter main menus or sub-menus
  const displayedItems: AutocompleteMenuItem[] = useMemo(() => {
    if (selectedMainMenu) {
      // Showing sub-menus for selectedMainMenu
      const subItems = menuOptions.filter(
        (o) =>
          o.isSubMenu &&
          o.parentLabel &&
          o.parentLabel.toLowerCase() === selectedMainMenu.label.toLowerCase()
      );

      const items: AutocompleteMenuItem[] = [
        {
          id: `top_${selectedMainMenu.id}`,
          label: selectedMainMenu.label,
          path: selectedMainMenu.path,
          icon: selectedMainMenu.icon,
          isTopLevelPick: true,
          subLabel: 'Kirim menu luar tanpa spesifik sub-menu (Tekan Enter)',
        },
        ...subItems.map((s) => ({
          id: s.id,
          label: s.label,
          path: s.path,
          icon: s.icon,
          isSubMenu: true,
          parentLabel: s.parentLabel,
          subLabel: s.description || 'Sub-menu detail',
        })),
      ];

      return items;
    }

    // Top-level menu filter
    const query = activeHashtagMatch || '';
    if (!query) {
      return menuOptions.filter((m) => !m.isSubMenu).map((m) => ({
        id: m.id,
        label: m.label,
        path: m.path,
        icon: m.icon,
        isSubMenu: m.isSubMenu,
        parentLabel: m.parentLabel,
        description: m.description,
        subLabel: m.description,
      }));
    }

    return menuOptions
      .filter(
        (m) =>
          m.label.toLowerCase().includes(query) ||
          (m.description && m.description.toLowerCase().includes(query)) ||
          (m.category && m.category.toLowerCase().includes(query))
      )
      .map((m) => ({
        id: m.id,
        label: m.label,
        path: m.path,
        icon: m.icon,
        isSubMenu: m.isSubMenu,
        parentLabel: m.parentLabel,
        description: m.description,
        subLabel: m.description,
      }));
  }, [menuOptions, selectedMainMenu, activeHashtagMatch]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [displayedItems.length, selectedMainMenu]);

  // Handle Keyboard Navigation (Up, Down, Enter, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeHashtagMatch === null && !selectedMainMenu) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, displayedItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + displayedItems.length) % Math.max(1, displayedItems.length));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (displayedItems.length > 0) {
          e.preventDefault();
          const target = displayedItems[selectedIndex];
          if (target) {
            handleChooseItem(target);
          }
        }
      } else if (e.key === 'Escape') {
        if (selectedMainMenu) {
          setSelectedMainMenu(null);
        } else if (onClose) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [displayedItems, selectedIndex, activeHashtagMatch, selectedMainMenu]);

  const handleChooseItem = (item: any) => {
    if (!selectedMainMenu && !item.isSubMenu) {
      // Check if this main menu has sub-menus
      const hasSub = menuOptions.some(
        (o) => o.isSubMenu && o.parentLabel && o.parentLabel.toLowerCase() === item.label.toLowerCase()
      );

      if (hasSub) {
        // Transition to sub-menu selection view
        setSelectedMainMenu(item);
        return;
      }
    }

    // Insert formatted tag: #[Label](/path)
    const tagString = `#[${item.label}](${item.path})`;
    onSelectTag(tagString);
    setSelectedMainMenu(null);
  };

  if (activeHashtagMatch === null && !selectedMainMenu) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        className="absolute bottom-full left-0 right-0 sm:right-auto sm:w-[380px] mb-2 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-2.5 z-50 overflow-hidden text-left"
      >
        {/* Header */}
        <div className="px-3 py-1.5 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">📌</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
              {selectedMainMenu ? `Sub-Menu: ${selectedMainMenu.label}` : 'Pilih Menu Tag Sistem'}
            </span>
          </div>

          {selectedMainMenu ? (
            <button
              type="button"
              onClick={() => setSelectedMainMenu(null)}
              className="text-[10px] font-bold text-zinc-400 hover:text-purple-500 underline"
            >
              ← Kembali ke Menu Utama
            </button>
          ) : (
            <span className="text-[9px] font-bold text-zinc-400">Tekan ↑↓ & Enter</span>
          )}
        </div>

        {/* Menu Options List */}
        <div className="max-h-56 overflow-y-auto space-y-1 scrollbar-thin">
          {displayedItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-400 font-bold">
              Menu tidak ditemukan untuk "{activeHashtagMatch}"
            </div>
          ) : (
            displayedItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isTopPick = item.isTopLevelPick;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleChooseItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 font-bold'
                      : isTopPick
                      ? 'bg-purple-500/10 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-base shrink-0">{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">
                        {isTopPick ? `📌 Tag Menu Utama: ${item.label}` : item.label}
                      </p>
                      {item.subLabel && (
                        <p
                          className={`text-[9px] truncate ${
                            isSelected ? 'text-purple-100' : 'text-zinc-400'
                          }`}
                        >
                          {item.subLabel}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ml-2 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : isTopPick
                        ? 'bg-purple-500/20 text-purple-600'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isTopPick ? 'UTAMA' : 'PILIH ➔'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
