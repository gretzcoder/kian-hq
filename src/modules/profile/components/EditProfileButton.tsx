'use client';

import { useState } from 'react';
import EditProfileModal from './EditProfileModal';

interface EditProfileButtonProps {
  initialData: {
    name: string;
    university?: string;
    study_program?: string;
    semester?: string;
    whatsapp_number?: string;
    avatar_url?: string;
    main_roles?: string[];
    custom_role?: string;
    tools?: string;
    portfolio_url?: string;
  };
}

export default function EditProfileButton({ initialData }: EditProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-xs font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95 shrink-0"
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
