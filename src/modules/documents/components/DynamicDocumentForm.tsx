'use client';

import React, { useState } from 'react';
import { FormFieldSchema } from '../documentTypes';
import { AssigneeTableInput } from './AssigneeTableInput';
import { searchProjectsAction } from '../documentActions';

interface DynamicDocumentFormProps {
  schema: FormFieldSchema[];
  formData: Record<string, any>;
  onChange: (key: string, value: any) => void;
  annexThreshold?: number;
}

export const DynamicDocumentForm: React.FC<DynamicDocumentFormProps> = ({
  schema = [],
  formData,
  onChange,
  annexThreshold = 4,
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

  return (
    <div className="space-y-4">
      {schema.map((field) => {
        const value =
          formData[field.key] !== undefined
            ? formData[field.key]
            : field.defaultValue ?? '';

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
          return (
            <div key={field.key} className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>
                  {field.label}{' '}
                  {field.required && <span className="text-red-500">*</span>}
                </span>
              </label>
              <textarea
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-purple-500 focus:outline-hidden resize-y"
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
                  className="text-[11px] text-purple-600 dark:text-purple-400 font-bold hover:underline"
                >
                  📁 Ambil dari Project KIAN HQ
                </button>
              </div>
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
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
