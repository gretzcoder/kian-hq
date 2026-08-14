'use client';

import { useState } from 'react';
import { createTask } from '@/modules/tasks/actions';
import TiptapEditor from '@/components/editor/TiptapEditor';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

interface CreateTaskFormProps {
  workspaceId: string;
  existingTasks?: { id: string; title: string }[];
  members?: Array<{
    userId?: string;
    id?: string;
    userName?: string | null;
    name?: string | null;
    userEmail?: string;
  }>;
}

export default function CreateTaskForm({
  workspaceId,
  existingTasks = [],
  members = [],
}: CreateTaskFormProps) {
  const [loading, setLoading] = useState(false);
  const [outputType, setOutputType] = useState<'DESIGN' | 'VIDEO'>('DESIGN');
  const [isDirectBrief, setIsDirectBrief] = useState(true);
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [parentTaskId, setParentTaskId] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [description, setDescription] = useState('');
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
    formData.set('outputType', outputType);
    formData.set('priority', priority);
    formData.set('parentTaskId', parentTaskId);
    formData.set('isDirectBrief', String(isDirectBrief));
    formData.set('assigneeUserId', assigneeUserId);
    formData.set('description', description);

    try {
      const res = await createTask(workspaceId, formData);
      if (res.success) {
        form.reset();
        setOutputType('DESIGN');
        setIsDirectBrief(true);
        setPriority('NORMAL');
        setParentTaskId('');
        setAssigneeUserId('');
        setDescription('');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(res.error ?? 'Gagal membuat tugas.');
      }
    } catch (err: any) {
      setError(err.message ?? 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 font-bold">
          ⚠️ {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3 font-bold">
          ✓ Tugas berhasil dibuat dengan Brief Direct Koordinator!
        </p>
      )}

      {/* Case Indicator & Brief Origin Tag */}
      <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <span>⚡ Brief Direct Koordinator</span>
            <span className="bg-blue-500/20 text-blue-600 dark:text-blue-300 px-2 py-0.2 rounded-full text-[9px]">Bukan Assessment</span>
          </span>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[11px] font-bold text-blue-800 dark:text-blue-200">
            <input
              type="checkbox"
              checked={isDirectBrief}
              onChange={(e) => setIsDirectBrief(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            Brief Diberikan Langsung oleh Koordinator
          </label>
        </div>
        <p className="text-[11px] text-blue-600/80 dark:text-blue-300/80 leading-relaxed">
          Instruksi & kebutuhan tugas ditulis langsung oleh Koordinator di form ini (tanpa alur dokumen Content Brief terpisah & bukan Ujian Skill/Assessment).
        </p>
      </div>

      {/* Required Output Type Selector (Design vs Video) */}
      <div>
        <label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-2">
          Jenis Output Karya <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOutputType('DESIGN')}
            className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
              outputType === 'DESIGN'
                ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 font-bold ring-2 ring-purple-500/20 shadow-sm'
                : 'bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
            }`}
          >
            <span className="text-2xl">🎨</span>
            <div>
              <p className="text-xs font-extrabold">Design Task</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">Grafis, Feed, Banner, Thumbnail</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOutputType('VIDEO')}
            className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
              outputType === 'VIDEO'
                ? 'bg-pink-500/10 border-pink-500 text-pink-700 dark:text-pink-300 font-bold ring-2 ring-pink-500/20 shadow-sm'
                : 'bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
            }`}
          >
            <span className="text-2xl">🎬</span>
            <div>
              <p className="text-xs font-extrabold">Video Task</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">Reels, TikTok, Shorts, Longform</p>
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Judul Tugas <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              required
              placeholder={outputType === 'DESIGN' ? "misal: Desain Feed Instagram Batch 1" : "misal: Edit Video Reels Launching"}
              className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all"
            />
          </div>

          {/* Optional Assignee Selection for Koordinator */}
          {members.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                Penugasan Langsung ke Trooper (Opsional)
              </label>
              <select
                value={assigneeUserId}
                onChange={(e) => setAssigneeUserId(e.target.value)}
                className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-700 dark:text-zinc-300 text-xs rounded-xl px-4 py-3 focus:outline-none transition-all cursor-pointer"
              >
                <option value="">-- Pilih Trooper / Anggota Workspace (Nanti Dibuat di Daftar Task) --</option>
                {members.map((m) => {
                  const uid = m.userId || m.id || '';
                  const uname = m.userName || m.name || m.userEmail || 'Anggota';
                  if (!uid) return null;
                  return (
                    <option key={uid} value={uid}>
                      👤 {uname}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                Tanggal Mulai (Start Date)
              </label>
              <input
                type="datetime-local"
                name="start_at"
                onClick={(e) => {
                  try { e.currentTarget.showPicker?.(); } catch {}
                }}
                className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-3 focus:outline-none transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                Deadline <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="deadline"
                required
                min={new Date().toISOString().split('T')[0]}
                onClick={(e) => {
                  try { e.currentTarget.showPicker?.(); } catch {}
                }}
                className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-3 focus:outline-none transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
              />
            </div>
          </div>

          {/* Prerequisite Select Dropdown */}
          {existingTasks.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                Prasyarat (Tugas Prasyarat)
              </label>
              <select
                value={parentTaskId}
                onChange={(e) => setParentTaskId(e.target.value)}
                className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-700 dark:text-zinc-300 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all cursor-pointer"
              >
                <option value="">-- Tanpa Prasyarat --</option>
                {existingTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 flex items-center justify-between">
              <span>Deskripsi & Brief Instruksi Koordinator</span>
              <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400">✨ WYSIWYG Rich Text</span>
            </label>
            <TiptapEditor
              value={description}
              onChange={setDescription}
              placeholder="Tuliskan rincian brief tugas, standar hasil, pesan koordinator, dan kebutuhan karya dengan format lengkap..."
              minHeight="min-h-[220px]"
            />
            <input type="hidden" name="description" value={description} />
          </div>

          {/* Optional Reference / Brief URL */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Link Referensi / Lampiran Brief (Opsional)
            </label>
            <input
              type="url"
              name="brief_url"
              placeholder="Paste URL Canva / Figma / Google Drive / Notion / Reference..."
              className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-4 py-3 focus:outline-none transition-all"
            />
          </div>

          {/* Priority Selector */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Prioritas
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
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? 'Membuat Tugas...' : `Buat Tugas (${outputType === 'DESIGN' ? '🎨 Design' : '🎬 Video'})`}
      </button>
    </form>
  );
}
