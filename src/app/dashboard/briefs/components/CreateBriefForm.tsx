'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrief } from '@/modules/content-brief/actions';

export default function CreateBriefForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await createBrief(formData);
      if (res.success) {
        router.push('/dashboard/briefs');
        router.refresh();
      } else {
        setError(res.error ?? 'Failed to create brief.');
      }
    } catch (err: any) {
      setError(err.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
          Brief / Campaign Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="title"
          required
          placeholder="e.g. PMB 2027 Promotion Campaign"
          className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
        />
      </div>

      {/* Target Audience */}
      <div>
        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
          Target Audience
        </label>
        <textarea
          name="audience"
          rows={3}
          placeholder="Who is this campaign targeting? Describe demographics, interests, behavior..."
          className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
        />
      </div>

      {/* Objectives */}
      <div>
        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
          Objectives & Goals
        </label>
        <textarea
          name="objectives"
          rows={3}
          placeholder="What do we want to achieve? Define success metrics, actions desired from audience..."
          className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
        />
      </div>

      {/* Key Messages */}
      <div>
        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
          Key Messages
        </label>
        <textarea
          name="keyMessages"
          rows={3}
          placeholder="What are the core statements we must convey? Taglines, value propositions..."
          className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
        />
      </div>

      {/* Visual Style */}
      <div>
        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
          Visual Style & References
        </label>
        <textarea
          name="visualStyle"
          rows={3}
          placeholder="Color scheme, mood, typography direction, styling guidelines..."
          className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? 'Creating Draft...' : 'Create Draft Brief'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => router.back()}
          className="px-6 py-3.5 text-sm font-bold text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
