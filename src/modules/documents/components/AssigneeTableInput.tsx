'use client';

import React, { useState, useEffect } from 'react';
import { AssigneeRow } from '../documentTypes';
import { searchTroopersAction } from '../documentActions';

interface AssigneeTableInputProps {
  value: AssigneeRow[];
  onChange: (newValue: AssigneeRow[]) => void;
  annexThreshold?: number;
  columns?: Array<{ key: string; label: string; widthPercent?: number; align?: string }>;
}

export const AssigneeTableInput: React.FC<AssigneeTableInputProps> = ({
  value = [],
  onChange,
  annexThreshold = 4,
  columns,
}) => {
  const [rows, setRows] = useState<AssigneeRow[]>(value);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Dynamic editable columns (exclude 'no')
  const inputColumns = (columns && columns.length > 0)
    ? columns.filter((c) => c.key !== 'no')
    : [
        { key: 'nip', label: 'NIP / NIM' },
        { key: 'name', label: 'Nama Lengkap' },
        { key: 'role', label: 'Tugas / Posisi' },
      ];

  useEffect(() => {
    setRows(value);
  }, [value]);

  const updateParent = (updated: AssigneeRow[]) => {
    // Auto-update 'no' sequence
    const numbered = updated.map((r, i) => ({ ...r, no: i + 1 }));
    setRows(numbered);
    onChange(numbered);
  };

  const handleAddRow = () => {
    const newRow: AssigneeRow = {
      no: rows.length + 1,
      nip: '',
      name: '',
      role: '',
    };
    // Initialize any other keys from columns
    inputColumns.forEach((c) => {
      if (!(c.key in newRow)) {
        (newRow as any)[c.key] = '';
      }
    });
    updateParent([...rows, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    const updated = rows.filter((_, i) => i !== index);
    updateParent(updated);
  };

  const handleFieldChange = (
    index: number,
    field: string,
    val: string
  ) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: val };
    updateParent(updated);
  };

  const handleMoveRow = (index: number, direction: 'UP' | 'DOWN') => {
    if (
      (direction === 'UP' && index === 0) ||
      (direction === 'DOWN' && index === rows.length - 1)
    )
      return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const updated = [...rows];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updateParent(updated);
  };

  // Search troopers from DB
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setIsSearching(true);
    try {
      const res = await searchTroopersAction(query);
      setSearchResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectTrooper = (trooper: any) => {
    const newRow: any = {
      no: rows.length + 1,
    };
    inputColumns.forEach((col) => {
      const k = col.key.toLowerCase();
      if (k === 'name' || k === 'nama') newRow[col.key] = trooper.name || '';
      else if (k === 'nip' || k === 'nim' || k === 'nomor_induk') newRow[col.key] = trooper.nip || '';
      else if (k === 'role' || k === 'tugas' || k === 'posisi' || k === 'jabatan') newRow[col.key] = trooper.roleTitle || trooper.department || 'Trooper';
      else if (k === 'campus' || k === 'kampus' || k === 'institusi' || k === 'universitas') newRow[col.key] = trooper.campus || trooper.university || 'Universitas Indonesia';
      else if (k === 'division' || k === 'divisi' || k === 'department' || k === 'unit') newRow[col.key] = trooper.department || 'Event Production';
      else if (k === 'period' || k === 'periode') newRow[col.key] = 'Sep - Des 2026';
      else newRow[col.key] = '';
    });
    updateParent([...rows, newRow]);
  };

  const isLampiranMode = rows.length >= annexThreshold;

  return (
    <div className="space-y-3">
      {/* Header Info & Action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            Daftar Personil ({rows.length} Orang)
          </span>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {isLampiranMode ? (
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                ℹ️ Jumlah &ge; {annexThreshold} baris: Otomatis dimuat sebagai <strong>Lampiran Halaman 2+</strong>.
              </span>
            ) : (
              <span>
                Jumlah &lt; {annexThreshold} baris: Dirender langsung di halaman utama.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsModalOpen(true);
              handleSearch('');
            }}
            className="px-3 py-1.5 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-600/20 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <span>🔍</span> Cari dari DB Troopers
          </button>
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1"
          >
            <span>+</span> Tambah Baris Manual
          </button>
        </div>
      </div>

      {/* Interactive Table Grid */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2 w-12 text-center">No</th>
                {inputColumns.map((col) => (
                  <th key={col.key} className="px-3 py-2 min-w-[140px]">
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-2 w-28 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={inputColumns.length + 2} className="text-center py-6 text-zinc-400 italic">
                    Belum ada data ditambahkan. Klik &quot;Cari dari DB Troopers&quot; atau &quot;Tambah Baris Manual&quot;.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-3 py-2 text-center font-bold text-zinc-500">
                      {row.no || idx + 1}
                    </td>
                    {inputColumns.map((col) => (
                      <td key={col.key} className="px-3 py-2">
                        <input
                          type="text"
                          value={(row as any)[col.key] || ''}
                          onChange={(e) =>
                            handleFieldChange(idx, col.key, e.target.value)
                          }
                          placeholder={col.label}
                          className={`w-full px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-xs ${
                            col.key === 'name'
                              ? 'font-semibold'
                              : col.key === 'nip'
                              ? 'font-mono'
                              : ''
                          }`}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveRow(idx, 'UP')}
                          disabled={idx === 0}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30"
                          title="Geser Atas"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveRow(idx, 'DOWN')}
                          disabled={idx === rows.length - 1}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30"
                          title="Geser Bawah"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 ml-1"
                          title="Hapus Baris"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Lookup Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>👥</span> Pilih Personil dari Database KIAN HQ
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Ketik nama, email, atau NIM/NIP..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 divide-y divide-zinc-100 dark:divide-zinc-800">
              {isSearching ? (
                <p className="text-center text-xs py-4 text-zinc-400">
                  Mencari personil...
                </p>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-xs py-4 text-zinc-400">
                  Tidak ada user yang cocok.
                </p>
              ) : (
                searchResults.map((t) => (
                  <div
                    key={t.id}
                    className="pt-1.5 flex items-center justify-between gap-2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 rounded-xl cursor-pointer"
                    onClick={() => {
                      handleSelectTrooper(t);
                    }}
                  >
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {t.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        NIP/NIM: {t.nip} • {t.email}
                      </p>
                      {t.department && (
                        <span className="text-[9px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium">
                          {t.department}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700 shrink-0"
                    >
                      + Tambah
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
