'use client';

import { useState } from 'react';
import { createTask } from '@/modules/tasks/actions';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { DirectBriefOutputSlot } from '@/modules/tasks/components/TaskActions';

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
  const [outputType, setOutputType] = useState<'DESIGN' | 'VIDEO' | 'OTHER'>('DESIGN');
  const [taskExecutionMode, setTaskExecutionMode] = useState<'ROLLING' | 'ALL_MEMBERS'>('ROLLING');
  const [isDirectBrief, setIsDirectBrief] = useState(false);
  const [outputSlots, setOutputSlots] = useState<DirectBriefOutputSlot[]>([
    { id: 'slot_1', name: 'Desain Feed Post 1', assignedUserId: '', assignedUserName: '', deadline: '', specificBrief: '' },
    { id: 'slot_2', name: 'Desain Feed Post 2', assignedUserId: '', assignedUserName: '', deadline: '', specificBrief: '' },
  ]);
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [parentTaskId, setParentTaskId] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const priorityColors: Record<string, string> = {
    LOW: 'text-zinc-500 bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800',
    NORMAL: 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700',
    HIGH: 'text-orange-600 dark:text-orange-400 bg-orange-500/5 border-orange-500/20',
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
    formData.set('taskExecutionMode', taskExecutionMode);
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
        setTaskExecutionMode('ROLLING');
        setIsDirectBrief(false);
        setOutputSlots([
          { id: 'slot_1', name: 'Desain Feed Post 1', assignedUserId: '', assignedUserName: '', deadline: '', specificBrief: '' },
          { id: 'slot_2', name: 'Desain Feed Post 2', assignedUserId: '', assignedUserName: '', deadline: '', specificBrief: '' },
        ]);
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
          ✓ Tugas berhasil dibuat{isDirectBrief ? ' dengan Brief Diberikan Langsung' : ''}!
        </p>
      )}

      {/* Prominent Direct Brief Option Card */}
      <div
        onClick={() => setIsDirectBrief((prev) => !prev)}
        className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${isDirectBrief
            ? 'bg-blue-500/10 border-blue-500/40 ring-2 ring-blue-500/20 shadow-xs'
            : 'bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
      >
        <input
          type="checkbox"
          checked={isDirectBrief}
          onChange={(e) => setIsDirectBrief(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
        />
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>⚡</span> Brief Diberikan Langsung
            </span>
            {isDirectBrief ? (
              <span className="bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Brief Diberikan Langsung Aktif
              </span>
            ) : (
              <span className="bg-zinc-200/80 dark:bg-zinc-800 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Brief Diberikan Langsung Tidak Aktif
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Centang opsi ini untuk membuat task dengan brief general dan slot output spesifik (custom brief, asset, penugasan per orang, dan custom deadline).
          </p>
        </div>
      </div>

      {/* Mode Penugasan Tim (Ketika Brief Diberikan Langsung Tidak Aktif) */}
      {!isDirectBrief && (
        <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 space-y-3">
          <label className="block text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">
            Sistem Penugasan Tim <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTaskExecutionMode('ROLLING')}
              className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                taskExecutionMode === 'ROLLING'
                  ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 font-bold ring-2 ring-purple-500/20 shadow-xs'
                  : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
              }`}
            >
              <span className="text-2xl mt-0.5">🔄</span>
              <div>
                <p className="text-xs font-black">Role Rolling Otomatis</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-relaxed font-normal">
                  Sistem otomatis merotasi role Researcher, Planner, dan Creator secara bergilir agar semua anggota merasakan seluruh peran.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTaskExecutionMode('ALL_MEMBERS')}
              className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                taskExecutionMode === 'ALL_MEMBERS'
                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
              }`}
            >
              <span className="text-2xl mt-0.5">👥</span>
              <div>
                <p className="text-xs font-black">Semua Anggota (Tugas Individu)</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-relaxed font-normal">
                  Setiap anggota dalam workspace ikut serta mengerjakan step Researcher, Planner, serta output hasil masing-masing.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Enriched Output Slots Section for Direct Brief */}
      {isDirectBrief && (
        <div className="p-4 sm:p-5 rounded-2xl bg-blue-500/5 dark:bg-blue-500/[0.04] border border-blue-500/20 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <div>
                <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                  Kategori & Slot Output Karya (Brief Diberikan Langsung)
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Tentukan rincian setiap slot output karya. Anda dapat menentukan peserta khusus (assign), deadline spesifik, serta brief/asset tambahan per output.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
              {outputSlots.filter(c => c.name.trim()).length} Slot Terdefinisi
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {outputSlots.map((slot, idx) => (
              <div
                key={slot.id || idx}
                className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-zinc-900/90 border border-blue-500/20 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                      Slot #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {slot.name.trim() ? slot.name : `Output #${idx + 1}`}
                    </span>
                  </div>
                  {outputSlots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = outputSlots.filter((_, i) => i !== idx);
                        setOutputSlots(updated);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Hapus Slot Output"
                    >
                      <span>🗑️</span>
                      <span className="hidden sm:inline">Hapus Slot</span>
                    </button>
                  )}
                </div>

                {/* Slot Name & Assignee */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Nama Output / Kategori <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={slot.name}
                      onChange={(e) => {
                        const updated = [...outputSlots];
                        updated[idx].name = e.target.value;
                        setOutputSlots(updated);
                      }}
                      placeholder={idx === 0 ? "misal: Feed Post 1 - Promosi Event" : idx === 1 ? "misal: Feed Post 2 - Guest Star" : `Nama Kategori Output #${idx + 1}`}
                      className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 font-semibold text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Assign Peserta Khusus (Opsional)
                    </label>
                    <select
                      value={slot.assignedUserId || ''}
                      onChange={(e) => {
                        const uid = e.target.value;
                        const matched = members.find((m) => (m.userId || m.id) === uid);
                        const uname = matched ? (matched.userName || matched.name || matched.userEmail || '') : '';
                        const updated = [...outputSlots];
                        updated[idx].assignedUserId = uid || null;
                        updated[idx].assignedUserName = uname || null;
                        setOutputSlots(updated);
                      }}
                      className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      <option value="">-- Terbuka Untuk Siapa Saja (Open Claim) --</option>
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
                </div>

                {/* Custom Slot Deadline & Specific Brief / Asset Link */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Deadline Khusus Slot (Opsional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={slot.deadline || ''}
                      onChange={(e) => {
                        const updated = [...outputSlots];
                        updated[idx].deadline = e.target.value || null;
                        setOutputSlots(updated);
                      }}
                      onClick={(e) => {
                        try { e.currentTarget.showPicker?.(); } catch {}
                      }}
                      className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 text-zinc-900 dark:text-zinc-100 cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <p className="text-[9px] text-zinc-400 mt-0.5 italic">
                      *Kosongkan jika mengikuti deadline general task
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Brief Lanjutan / Asset Khusus Slot (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={slot.specificBrief || ''}
                      onChange={(e) => {
                        const updated = [...outputSlots];
                        updated[idx].specificBrief = e.target.value || null;
                        setOutputSlots(updated);
                      }}
                      placeholder="Paste link asset Google Drive / Figma / Canva / copy teks spesifik untuk slot ini..."
                      className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 text-zinc-900 dark:text-zinc-100 leading-relaxed resize-y"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() =>
                setOutputSlots((prev) => [
                  ...prev,
                  {
                    id: `slot_${prev.length + 1}`,
                    name: '',
                    assignedUserId: '',
                    assignedUserName: '',
                    deadline: '',
                    specificBrief: '',
                  },
                ])
              }
              className="text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 px-3.5 py-2 rounded-xl border border-blue-500/20 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
            >
              <span>➕</span>
              <span>Tambah Slot Output</span>
            </button>
            <span className="text-[10px] text-zinc-400 italic">
              *Tiap slot dapat memiliki brief, asset, deadline, & penugasan sendiri
            </span>
          </div>
          <input
            type="hidden"
            name="directBriefCategories"
            value={JSON.stringify(outputSlots.filter((s) => s.name && s.name.trim().length > 0))}
          />
        </div>
      )}

      {/* Required Output Type Selector (Design vs Video vs Other) */}
      <div>
        <label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-2">
          Jenis Output Karya <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setOutputType('DESIGN')}
            className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${outputType === 'DESIGN'
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
            className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${outputType === 'VIDEO'
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

          <button
            type="button"
            onClick={() => setOutputType('OTHER')}
            className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${outputType === 'OTHER'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20 shadow-sm'
                : 'bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
              }`}
          >
            <span className="text-2xl">📌</span>
            <div>
              <p className="text-xs font-extrabold">Other Task</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">Dokumen, Copywriting, Admin, Dll</p>
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
                name="assigneeUserId"
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
                  try { e.currentTarget.showPicker?.(); } catch { }
                }}
                className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-3 focus:outline-none transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                Tenggat Waktu (Deadline) <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                name="deadline"
                required
                onClick={(e) => {
                  try { e.currentTarget.showPicker?.(); } catch { }
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
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Brief / Instruksi Pengerjaan
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
                  className={`flex-1 text-[10px] font-black uppercase tracking-wide py-2.5 rounded-xl border transition-all ${priority === p
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
        {loading ? 'Membuat Tugas...' : `Buat Tugas (${outputType === 'DESIGN' ? '🎨 Design' : outputType === 'VIDEO' ? '🎬 Video' : '📌 Other'})`}
      </button>
    </form>
  );
}
