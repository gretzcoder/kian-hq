'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  NUMBERING_CATEGORIES,
  NumberingCategoryPreset,
  getRomanMonth,
} from '../numberingEngine';
import { previewNextDocumentNumberAction } from '../documentActions';

interface SmartNumberingWidgetProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  customNumber: string;
  onCustomNumberChange: (num: string) => void;
  issueDate?: string | Date;
  onIssueDateChange?: (date: string) => void;
  companyCode?: string;
  onCompanyCodeChange?: (code: string) => void;
  orgCode?: string;
  onOrgCodeChange?: (code: string) => void;
  onNumberResolved?: (finalPreviewNumber: string) => void;
  disabled?: boolean;
}

export const SmartNumberingWidget: React.FC<SmartNumberingWidgetProps> = ({
  selectedCategory = 'TROOPERS',
  onCategoryChange,
  customNumber,
  onCustomNumberChange,
  issueDate,
  onIssueDateChange,
  companyCode = 'KIAN',
  onCompanyCodeChange,
  orgCode = 'TROOPERS',
  onOrgCodeChange,
  onNumberResolved,
  disabled = false,
}) => {
  const [mode, setMode] = useState<'AUTO_CATEGORY' | 'CUSTOM_CODE' | 'MANUAL_OVERRIDE'>(
    customNumber ? 'MANUAL_OVERRIDE' : 'AUTO_CATEGORY'
  );

  const [selectedSeqNum, setSelectedSeqNum] = useState<number | null>(null);
  const [nextSeq, setNextSeq] = useState<number>(1);
  const [maxUsedSeq, setMaxUsedSeq] = useState<number>(0);
  const [missingGaps, setMissingGaps] = useState<number[]>([]);
  const [usedNumbers, setUsedNumbers] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();

  const activeCategory =
    NUMBERING_CATEGORIES.find((c) => c.id === selectedCategory) || NUMBERING_CATEGORIES[0];

  // Resolve current date variables
  const targetDate = issueDate ? new Date(issueDate) : new Date();
  const validDate = isNaN(targetDate.getTime()) ? new Date() : targetDate;
  const currentYear = validDate.getFullYear();
  const currentMonthNum = validDate.getMonth() + 1;
  const currentRomanMonth = getRomanMonth(currentMonthNum);

  // Active codes based on mode
  const effectiveCompany =
    mode === 'CUSTOM_CODE'
      ? (companyCode || 'KIAN').toUpperCase()
      : activeCategory.companyCode;
  const effectiveOrg =
    mode === 'CUSTOM_CODE'
      ? (orgCode || 'TROOPERS').toUpperCase()
      : activeCategory.orgCode;

  // Active displayed sequence number
  const activeSequenceNumber = selectedSeqNum !== null ? selectedSeqNum : nextSeq;
  const formattedSeq = String(activeSequenceNumber).padStart(3, '0');

  // Load preview sequence & analyze gaps on category / org / year change
  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await previewNextDocumentNumberAction({
          categoryCode: effectiveOrg,
          companyCode: effectiveCompany,
          orgCode: effectiveOrg,
          date: validDate,
          selectedSequence: selectedSeqNum || undefined,
        });

        if (res.success) {
          setNextSeq(res.nextSequential);
          setMaxUsedSeq(res.maxUsed);
          setMissingGaps(res.missingGaps);
          setUsedNumbers(res.usedNumbers);

          if (selectedSeqNum === null) {
            // Default to next sequence or first gap
            setSelectedSeqNum(res.sequence);
          }

          if (mode !== 'MANUAL_OVERRIDE' && onNumberResolved) {
            onNumberResolved(res.formattedNumber);
          }
        }
      } catch (e) {
        console.error('Error fetching next sequence:', e);
      }
    });
  }, [selectedCategory, effectiveOrg, effectiveCompany, currentYear, selectedSeqNum, mode]);

  const handleSelectPreset = (cat: NumberingCategoryPreset) => {
    onCategoryChange(cat.id);
    setSelectedSeqNum(null);
    if (onOrgCodeChange) onOrgCodeChange(cat.orgCode);
    if (onCompanyCodeChange) onCompanyCodeChange(cat.companyCode);
    if (mode === 'MANUAL_OVERRIDE') {
      onCustomNumberChange('');
      setMode('AUTO_CATEGORY');
    }
  };

  const handleModeChange = (newMode: 'AUTO_CATEGORY' | 'CUSTOM_CODE' | 'MANUAL_OVERRIDE') => {
    setMode(newMode);
    if (newMode === 'AUTO_CATEGORY') {
      onCustomNumberChange('');
      if (onOrgCodeChange) onOrgCodeChange(activeCategory.orgCode);
      if (onCompanyCodeChange) onCompanyCodeChange(activeCategory.companyCode);
    } else if (newMode === 'CUSTOM_CODE') {
      onCustomNumberChange('');
    }
  };

  const handlePickGapNumber = (gapNum: number) => {
    setSelectedSeqNum(gapNum);
    onCustomNumberChange('');
  };

  const handlePickNextSequential = () => {
    setSelectedSeqNum(nextSeq);
    onCustomNumberChange('');
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header & Reset Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🏷️</span>
            <label className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Smart Numbering Engine
            </label>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ✓ Sinkron DB ({usedNumbers.length} Terbit)
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Format nomor sinkron otomatis: nomor urut 3-digit, kode entitas, kelompok, bulan Romawi, dan tahun.
          </p>
        </div>

        {/* Mode Selector Pill */}
        <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-[11px] font-bold">
          <button
            type="button"
            onClick={() => handleModeChange('AUTO_CATEGORY')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              mode === 'AUTO_CATEGORY'
                ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            ⚡ Kategori
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('CUSTOM_CODE')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              mode === 'CUSTOM_CODE'
                ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            ✏️ Kustom Kode
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('MANUAL_OVERRIDE')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              mode === 'MANUAL_OVERRIDE'
                ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      {/* Missing Gap Number Recommendations Banner */}
      {missingGaps.length > 0 && mode !== 'MANUAL_OVERRIDE' && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-2 text-amber-900 dark:text-amber-200">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span className="font-bold flex items-center gap-1.5">
              <span>💡</span> Ditemukan Celah Nomor Kosong (Belum Terpakai):
            </span>
            <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-mono font-bold">
              {missingGaps.length} Nomor Tersedia
            </span>
          </div>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
            Surat resmi terakhir berurutan sampai nomor <strong>{String(maxUsedSeq).padStart(3, '0')}</strong>. Anda dapat mengisi celah nomor yang kosong atau melanjutkan nomor urut baru:
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {missingGaps.map((gap) => (
              <button
                key={gap}
                type="button"
                onClick={() => handlePickGapNumber(gap)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                  activeSequenceNumber === gap
                    ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400'
                    : 'bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-zinc-700'
                }`}
              >
                <span>✨ Gunakan No {String(gap).padStart(3, '0')}</span>
                <span className="text-[10px] opacity-75">(Isi Celah)</span>
              </button>
            ))}

            <button
              type="button"
              onClick={handlePickNextSequential}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                activeSequenceNumber === nextSeq
                  ? 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-400'
                  : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              <span>Lanjut No {String(nextSeq).padStart(3, '0')}</span>
              <span className="text-[10px] opacity-75">(Urutan Baru)</span>
            </button>
          </div>
        </div>
      )}

      {/* Visual Breakdown Live Pill Display */}
      <div className="p-3.5 bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-zinc-900/5 dark:from-purple-950/30 dark:via-zinc-900 dark:to-zinc-900 rounded-xl border border-purple-500/20 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
            <span>✨</span> Pratinjau Nomor Surat:
          </span>
          {isPending ? (
            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
              <span className="w-2.5 h-2.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Menghitung urutan...
            </span>
          ) : (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-1">
              <span>●</span> Siap Diterbitkan
            </span>
          )}
        </div>

        {mode === 'MANUAL_OVERRIDE' ? (
          <div className="space-y-1">
            <input
              type="text"
              value={customNumber}
              onChange={(e) => {
                onCustomNumberChange(e.target.value);
                if (onNumberResolved) onNumberResolved(e.target.value);
              }}
              placeholder="Contoh: 001/KIAN/TROOPERS/IX/2026"
              className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-white dark:bg-zinc-950 text-sm font-mono font-bold text-purple-700 dark:text-purple-300"
            />
            <p className="text-[10px] text-zinc-500">
              * Mode manual: Anda memasukkan nomor surat secara penuh tanpa sequence otomatis.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs sm:text-sm font-black">
            {/* 1. Sequence Pill */}
            <span
              className={`px-2.5 py-1 rounded-lg text-white shadow-xs flex items-center gap-1 ${
                missingGaps.includes(activeSequenceNumber)
                  ? 'bg-amber-600'
                  : 'bg-purple-600'
              }`}
              title={
                missingGaps.includes(activeSequenceNumber)
                  ? 'Mengisi celah nomor kosong'
                  : 'Nomor urut lanjutan terbaru'
              }
            >
              <span>{formattedSeq}</span>
              {missingGaps.includes(activeSequenceNumber) && (
                <span className="text-[9px] bg-amber-800/60 px-1 py-0.2 rounded font-sans font-normal">
                  Celah
                </span>
              )}
            </span>
            <span className="text-zinc-400 dark:text-zinc-600 font-bold">/</span>

            {/* 2. Company Code Pill */}
            <span
              className="px-2.5 py-1 rounded-lg bg-zinc-800 dark:bg-zinc-700 text-zinc-100 shadow-xs"
              title="Kode Perusahaan"
            >
              {effectiveCompany}
            </span>
            <span className="text-zinc-400 dark:text-zinc-600 font-bold">/</span>

            {/* 3. Org / Category Pill */}
            <span
              className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-xs"
              title="Kode Kelompok / Divisi"
            >
              {effectiveOrg}
            </span>
            <span className="text-zinc-400 dark:text-zinc-600 font-bold">/</span>

            {/* 4. Roman Month Pill */}
            <span
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-zinc-950 font-black shadow-xs"
              title="Bulan Romawi Otomatis"
            >
              {currentRomanMonth}
            </span>
            <span className="text-zinc-400 dark:text-zinc-600 font-bold">/</span>

            {/* 5. Year Pill */}
            <span
              className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 shadow-xs"
              title="Tahun Terbit"
            >
              {currentYear}
            </span>
          </div>
        )}
      </div>

      {/* Mode 1: Auto Category Preset Grid */}
      {mode === 'AUTO_CATEGORY' && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>Pilih Kategori &amp; Kode Divisi</span>
            <span className="text-purple-600 dark:text-purple-400 text-[10px]">
              Otomatis mengisi /{effectiveCompany}/{effectiveOrg}
            </span>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NUMBERING_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectPreset(cat)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 shadow-xs ring-1 ring-purple-500/50'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-xs font-bold truncate">{cat.name}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-75 font-semibold">
                    /{cat.companyCode}/{cat.orgCode}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode 2: Custom Code Inputs */}
      {mode === 'CUSTOM_CODE' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
              Kode Perusahaan / Entitas
            </label>
            <input
              type="text"
              value={companyCode}
              onChange={(e) =>
                onCompanyCodeChange && onCompanyCodeChange(e.target.value.toUpperCase())
              }
              placeholder="KIAN"
              maxLength={10}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono font-bold uppercase"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
              Kode Kelompok / Divisi Internal
            </label>
            <input
              type="text"
              value={orgCode}
              onChange={(e) =>
                onOrgCodeChange && onOrgCodeChange(e.target.value.toUpperCase())
              }
              placeholder="TROOPERS"
              maxLength={15}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono font-bold uppercase"
            />
          </div>
        </div>
      )}
    </div>
  );
};

