'use client';

import { useState } from 'react';
import { updateBrief } from '../actions';

interface Brief {
  audience: string | null;
  objectives: string | null;
  key_messages: string | null;
  visual_style: string | null;
}

export default function BriefForm({
  projectId,
  brief,
  canEdit,
}: {
  projectId: string;
  brief: Brief | null;
  canEdit: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(!brief);
  const [audience, setAudience] = useState(brief?.audience || '');
  const [objectives, setObjectives] = useState(brief?.objectives || '');
  const [keyMessages, setKeyMessages] = useState(brief?.key_messages || '');
  const [visualStyle, setVisualStyle] = useState(brief?.visual_style || '');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateBrief(projectId, formData);
      if (res.success) {
        setIsEditing(false);
        setStatusMsg({ type: 'success', text: 'Creative brief saved successfully!' });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to save brief.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'An error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const hasContent = brief && (brief.audience || brief.objectives || brief.key_messages || brief.visual_style);

  if (!isEditing && hasContent) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Creative Content Brief</h2>
          {canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 rounded-xl transition-all font-bold tracking-wide active:scale-[0.98] shadow-sm"
            >
              Edit Brief
            </button>
          )}
        </div>

        {statusMsg && (
          <div className={`text-xs p-3.5 border rounded-xl ${
            statusMsg.type === 'success' ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/15' : 'bg-red-500/5 text-red-600 border-red-500/10 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/15'
          }`}>
            {statusMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/10 p-6 rounded-3xl shadow-sm">
            <h4 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">Target Audience</h4>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed font-medium">{audience || 'Not defined'}</p>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/10 p-6 rounded-3xl shadow-sm">
            <h4 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">Campaign Objectives</h4>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed font-medium">{objectives || 'Not defined'}</p>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/10 p-6 rounded-3xl shadow-sm">
            <h4 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">Key Messages</h4>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed font-medium">{keyMessages || 'Not defined'}</p>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/10 p-6 rounded-3xl shadow-sm">
            <h4 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">Visual & Stylistic Guidelines</h4>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed font-medium">{visualStyle || 'Not defined'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Edit Content Brief</h2>
        {brief && (
          <button
            onClick={() => {
              setIsEditing(false);
              setStatusMsg(null);
            }}
            className="text-xs border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 rounded-xl transition-all font-bold tracking-wide active:scale-[0.98] shadow-sm"
          >
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Target Audience
            </label>
            <textarea
              name="audience"
              rows={5}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Describe demographics, interests, or behavior..."
              className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Objectives & Goals
            </label>
            <textarea
              name="objectives"
              rows={5}
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              placeholder="What are the key results, views, actions or conversions expected?"
              className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Key Messages
            </label>
            <textarea
              name="keyMessages"
              rows={5}
              value={keyMessages}
              onChange={(e) => setKeyMessages(e.target.value)}
              placeholder="What core points, selling propositions or taglines must be included?"
              className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Visual Style & Guidelines
            </label>
            <textarea
              name="visualStyle"
              rows={5}
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value)}
              placeholder="Specify color codes, fonts, references, design language, or file dimensions..."
              className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
            />
          </div>
        </div>

        {statusMsg && (
          <div className={`text-xs p-3.5 border rounded-xl ${
            statusMsg.type === 'success' ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/15' : 'bg-red-500/5 text-red-600 border-red-500/10 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/15'
          }`}>
            {statusMsg.text}
          </div>
        )}

        {canEdit && (
          <button
            type="submit"
            disabled={loading}
            className="bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-sm px-6 py-3 rounded-xl transition-all duration-300 disabled:opacity-50 active:scale-[0.98] shadow-sm"
          >
            {loading ? 'Saving...' : 'Save Creative Brief'}
          </button>
        )}
      </form>
    </div>
  );
}
