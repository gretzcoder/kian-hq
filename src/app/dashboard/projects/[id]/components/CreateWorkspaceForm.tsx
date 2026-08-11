'use client';

import { useState } from 'react';
import { createWorkspace } from '@/modules/workspaces/actions';

interface Mentor {
  id: string;
  name: string;
  email: string;
}

type WorkspaceType = 'TROOPERS' | 'ASSESSMENT' | 'MENTOR';

export default function CreateWorkspaceForm({
  projectId,
  mentors = [],
}: {
  projectId: string;
  mentors?: Mentor[];
}) {
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState(false);
  const [wsType,        setWsType]        = useState<WorkspaceType>('TROOPERS');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    formData.set('workspace_type', wsType);

    try {
      const res = await createWorkspace(projectId, formData);
      if (res.success) {
        (e.target as HTMLFormElement).reset();
        setWsType('TROOPERS');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setError(res.error ?? 'Failed to create workspace');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3">
          ✓ Workspace berhasil dibuat!
        </p>
      )}

      {/* Workspace Type Toggle */}
      <div>
        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2.5">
          Tipe Workspace <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(['TROOPERS', 'ASSESSMENT', 'MENTOR'] as WorkspaceType[]).map((type) => {
            const isSelected = wsType === type;
            const info = {
              TROOPERS: {
                icon: '⚡',
                label: 'Troopers',
                desc: 'Workspace tim standar dengan alur OJT',
              },
              ASSESSMENT: {
                icon: '📝',
                label: 'Assessment',
                desc: 'Semua OJT & mentor masuk otomatis',
              },
              MENTOR: {
                icon: '🎓',
                label: 'Mentor',
                desc: 'Workspace khusus mentor dalam kendali koordinator',
              },
            }[type];

            return (
              <button
                key={type}
                type="button"
                onClick={() => setWsType(type)}
                className={`flex flex-col items-start gap-1 p-3.5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-500/8 dark:bg-purple-500/10 ring-2 ring-purple-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30'
                }`}
              >
                <span className="text-lg">{info.icon}</span>
                <span className={`text-xs font-black ${isSelected ? 'text-purple-700 dark:text-purple-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {info.label}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  {info.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Info banner */}
      {wsType === 'ASSESSMENT' && (
        <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/15 rounded-xl px-3.5 py-3">
          <span className="text-blue-500 text-sm shrink-0">ℹ️</span>
          <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
            Semua OJT (role <strong>On The Job Training</strong>) dan semua mentor (role <strong>Mentor Troopers</strong>)
            akan otomatis masuk workspace ini. Tidak perlu pilih mentor.
          </p>
        </div>
      )}
      {wsType === 'MENTOR' && (
        <div className="flex items-start gap-2.5 bg-purple-500/5 border border-purple-500/15 rounded-xl px-3.5 py-3">
          <span className="text-purple-500 text-sm shrink-0">🎓</span>
          <p className="text-[11px] text-purple-700 dark:text-purple-400 leading-relaxed">
            Workspace langsung dalam kendali Koordinator. Seluruh mentor aktif akan otomatis menjadi anggota dan peserta penugasan tiap step.
          </p>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
          Nama Workspace <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          required
          placeholder={wsType === 'ASSESSMENT' ? 'e.g. Skill Assessment Batch 3' : 'e.g. Instagram, TikTok'}
          className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
          Deskripsi
        </label>
        <input
          type="text"
          name="description"
          placeholder="Konteks singkat tentang workspace ini..."
          className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all"
        />
      </div>

      {/* Mentor select — only for TROOPERS */}
      {wsType === 'TROOPERS' && mentors.length > 0 && (
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
            Mentor Workspace
          </label>
          <select
            name="mentorId"
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all"
          >
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] disabled:opacity-60"
      >
        {loading
          ? 'Membuat...'
          : wsType === 'ASSESSMENT'
          ? '📝 Buat Assessment Workspace'
          : '⚡ Buat Troopers Workspace'}
      </button>
    </form>
  );
}
