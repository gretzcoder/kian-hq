'use client';

import React, { useState } from 'react';
import { CustomDetailItem, FormFieldSchema } from '../documentTypes';
import { AssigneeTableInput } from './AssigneeTableInput';
import { DispensationTableInput } from './DispensationTableInput';
import { searchProjectsAction } from '../documentActions';
import { getRealtimeDocumentDate } from '@/lib/dateUtils';

interface DynamicDocumentFormProps {
  schema: FormFieldSchema[];
  formData: Record<string, any>;
  onChange: (key: string, value: any) => void;
  annexThreshold?: number;
  tableColumns?: Array<{ key: string; label: string; widthPercent?: number; align?: string }>;
}

export const DynamicDocumentForm: React.FC<DynamicDocumentFormProps> = ({
  schema = [],
  formData,
  onChange,
  annexThreshold = 4,
  tableColumns,
}) => {
  const [projectSearchResults, setProjectSearchResults] = useState<any[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [isSearchingProjects, setIsSearchingProjects] = useState(false);

  const handleSearchProjects = async (q: string) => {
    setIsSearchingProjects(true);
    try {
      const results = await searchProjectsAction(q);
      setProjectSearchResults(results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingProjects(false);
    }
  };

  const handleSelectProject = (proj: any) => {
    onChange('event_name', proj.name);
    // Normalize legacy hardcoded event title if present in event_intro_text
    if (
      typeof formData.event_intro_text === 'string' &&
      formData.event_intro_text.includes('BKOT (Bincang Kampus Bersama Orang Tua) UBSI')
    ) {
      onChange(
        'event_intro_text',
        formData.event_intro_text.replace(
          /BKOT \(Bincang Kampus Bersama Orang Tua\) UBSI/g,
          '{event_name}'
        )
      );
    }
    setShowProjectModal(false);
  };

  // Repeatable list helpers
  const handleRepeatableAdd = (key: string, currentList: string[] = []) => {
    const nextNum = currentList.length + 1;
    onChange(key, [...currentList, `${nextNum}. `]);
  };

  const handleRepeatableChange = (
    key: string,
    index: number,
    val: string,
    currentList: string[] = []
  ) => {
    const updated = [...currentList];
    updated[index] = val;
    onChange(key, updated);
  };

  const handleRepeatableRemove = (
    key: string,
    index: number,
    currentList: string[] = []
  ) => {
    const updated = currentList.filter((_, i) => i !== index);
    onChange(key, updated);
  };

  // Dynamic schema expansion to guarantee dresscode/custom details & person custom details are editable
  const hasEventFields = (schema || []).some(
    (f) => f.key === 'event_name' || f.key === 'event_days' || f.key === 'event_location' || f.key === 'event_intro_text'
  );
  const hasCustomDetailsInSchema = (schema || []).some(
    (f) => f.key === 'event_custom_details' || f.type === 'key_value_list' || f.type === 'custom_details'
  );

  let effectiveSchema = [...(schema || [])];

  if (!hasCustomDetailsInSchema && (hasEventFields || formData.event_custom_details)) {
    const insertIdx = effectiveSchema.findIndex(
      (f) => f.key === 'event_location' || f.key === 'event_time' || f.key === 'event_days'
    );
    const customField: FormFieldSchema = {
      key: 'event_custom_details',
      label: 'Rincian Tambahan / Kustom (Dresscode, Perlengkapan, dll.)',
      type: 'key_value_list',
      required: false,
      defaultValue:
        Array.isArray(formData.event_custom_details) && formData.event_custom_details.length > 0
          ? formData.event_custom_details
          : [{ id: '1', label: 'Dresscode', value: 'Batik / Formal Bebas Rapi' }],
      helpText: 'Tambahkan rincian tambahan seperti dresscode, pakaian, perlengkapan, catatan, atau kontak PIC.',
    };

    if (insertIdx !== -1) {
      effectiveSchema.splice(insertIdx + 1, 0, customField);
    } else {
      effectiveSchema.push(customField);
    }
  }

  return (
    <div className="space-y-4">
      {effectiveSchema.map((field) => {
        let value =
          formData[field.key] !== undefined
            ? formData[field.key]
            : field.defaultValue ?? '';

        // Auto realtime date default for date_place field if empty or default
        if (
          (field.key === 'document_date_place' || field.key === 'date_place') &&
          (!value || typeof value !== 'string' || !value.trim())
        ) {
          value = getRealtimeDocumentDate('Jakarta');
        }

        // Dispensation Table Type (Mahasiswa & Perkuliahan)
        if (field.type === 'dispensation_table' || field.key === 'dispensation_assignees') {
          return (
            <div key={field.key}>
              <DispensationTableInput
                value={Array.isArray(value) ? value : []}
                onChange={(newVal) => onChange(field.key, newVal)}
                eventDays={formData.event_days}
                specificDate={formData.specific_date}
                annexThreshold={annexThreshold}
              />
            </div>
          );
        }

        // Assignee Table Type
        if (field.type === 'assignee_table') {
          return (
            <div
              key={field.key}
              className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2"
            >
              <AssigneeTableInput
                value={Array.isArray(value) ? value : []}
                onChange={(newVal) => onChange(field.key, newVal)}
                annexThreshold={annexThreshold}
                columns={tableColumns}
              />
            </div>
          );
        }

        // Repeatable List Type (e.g. Tembusan / CC)
        if (field.type === 'repeatable_list') {
          const list: string[] = Array.isArray(value) ? value : [];
          return (
            <div
              key={field.key}
              className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {field.label}
                  </label>
                  {field.helpText && (
                    <p className="text-[11px] text-zinc-500">{field.helpText}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRepeatableAdd(field.key, list)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all"
                >
                  + Tambah Baris
                </button>
              </div>

              <div className="space-y-2">
                {list.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) =>
                        handleRepeatableChange(
                          field.key,
                          idx,
                          e.target.value,
                          list
                        )
                      }
                      className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleRepeatableRemove(field.key, idx, list)
                      }
                      className="text-red-500 hover:text-red-700 p-1.5 text-xs font-bold"
                      title="Hapus"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Key Value List / Custom Details (e.g. Dresscode, Perlengkapan, Catatan, dll)
        if (
          field.type === 'key_value_list' ||
          field.type === 'custom_details' ||
          field.key === 'event_custom_details' ||
          field.key === 'person_custom_details'
        ) {
          const rawList = Array.isArray(value) ? value : [];
          // Ensure all items have unique IDs for accurate updates
          const list: CustomDetailItem[] = rawList.map((it: any, i: number) => ({
            id: it?.id || `cd_item_${i}_${Date.now()}`,
            label: it?.label ?? '',
            value: it?.value ?? '',
          }));

          const handleAdd = (label: string, val: string = '') => {
            const newItem: CustomDetailItem = {
              id: `cd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              label,
              value: val,
            };
            onChange(field.key, [...list, newItem]);
          };

          const handleUpdate = (idOrIdx: string | number, subField: 'label' | 'value', subVal: string) => {
            const nextList = list.map((it, idx) => {
              const isMatch = (it.id && it.id === idOrIdx) || idx === idOrIdx;
              return isMatch ? { ...it, [subField]: subVal } : it;
            });
            onChange(field.key, nextList);
          };

          const handleRemove = (idOrIdx: string | number) => {
            const nextList = list.filter((it, idx) => {
              return it.id ? it.id !== idOrIdx : idx !== idOrIdx;
            });
            onChange(field.key, nextList);
          };

          const handleMove = (index: number, direction: 'up' | 'down') => {
            const newIdx = direction === 'up' ? index - 1 : index + 1;
            if (newIdx < 0 || newIdx >= list.length) return;
            const nextList = [...list];
            const [moved] = nextList.splice(index, 1);
            nextList.splice(newIdx, 0, moved);
            onChange(field.key, nextList);
          };

          return (
            <div
              key={field.key}
              className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>👔</span> {field.label}
                  </label>
                  {field.helpText && (
                    <p className="text-[11px] text-zinc-500">{field.helpText}</p>
                  )}
                </div>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full">
                  {list.length} Item Rincian
                </span>
              </div>

              {/* Quick preset buttons */}
              <div className="flex flex-wrap gap-1 items-center pt-1">
                <span className="text-[9px] font-semibold text-zinc-400 mr-0.5">Tambah Cepat:</span>
                {[
                  { label: 'Dresscode', icon: '👔', defVal: 'Batik / Formal Bebas Rapi' },
                  { label: 'Pakaian', icon: '👕', defVal: 'Kemeja Putih & Celana Hitam' },
                  { label: 'Agenda', icon: '📋', defVal: 'Pembukaan & Workshop' },
                  { label: 'Perlengkapan', icon: '🎒', defVal: 'Laptop & Alat Tulis' },
                  { label: 'Catatan', icon: '📌', defVal: 'Hadir 15 menit sebelum acara' },
                  { label: 'Biaya', icon: '💰', defVal: 'Gratis' },
                  { label: 'Kontak PIC', icon: '📞', defVal: '0812-xxxx-xxxx' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleAdd(preset.label, preset.defVal)}
                    className="text-[9.5px] font-bold px-2 py-0.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                  >
                    <span>{preset.icon}</span> + {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleAdd('', '')}
                  className="text-[9.5px] font-bold px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                >
                  <span>➕</span> + Kustom
                </button>
              </div>

              {/* Items List */}
              {list.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {list.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs"
                    >
                      {/* Reorder Buttons */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, 'up')}
                          className="text-[8px] leading-none px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Geser ke Atas"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={idx === list.length - 1}
                          onClick={() => handleMove(idx, 'down')}
                          className="text-[8px] leading-none px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Geser ke Bawah"
                        >
                          ▼
                        </button>
                      </div>

                      {/* Label Input */}
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => handleUpdate(item.id || idx, 'label', e.target.value)}
                        placeholder="Nama (e.g. Dresscode)"
                        className="w-[120px] shrink-0 px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-purple-500"
                      />

                      <span className="text-zinc-400 font-bold">:</span>

                      {/* Value Input */}
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => handleUpdate(item.id || idx, 'value', e.target.value)}
                        placeholder="Isi rincian keterangan..."
                        className="flex-1 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-purple-500"
                      />

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id || idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 p-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors"
                        title="Hapus baris ini"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        // Checkbox Type
        if (field.type === 'checkbox') {
          return (
            <div
              key={field.key}
              className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl"
            >
              <input
                type="checkbox"
                id={field.key}
                checked={Boolean(value)}
                onChange={(e) => onChange(field.key, e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
              />
              <label
                htmlFor={field.key}
                className="text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                {field.label}
              </label>
            </div>
          );
        }

        // Textarea Type
        if (field.type === 'textarea') {
          const availableTags = [
            '{event_name}',
            '{signer_title_intro}',
            '{person_name}',
            '{person_role}',
          ];
          return (
            <div key={field.key} className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {field.label}{' '}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const current = value || '';
                        const next = current ? `${current} ${tag}` : tag;
                        onChange(field.key, next);
                      }}
                      className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-mono font-bold hover:bg-purple-100 dark:hover:bg-purple-900/60 cursor-pointer transition-colors"
                      title={`Sisipkan variabel ${tag}`}
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-purple-500 focus:outline-hidden resize-y font-mono"
              />
              {field.helpText ? (
                <p className="text-[10px] text-zinc-400">{field.helpText}</p>
              ) : (
                <p className="text-[9.5px] text-zinc-400 dark:text-zinc-500">
                  💡 Gunakan variabel <code className="font-mono text-purple-600 dark:text-purple-400 font-bold">{'{event_name}'}</code> agar nama event terisi otomatis tanpa perlu mengetik ulang.
                </p>
              )}
            </div>
          );
        }

        // Tempat & Tanggal Surat (with automatic realtime date & sync button)
        if (field.key === 'document_date_place' || field.key === 'date_place') {
          const liveDate = getRealtimeDocumentDate('Jakarta');
          const currentValue = value || liveDate;

          return (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <span>📅</span> {field.label}{' '}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Realtime Otomatis
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(field.key, liveDate)}
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Setel ulang ke tanggal saat ini"
                  >
                    ⚡ Hari Ini
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={currentValue}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder || liveDate}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
              {field.helpText && (
                <p className="text-[10px] text-zinc-400">{field.helpText}</p>
              )}
            </div>
          );
        }

        // Event Name field with quick KIAN project picker button
        if (field.key === 'event_name') {
          return (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {field.label}{' '}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectModal(true);
                    handleSearchProjects('');
                  }}
                  className="text-[11px] text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer"
                >
                  📁 Ambil dari Project KIAN HQ
                </button>
              </div>
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
              <p className="text-[9.5px] text-zinc-400 dark:text-zinc-500">
                ✨ Nama event ini otomatis diterapkan ke Kalimat Pengantar, Rincian, dan Lampiran dokumen.
              </p>
            </div>
          );
        }

        // Document Title field (supports multi-line with Enter)
        if (field.key === 'document_title') {
          return (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {field.label}{' '}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                <span className="text-[9.5px] text-purple-600 dark:text-purple-400 font-medium">
                  ↵ Enter untuk baris baru
                </span>
              </div>
              <textarea
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder || 'SURAT KEPUTUSAN\nPENERIMAAN MAGANG'}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-bold uppercase resize-y leading-tight font-sans focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
              {field.helpText && (
                <p className="text-[10px] text-zinc-400">{field.helpText}</p>
              )}
            </div>
          );
        }

        // Standard Text Input Type
        return (
          <div key={field.key} className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              {field.label}{' '}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
            {field.helpText && (
              <p className="text-[10px] text-zinc-400">{field.helpText}</p>
            )}
          </div>
        );
      })}

      {/* Project Selector Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>📁</span> Pilih Event / Proyek KIAN HQ
              </h3>
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Cari nama proyek..."
              onChange={(e) => handleSearchProjects(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium"
              autoFocus
            />

            <div className="max-h-60 overflow-y-auto space-y-2">
              {isSearchingProjects ? (
                <p className="text-center text-xs py-4 text-zinc-400">
                  Mencari project...
                </p>
              ) : projectSearchResults.length === 0 ? (
                <p className="text-center text-xs py-4 text-zinc-400">
                  Tidak ada data proyek.
                </p>
              ) : (
                projectSearchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProject(p)}
                    className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-purple-500 cursor-pointer bg-zinc-50 dark:bg-zinc-800/60 transition-colors"
                  >
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </p>
                    {p.description && (
                      <p className="text-[10px] text-zinc-500 line-clamp-1">
                        {p.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-xs font-bold"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
