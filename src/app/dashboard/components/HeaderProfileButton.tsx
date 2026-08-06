'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import EditProfileModal from '@/modules/profile/components/EditProfileModal';

interface HeaderProfileButtonProps {
  name: string;
  email?: string | null;
  avatar?: string | null;
}

export default function HeaderProfileButton({ name, email, avatar }: HeaderProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const firstLetter = (name || 'U').charAt(0).toUpperCase();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="relative" ref={containerRef}>
        {/* Top Button Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-purple-500/40 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/80 transition-all text-xs font-bold shadow-xs active:scale-95 group cursor-pointer"
          title="Menu Profil Pengguna"
        >
          {avatar ? (
            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-purple-500/30 shrink-0">
              <Image src={avatar} alt={name} fill className="object-cover" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-xs">
              {firstLetter}
            </div>
          )}
          <span className="font-extrabold max-w-[110px] truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {name}
          </span>
          <span
            className={`text-[9px] font-mono text-zinc-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-purple-600 dark:text-purple-400' : ''
            }`}
          >
            ▼
          </span>
        </button>

        {/* Floating Shortcut Menu Popover */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 rounded-3xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden space-y-1">
            {/* Top User Info Header Card — Clickable to Open Profile */}
            <Link
              href="/dashboard/profile"
              onClick={() => setIsOpen(false)}
              className="p-3 bg-zinc-50 dark:bg-zinc-900/60 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all rounded-2xl border border-zinc-100 dark:border-zinc-800/80 flex items-center gap-3 cursor-pointer group"
              title="Buka Halaman Profil Saya"
            >
              {avatar ? (
                <div className="relative w-10 h-10 rounded-2xl overflow-hidden border border-purple-500/30 shrink-0 shadow-xs">
                  <Image src={avatar} alt={name} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                  {firstLetter}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {name}
                  </p>
                  <span className="text-[10px] font-mono text-zinc-400 group-hover:translate-x-0.5 transition-transform">
                    ↗
                  </span>
                </div>
                {email && (
                  <p className="text-[10px] text-zinc-400 font-mono truncate">{email}</p>
                )}
                <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 underline block mt-0.5">
                  Open Profile
                </span>
              </div>
            </Link>

            <div className="pt-1 space-y-1">
              {/* Option 1: Edit Profile (Opens EditProfileModal) */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsEditModalOpen(true);
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-purple-500/10 hover:border-purple-500/20 border border-transparent transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm font-bold shrink-0 group-hover:scale-105 transition-transform">
                  ✏️
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    Edit Profile
                  </p>
                  <p className="text-[10px] text-zinc-400">Edit info profil & ganti kata sandi</p>
                </div>
              </button>

              {/* Option 2: Logout */}
              <a
                href="/api/auth/logout"
                className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all group"
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-bold shrink-0 group-hover:scale-105 transition-transform">
                  🚪
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 transition-colors">
                    Logout
                  </p>
                  <p className="text-[10px] text-zinc-400">Keluar dari akun platform</p>
                </div>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        initialData={{
          name: name || '',
          email: email || '',
          avatar_url: avatar || '',
        }}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </>
  );
}
