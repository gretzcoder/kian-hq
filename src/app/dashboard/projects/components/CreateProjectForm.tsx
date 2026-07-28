'use client';

import { useState, useEffect, useRef } from 'react';
import { createProject } from '@/modules/projects/actions';

interface OjtUser {
  id: string;
  name: string;
  email: string;
}

interface CreateProjectFormProps {
  briefId: string | null;
  briefTitle: string | null;
  ojtList: OjtUser[];
}

function SearchableSelect({
  ojtList,
  selectedId,
  onChange,
  onRemove,
  showRemove,
}: {
  ojtList: OjtUser[];
  selectedId: string;
  onChange: (id: string) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedUser = ojtList.find((u) => u.id === selectedId);

  useEffect(() => {
    if (selectedUser) {
      setSearch(selectedUser.email);
    } else {
      setSearch('');
    }
  }, [selectedId, selectedUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filtered = ojtList.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative space-y-1" ref={containerRef}>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            name="ojt_coordinator_search_prevent_autofill"
            autoComplete="new-password"
            placeholder="Search email (e.g. staff@kian.co or intern@kian.co)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
          />
          {isOpen && (
            <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-20 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filtered.length === 0 ? (
                <p className="p-3 text-xs text-zinc-400 dark:text-zinc-500 italic">No emails match search</p>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onChange(u.id);
                      setSearch(u.email);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 transition-colors font-medium flex flex-col"
                  >
                    <span className="font-bold">{u.email}</span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{u.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="px-3 py-2.5 text-red-500 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 rounded-xl transition-all font-black text-xs shrink-0"
          >
            ✕ Remove
          </button>
        )}
      </div>
      <input type="hidden" name="ojtCoordinatorIds" value={selectedId} />
    </div>
  );
}

export default function CreateProjectForm({
  briefId,
  briefTitle,
  ojtList,
}: CreateProjectFormProps) {
  const [coordinators, setCoordinators] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddCoordinator = () => {
    setCoordinators([...coordinators, '']);
  };

  const handleRemoveCoordinator = (index: number) => {
    const updated = coordinators.filter((_, i) => i !== index);
    setCoordinators(updated.length > 0 ? updated : ['']);
  };

  const handleCoordinatorChange = (index: number, id: string) => {
    const updated = [...coordinators];
    updated[index] = id;
    setCoordinators(updated);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await createProject(formData);
      if (res.success) {
        window.location.href = `/dashboard/projects/${res.projectId}`;
      } else {
        setError(res.error ?? 'Failed to create project');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-bold mb-1 text-zinc-900 dark:text-zinc-100">Create New Project</h2>
        <p className="text-zinc-500 dark:text-zinc-500 text-xs">Initialize a creative campaign and map its storage root.</p>
      </div>

      {briefTitle && (
        <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-3.5 space-y-1">
          <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
            Linked Content Brief
          </span>
          <p className="text-xs text-zinc-800 dark:text-zinc-200 font-bold">{briefTitle}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {briefId && <input type="hidden" name="briefId" value={briefId} />}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <div>
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            defaultValue={briefTitle || ''}
            placeholder="e.g. Q3 Video Campaign"
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
            Description
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="Briefly describe the campaign goals..."
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
            Storage URL (Google Drive folder)
          </label>
          <input
            type="url"
            name="gdriveFolderUrl"
            placeholder="e.g. https://drive.google.com/..."
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Coordinators <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleAddCoordinator}
              className="text-[10px] font-black text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-colors uppercase tracking-widest"
            >
              + Add Coordinator
            </button>
          </div>

          <div className="space-y-2.5 border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/20 dark:bg-zinc-950/10 rounded-2xl p-3">
            {coordinators.map((selectedId, index) => (
              <SearchableSelect
                key={index}
                ojtList={ojtList}
                selectedId={selectedId}
                onChange={(id) => handleCoordinatorChange(index, id)}
                onRemove={() => handleRemoveCoordinator(index)}
                showRemove={coordinators.length > 1}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] mt-4 disabled:opacity-60"
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  );
}
