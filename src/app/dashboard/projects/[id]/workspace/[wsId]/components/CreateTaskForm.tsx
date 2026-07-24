'use client';

import { useState } from 'react';
import { createTask } from '@/modules/tasks/actions';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export default function CreateTaskForm({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const priorityColors: Record<string, string> = {
    LOW:    'text-zinc-500 bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800',
    NORMAL: 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700',
    HIGH:   'text-orange-600 dark:text-orange-400 bg-orange-500/5 border-orange-500/20',
    URGENT: 'text-red-600 dark:text-red-400 bg-red-500/5 border-red-500/20',
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set('priority', priority);

    try {
      const res = await createTask(workspaceId, formData);
      if (res.success) {
        form.reset();
        setPriority('NORMAL');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(res.error ?? 'Failed to create task');
      }
    } catch (err: any) {
      setError(err.message ?? 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3">
          ✓ Task created successfully!
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            required
            placeholder="e.g. Design Poster"
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
            Deadline
          </label>
          <input
            type="date"
            name="deadline"
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
          Description
        </label>
        <textarea
          name="description"
          rows={2}
          placeholder="Task details, references, requirements..."
          className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none"
        />
      </div>

      {/* Priority Selector */}
      <div>
        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
          Priority
        </label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`flex-1 text-[10px] font-black uppercase tracking-wide py-2.5 rounded-xl border transition-all ${
                priority === p
                  ? priorityColors[p]
                  : 'text-zinc-400 bg-transparent border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? 'Creating...' : 'Create Task'}
      </button>
    </form>
  );
}
