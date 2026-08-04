'use client';

import { useState } from 'react';
import EditProfileModal from './EditProfileModal';

interface EditProfileButtonProps {
  initialData: {
    name: string;
    email?: string;
    username?: string;
    university?: string;
    study_program?: string;
    semester?: string;
    whatsapp_number?: string;
    avatar_url?: string;
    main_roles?: string[];
    custom_role?: string;
    tools?: string;
    portfolio_url?: string;
    department?: string;
    bio?: string;
    userType?: string;
  };
}

export default function EditProfileButton({ initialData }: EditProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
      >
        <span>✏️ Edit Profil</span>
      </button>

      <EditProfileModal
        initialData={initialData}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
