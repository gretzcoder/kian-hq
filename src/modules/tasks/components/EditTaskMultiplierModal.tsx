'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  updateTaskSparksMultiplierAction,
  updateSlotSparksMultiplierAction,
  calculateEffectiveSparksMultiplier,
} from '@/modules/sparks/multiplierActions';
import { parseDirectBriefSlots, DirectBriefOutputSlot } from '@/modules/tasks/components/TaskActions';
import { useUI } from '@/components/ui/UIProvider';

interface EditTaskMultiplierModalProps {
  taskId: string;
  taskTitle: string;
  taskDescription?: string | null;
  currentMultiplier?: number;
  initialSlotId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditTaskMultiplierModal({
  taskId,
  taskTitle,
  taskDescription,
  currentMultiplier = 1.0,
  initialSlotId = null,
  isOpen,
  onClose,
  onSuccess,
}: EditTaskMultiplierModalProps) {
  const [generalMultiplier, setGeneralMultiplier] = useState<number>(currentMultiplier);
  const [generalCustomValue, setGeneralCustomValue] = useState<string>(String(currentMultiplier));

  const directSlots = parseDirectBriefSlots(taskDescription);
  const hasSlots = directSlots.length > 0;

  const [slotMultipliers, setSlotMultipliers] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'SLOTS'>(initialSlotId ? 'SLOTS' : 'GENERAL');
  const [selectedSlotId, setSelectedSlotId] = useState<string>(initialSlotId || (directSlots[0]?.id ?? ''));

  const [isPending, startTransition] = useTransition();
  const { toast } = useUI();

  useEffect(() => {
    if (isOpen) {
      setGeneralMultiplier(currentMultiplier);
      setGeneralCustomValue(String(currentMultiplier));
      const initialMap: Record<string, number> = {};
      directSlots.forEach((slot) => {
        initialMap[slot.id] = Number(slot.sparksMultiplier) || 1.0;
      });
      setSlotMultipliers(initialMap);
      if (initialSlotId) {
        setActiveTab('SLOTS');
        setSelectedSlotId(initialSlotId);
      }
    }
  }, [isOpen, currentMultiplier, taskDescription, initialSlotId]);

  if (!isOpen) return null;

  const presets = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

  const handleSaveGeneral = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = Math.max(0.5, Math.min(10.0, Number(generalCustomValue) || generalMultiplier || 1.0));

    startTransition(async () => {
      const res = await updateTaskSparksMultiplierAction(taskId, val);
      if (res.success) {
        toast(res.message || `General sparks multiplier berhasil diubah menjadi ${val}x`, 'success');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast(res.error || 'Gagal mengubah multiplier', 'error');
      }
    });
  };

