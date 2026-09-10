'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DocumentTemplateItem,
  DocumentTypeItem,
  FormFieldSchema,
  KopSuratConfig,
  TemplateLayoutConfig,
} from '../documentTypes';
import {
  createTemplateAction,
  updateTemplateAction,
} from '../templateActions';
import { DocumentCanvas } from './DocumentCanvas';
import {
  DEFAULT_SURAT_TUGAS_LAYOUT,
  DEFAULT_SURAT_TUGAS_SCHEMA,
  DEFAULT_SURAT_TUGAS_VALUES,
} from '../defaultTemplates';

interface TemplateBuilderProps {
  initialTemplate?: DocumentTemplateItem | null;
  documentTypes: DocumentTypeItem[];
}

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  initialTemplate,
  documentTypes = [],
}) => {
  const router = useRouter();
  const isEditing = Boolean(initialTemplate?.id);

  // Form State
  const [name, setName] = useState(initialTemplate?.name || 'Surat Tugas KIAN Troopers');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [typeId, setTypeId] = useState(initialTemplate?.type_id || documentTypes[0]?.id || 'doctype_surat_tugas');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE'>(initialTemplate?.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE');

  // Layout & Schema Config
  const [layoutConfig, setLayoutConfig] = useState<TemplateLayoutConfig>(
    initialTemplate?.layout_config || DEFAULT_SURAT_TUGAS_LAYOUT
  );
  const [formSchema, setFormSchema] = useState<FormFieldSchema[]>(
    initialTemplate?.form_schema || DEFAULT_SURAT_TUGAS_SCHEMA
  );
  const [defaultValues, setDefaultValues] = useState<Record<string, any>>(
    initialTemplate?.default_values || DEFAULT_SURAT_TUGAS_VALUES
  );

  // Sample data for previewing live canvas in builder
  const [previewData, setPreviewData] = useState<Record<string, any>>(
    initialTemplate?.sample_data || defaultValues
  );

  const [activeTab, setActiveTab] = useState<'INFO' | 'KOP_SURAT' | 'LAYOUT' | 'DEFAULTS'>('KOP_SURAT');
  const [selectedKopElement, setSelectedKopElement] = useState<'logo' | 'tagline' | 'titleBlock' | 'flowLimit' | null>('logo');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const kopConfig: KopSuratConfig = layoutConfig.kopConfig || {
    frameAssetUrl: '',
    frameOpacity: 1,
    kopHeightPx: 215,
    logo: {
      enabled: true,
      x: 56,
      y: 44,
      width: 220,
      height: 48,
    },
    tagline: {
      enabled: true,
      text: 'Kreasi Inovasi Anak Nusantara',
      x: 56,
      y: 92,
      fontSizePt: 8.5,
      color: '#4B5563',
    },
    titleBlock: {
      enabled: true,
      x: 56,
      y: 138,
      width: 682,
      align: 'center',
      titleFontSizePt: 13,
      numberFontSizePt: 10,
    },
  };

  const handleKopChange = (newKop: KopSuratConfig) => {
    setLayoutConfig((prev) => ({
      ...prev,
      kopConfig: newKop,
    }));
  };

  // Upload custom frame PNG/JPG
  const handleUploadFrame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Ukuran file frame maksimal 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleKopChange({
        ...kopConfig,
        frameAssetUrl: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  // Upload custom logo PNG/JPG
  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file logo maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleKopChange({
        ...kopConfig,
        logo: {
          ...kopConfig.logo,
          assetUrl: base64,
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const handleResetKopLayout = () => {
    if (!confirm('Kembalikan posisi Kop Surat ke default standar KIAN?')) return;
    handleKopChange({
      ...kopConfig,
      kopHeightPx: 215,
      logo: {
        enabled: true,
        assetUrl: kopConfig.logo.assetUrl,
        x: 56,
        y: 44,
        width: 220,
        height: 48,
      },
      tagline: {
        enabled: true,
        text: 'Kreasi Inovasi Anak Nusantara',
        x: 56,
        y: 92,
        fontSizePt: 8.5,
        color: '#4B5563',
      },
      titleBlock: {
        enabled: true,
        x: 56,
        y: 138,
        width: 682,
        align: 'center',
        titleFontSizePt: 13,
        numberFontSizePt: 10,
      },
    });
  };

  const handleSaveTemplate = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Nama template wajib diisi.' });
      return;
    }
    if (!typeId) {
      setMessage({ type: 'error', text: 'Pilih jenis dokumen terlebih dahulu.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      if (isEditing && initialTemplate) {
        const res = await updateTemplateAction(initialTemplate.id, {
          name,
          description,
          status,
          layout_config: layoutConfig,
          form_schema: formSchema,
          default_values: defaultValues,
          sample_data: previewData,
          forceNewVersion: true,
        });

        if (res.success) {
          setMessage({
            type: 'success',
            text: `Template berhasil diperbarui ke Versi ${res.newVersion || initialTemplate.current_version + 1}!`,
          });
          setTimeout(() => {
            router.push('/dashboard/documents/templates');
            router.refresh();
          }, 1200);
        } else {
          setMessage({ type: 'error', text: res.error || 'Gagal menyimpan template.' });
        }
      } else {
        const res = await createTemplateAction({
          name,
          description,
          type_id: typeId,
          status,
          layout_config: layoutConfig,
          form_schema: formSchema,
          default_values: defaultValues,
          sample_data: previewData,
        });

        if (res.success) {
          setMessage({ type: 'success', text: 'Template baru berhasil dibuat (v1)!' });
          setTimeout(() => {
            router.push('/dashboard/documents/templates');
            router.refresh();
          }, 1200);
        } else {
          setMessage({ type: 'error', text: res.error || 'Gagal membuat template.' });
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🎨</span>
            <span>{isEditing ? `Edit Template: ${initialTemplate?.name}` : 'Buat Template Dokumen Baru'}</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {isEditing
              ? `Versi saat ini: v${initialTemplate?.current_version} • Perubahan disimpan sebagai versi baru tanpa merusak dokumen lama.`
              : 'Upload frame, custom logo & posisi kop surat secara bebas dengan drag & drop.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>{isEditing ? 'Simpan Versi Baru' : 'Publikasikan Template'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'
              : 'bg-red-500/10 border border-red-500/30 text-red-500'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Template Config Inspector */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-5">
          {/* Tab Selector */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl overflow-x-auto">
            {[
              { id: 'KOP_SURAT', label: '📐 Kop & Frame' },
              { id: 'INFO', label: '1. Info' },
              { id: 'LAYOUT', label: '2. Lampiran' },
              { id: 'DEFAULTS', label: '3. Konten' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB: KOP SURAT & FRAME DESIGNER */}
          {activeTab === 'KOP_SURAT' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl text-[11px] text-purple-700 dark:text-purple-300">
                ✨ <strong>Drag &amp; Drop Kop Surat Aktif:</strong> Anda dapat langsung mengklik &amp; menggeser <strong>Logo</strong>, <strong>Tagline</strong>, <strong>Judul Surat</strong>, atau <strong>Garis Batas Mulai Isi Konten</strong> langsung pada Canvas A4 di sebelah kanan!
              </div>

              {/* 1. Upload Custom Frame Background */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>🖼️</span> Frame Background Dokumen (PNG/JPG)
                  </label>
                  {kopConfig.frameAssetUrl && (
                    <button
                      type="button"
                      onClick={() => handleKopChange({ ...kopConfig, frameAssetUrl: '' })}
                      className="text-[10px] text-red-500 hover:underline font-bold"
                    >
                      Hapus Frame Custom
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleUploadFrame}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                />

                {kopConfig.frameAssetUrl ? (
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>✓ Frame gambar custom aktif</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-400">
                    Gunakan frame vector bawaan KIAN Troopers, atau upload background PNG format A4 Anda sendiri.
                  </p>
                )}
              </div>

              {/* 2. Upload Custom Logo */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>👑</span> Logo Kop Surat
                  </label>
                  {kopConfig.logo.assetUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        handleKopChange({
                          ...kopConfig,
                          logo: { ...kopConfig.logo, assetUrl: undefined },
                        })
                      }
                      className="text-[10px] text-red-500 hover:underline font-bold"
                    >
                      Reset Logo Vektor
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={handleUploadLogo}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                />
              </div>

              {/* 3. Kop Elements Coordinate Inspector */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Posisi Presisi Elemen Kop
                  </span>
                  <button
                    type="button"
                    onClick={handleResetKopLayout}
                    className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-bold"
                  >
                    ↺ Reset Posisi
                  </button>
                </div>

                {/* LOGO INSPECTOR */}
                <div
                  onClick={() => setSelectedKopElement('logo')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedKopElement === 'logo'
                      ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      1. Logo Header
                    </span>
                    <span className="text-[10px] text-purple-600 font-mono">
                      X: {kopConfig.logo.x}px | Y: {kopConfig.logo.y}px
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500">Posisi X (px)</label>
                      <input
                        type="number"
                        value={kopConfig.logo.x}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            logo: { ...kopConfig.logo, x: parseInt(e.target.value, 10) || 0 },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500">Posisi Y (px)</label>
                      <input
                        type="number"
                        value={kopConfig.logo.y}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            logo: { ...kopConfig.logo, y: parseInt(e.target.value, 10) || 0 },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500">Lebar (px)</label>
                      <input
                        type="number"
                        value={kopConfig.logo.width}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            logo: { ...kopConfig.logo, width: parseInt(e.target.value, 10) || 100 },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* TAGLINE INSPECTOR */}
                <div
                  onClick={() => setSelectedKopElement('tagline')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedKopElement === 'tagline'
                      ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      2. Subtitle / Tagline
                    </span>
                    <span className="text-[10px] text-purple-600 font-mono">
                      X: {kopConfig.tagline.x}px | Y: {kopConfig.tagline.y}px
                    </span>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={kopConfig.tagline.text}
                      onChange={(e) =>
                        handleKopChange({
                          ...kopConfig,
                          tagline: { ...kopConfig.tagline, text: e.target.value },
                        })
                      }
                      placeholder="Teks Tagline..."
                      className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-zinc-500">Posisi X (px)</label>
                        <input
                          type="number"
                          value={kopConfig.tagline.x}
                          onChange={(e) =>
                            handleKopChange({
                              ...kopConfig,
                              tagline: { ...kopConfig.tagline, x: parseInt(e.target.value, 10) || 0 },
                            })
                          }
                          className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500">Posisi Y (px)</label>
                        <input
                          type="number"
                          value={kopConfig.tagline.y}
                          onChange={(e) =>
                            handleKopChange({
                              ...kopConfig,
                              tagline: { ...kopConfig.tagline, y: parseInt(e.target.value, 10) || 0 },
                            })
                          }
                          className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* TITLE & NUMBER INSPECTOR */}
                <div
                  onClick={() => setSelectedKopElement('titleBlock')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedKopElement === 'titleBlock'
                      ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      3. Blok Judul &amp; Nomor Surat
                    </span>
                    <span className="text-[10px] text-purple-600 font-mono">
                      Y: {kopConfig.titleBlock.y}px
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500">Posisi Y (px)</label>
                      <input
                        type="number"
                        value={kopConfig.titleBlock.y}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            titleBlock: { ...kopConfig.titleBlock, y: parseInt(e.target.value, 10) || 0 },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500">Alignment</label>
                      <select
                        value={kopConfig.titleBlock.align}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            titleBlock: { ...kopConfig.titleBlock, align: e.target.value as any },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                      >
                        <option value="center">Tengah (Center)</option>
                        <option value="left">Kiri (Left)</option>
                        <option value="right">Kanan (Right)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500">Ukuran Font</label>
                      <input
                        type="number"
                        value={kopConfig.titleBlock.titleFontSizePt}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            titleBlock: { ...kopConfig.titleBlock, titleFontSizePt: parseInt(e.target.value, 10) || 12 },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* FLOW START LIMIT HEIGHT */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Tinggi Kop Surat / Batas Awal Konten Dinamis
                    </label>
                    <span className="text-xs font-mono font-bold text-purple-600">
                      {kopConfig.kopHeightPx} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={140}
                    max={400}
                    value={kopConfig.kopHeightPx}
                    onChange={(e) =>
                      handleKopChange({
                        ...kopConfig,
                        kopHeightPx: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-zinc-400">
                    Isi surat (paragraf, tabel petugas, rincian event) akan otomatis mengalir di bawah batas tinggi ini.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: BASIC INFO */}
          {activeTab === 'INFO' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Nama Template <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Surat Tugas KIAN Troopers"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Jenis Dokumen (Document Type) <span className="text-red-500">*</span>
                </label>
                <select
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold"
                >
                  {documentTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.icon} {dt.name} ({dt.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Status Template
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === 'ACTIVE'}
                      onChange={() => setStatus('ACTIVE')}
                      className="text-purple-600"
                    />
                    <span>🟢 Active (Dapat digunakan user)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === 'DRAFT'}
                      onChange={() => setStatus('DRAFT')}
                      className="text-purple-600"
                    />
                    <span>🟡 Draft</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Deskripsi / Petunjuk Penggunaan
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deskripsi singkat fungsi template ini..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: LAYOUT SETTINGS */}
          {activeTab === 'LAYOUT' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl text-[11px] text-purple-700 dark:text-purple-300">
                ⚡ <strong>Hybrid Flow Layout Engine:</strong> Frame tepi dan posisi kop surat dapat Anda sesuaikan bebas, sementara tabel petugas, rincian event, penutup, dan tanda tangan mengalir secara dinamis.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Ambang Batas Lampiran Otomatis (Annex Threshold)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={layoutConfig.annexThresholdRows ?? 4}
                  onChange={(e) =>
                    setLayoutConfig({
                      ...layoutConfig,
                      annexThresholdRows: parseInt(e.target.value, 10) || 4,
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono font-bold"
                />
                <p className="text-[10px] text-zinc-400">
                  Jika personil &ge; {layoutConfig.annexThresholdRows ?? 4}, tabel otomatis dipindahkan ke Lampiran Halaman 2+.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Ukuran Dokumen &amp; Font Dasar
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-mono font-semibold text-center">
                    A4 Portrait (210mm × 297mm)
                  </div>
                  <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-serif text-center">
                    Times New Roman (10.5pt)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEFAULT VALUES */}
          {activeTab === 'DEFAULTS' && (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-500">
                Nilai bawaan ini akan otomatis terisi saat koordinator membuat surat baru.
              </p>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  Default Judul Dokumen
                </label>
                <input
                  type="text"
                  value={defaultValues.document_title || ''}
                  onChange={(e) => {
                    const next = { ...defaultValues, document_title: e.target.value };
                    setDefaultValues(next);
                    setPreviewData(next);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  Default Jabatan Penandatangan
                </label>
                <input
                  type="text"
                  value={defaultValues.signatory_position || ''}
                  onChange={(e) => {
                    const next = { ...defaultValues, signatory_position: e.target.value };
                    setDefaultValues(next);
                    setPreviewData(next);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  Default Nama Penandatangan
                </label>
                <input
                  type="text"
                  value={defaultValues.signatory_name || ''}
                  onChange={(e) => {
                    const next = { ...defaultValues, signatory_name: e.target.value };
                    setDefaultValues(next);
                    setPreviewData(next);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  Default Kalimat Penutup
                </label>
                <textarea
                  value={defaultValues.closing_text || ''}
                  onChange={(e) => {
                    const next = { ...defaultValues, closing_text: e.target.value };
                    setDefaultValues(next);
                    setPreviewData(next);
                  }}
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive A4 Visual Canvas Preview & Drag Area */}
        <div className="lg:col-span-7 bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center overflow-x-auto shadow-inner">
          <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <span>🖱️</span> Drag Canvas Kop Surat (A4)
            </span>
            <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono px-2 py-0.5 rounded-full font-bold">
              Klik &amp; Drag Elemen
            </span>
          </div>

          <div className="transform origin-top scale-[0.75] sm:scale-[0.85] xl:scale-[0.95] transition-transform duration-200">
            <DocumentCanvas
              formData={previewData}
              layoutConfig={layoutConfig}
              previewMode
              isBuilderInteractive
              selectedKopElement={selectedKopElement}
              onSelectKopElement={setSelectedKopElement}
              onKopConfigChange={handleKopChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
