'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateWorkspace } from '@/modules/workspaces/actions';

interface Mentor {
  id: string;
  name: string;
  email: string;
}

interface EditWorkspaceModalProps {
  workspaceId: string;
  initialName: string;
  initialDescription: string | null;
  initialMentorId: string | null;
  mentors: Mentor[];
  isAssessment: boolean;
}

export default function EditWorkspaceModal({
  workspaceId,
  initialName,
  initialDescription,
  initialMentorId,
  mentors,
  isAssessment,
}: EditWorkspaceModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [mentorId, setMentorId] = useState(initialMentorId ?? '');

  const handleOpen = () => {
    // Reset form to current values on every open
    setName(initialName);
    setDescription(initialDescription ?? '');
    setMentorId(initialMentorId ?? '');
    setError(null);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Nama workspace wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('ojt_coordinator_id', mentorId);

      const res = await updateWorkspace(workspaceId, formData);
      if (res.success) {
        setIsOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? 'Gagal memperbarui workspace.');
      }
    } catch (err: any) {
      setError(err.message ?? 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-zinc-400';
  const labelCls =
    'block text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1.5';

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs font-bold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3.5 py-2 rounded-xl transition-all active:scale-[0.97] flex items-center gap-1.5 shadow-sm"
      >
        ✏️ Edit Workspace
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                  Edit Detail Workspace
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Ubah nama, deskripsi, atau mentor workspace ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Nama */}
              <div>
                <label className={labelCls}>Nama Workspace *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Instagram, TikTok"
                  required
                  className={inputCls}
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className={labelCls}>Deskripsi</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Konteks singkat tentang workspace ini..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Mentor — hanya untuk TROOPERS workspace */}
              {!isAssessment && mentors.length > 0 && (
                <div>
                  <label className={labelCls}>Mentor Workspace</label>
                  <select
                    value={mentorId}
                    onChange={(e) => setMentorId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Tanpa Mentor —</option>
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <p className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  ⚠️ {error}
                </p>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-2.5 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-md text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan ✨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