  const handleSaveSlotMultiplier = (slotId: string, multiplierValue: number) => {
    const val = Math.max(0.5, Math.min(10.0, Number(multiplierValue) || 1.0));
    const targetSlot = directSlots.find((s) => s.id === slotId);
    const slotLabel = targetSlot?.name || slotId;

    startTransition(async () => {
      const res = await updateSlotSparksMultiplierAction(taskId, slotId, val);
      if (res.success) {
        setSlotMultipliers((prev) => ({ ...prev, [slotId]: val }));
        toast(res.message || `Multiplier slot "${slotLabel}" berhasil diatur ke ${val}x!`, 'success');
        if (onSuccess) onSuccess();
      } else {
        toast(res.error || 'Gagal mengubah multiplier slot', 'error');
      }
    });
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      // 1. Save general multiplier
      const generalVal = Math.max(0.5, Math.min(10.0, Number(generalCustomValue) || generalMultiplier || 1.0));
      if (generalVal !== currentMultiplier) {
        await updateTaskSparksMultiplierAction(taskId, generalVal);
      }

      // 2. Save modified slot multipliers
      if (hasSlots) {
        for (const slot of directSlots) {
          const currentSlotMult = Number(slot.sparksMultiplier) || 1.0;
          const newSlotMult = slotMultipliers[slot.id] || 1.0;
          if (newSlotMult !== currentSlotMult) {
            await updateSlotSparksMultiplierAction(taskId, slot.id, newSlotMult);
          }
        }
      }

      toast('Semua pengaturan multiplier Sparks berhasil disimpan!', 'success');
      onClose();
      if (onSuccess) onSuccess();
    });
  };

  const currentActiveSlot = directSlots.find((s) => s.id === selectedSlotId) || directSlots[0];
  const activeSlotMult = currentActiveSlot ? (slotMultipliers[currentActiveSlot.id] || 1.0) : 1.0;
  const generalNum = Number(generalCustomValue) || generalMultiplier || 1.0;
  const effectiveSlotSparksMult = calculateEffectiveSparksMultiplier(generalNum, activeSlotMult);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 via-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              ⚡
            </span>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                Pengaturan Multiplier Sparks
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[280px]">
                {taskTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation if task has Direct Brief Slots */}
        {hasSlots && (
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('GENERAL')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'GENERAL'
                  ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <span>🌐</span> Multiplier Task Utama
              {generalNum > 1.0 && (
                <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.2 rounded-md font-mono">
                  {generalNum}x
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('SLOTS')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'SLOTS'
                  ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <span>🎯</span> Slot / Kategori Output ({directSlots.length})
            </button>
          </div>
        )}

        <form onSubmit={handleSaveAll} className="space-y-4">
          {/* TAB 1: GENERAL TASK MULTIPLIER */}
          {activeTab === 'GENERAL' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                Multiplier utama ini berlaku untuk seluruh submission pada tugas ini.
              </p>

              {/* Presets */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                  Pilihan Multiplier Presets:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {presets.map((p) => {
                    const isSelected = Number(generalCustomValue) === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setGeneralMultiplier(p);
                          setGeneralCustomValue(String(p));
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 scale-102 border border-purple-400'
                            : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 hover:border-purple-400'
                        }`}
                      >
                        <span>{p}x</span>
                        {p > 1.0 && <span className="text-[10px]">🔥</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                  Atau Input Custom Multiplier (0.5x - 10.0x):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="10.0"
                    value={generalCustomValue}
                    onChange={(e) => setGeneralCustomValue(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-bold rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-mono"
                    placeholder="misal 1.75"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-purple-600 dark:text-purple-400">
                    x Multiplier
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SLOTS / CATEGORIES MULTIPLIER */}
          {activeTab === 'SLOTS' && hasSlots && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3 space-y-1 text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  <span>📐</span> Fair Stacking Formula:
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-normal">
                  Total Multiplier Efektif = <strong className="text-purple-700 dark:text-purple-300 font-mono">Task Multiplier ({generalNum}x) + (Slot Multiplier - 1.0)</strong>.
                </p>
              </div>

              {/* Slot Selector Dropdown / List */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                  Pilih Slot Kategori Output Yang Akan Diatur:
                </label>
                <select
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold rounded-xl px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
                >
                  {directSlots.map((slot, idx) => {
                    const sMult = slotMultipliers[slot.id] || 1.0;
                    return (
                      <option key={slot.id} value={slot.id}>
                        Slot #{idx + 1}: {slot.name} {sMult > 1.0 ? `(🔥 ${sMult}x)` : '(1.0x)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Selected Slot Multiplier Controls */}
              {currentActiveSlot && (
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/70 space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-200/60 dark:border-zinc-700/60 pb-2">
                    <div>
                      <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 block">
                        {currentActiveSlot.name}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {currentActiveSlot.assignedUserName ? `Ditugaskan ke: ${currentActiveSlot.assignedUserName}` : 'Open Claim'}
                      </span>
                    </div>

                    {/* Live Combined Multiplier Badge */}
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Total Multiplier Efektif:
                      </span>
                      <span className="text-xs font-black text-amber-600 dark:text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30 inline-block font-mono">
                        ⚡ {effectiveSlotSparksMult}x
                      </span>
                    </div>
                  </div>

                  {/* Slot Presets */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                      Multiplier Khusus Slot Ini:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {presets.map((p) => {
                        const isSelected = activeSlotMult === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setSlotMultipliers((prev) => ({ ...prev, [currentActiveSlot.id]: p }));
                            }}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                              isSelected
                                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20 scale-102 border border-amber-400'
                                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                            }`}
                          >
                            <span>{p}x</span>
                            {p === 1.0 ? <span className="text-[9px] text-zinc-400">(Default)</span> : <span className="text-[10px]">⭐</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick simulation note */}
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center justify-between">
                    <span>Task General ({generalNum}x) + Slot Bonus ({activeSlotMult > 1.0 ? `+${activeSlotMult - 1}x` : '0x'})</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">= {effectiveSlotSparksMult}x Sparks</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-md shadow-purple-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>{isPending ? 'Menyimpan...' : 'Simpan Semua Multiplier'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
