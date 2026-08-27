'use client';

import React, { useState, useTransition } from 'react';
import {
  CertificateItem,
  CertificateTemplate,
  CertificateUserOption,
  UserPerformanceMetrics,
} from '@/modules/certificates/certificateTypes';
import { CertificateCardView } from '@/modules/certificates/components/CertificateCardView';
import { CertificatePreviewModal } from '@/modules/certificates/components/CertificatePreviewModal';
import {
  generateCertificateForUser,
  generateCertificatesForAllUsers,
  getCertificates,
  publishCertificates,
  saveCertificateTemplate,
} from '@/modules/certificates/certificateActions';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface CertificateDashboardClientProps {
  initialCertificates: CertificateItem[];
  templates: CertificateTemplate[];
  userOptions: CertificateUserOption[];
  userMetrics: UserPerformanceMetrics;
  myCertificate: CertificateItem | null;
  isAdmin: boolean;
  currentUserId: string;
}

export default function CertificateDashboardClient({
  initialCertificates,
  templates,
  userOptions,
  userMetrics,
  myCertificate: initialMyCert,
  isAdmin,
}: CertificateDashboardClientProps) {
  const [certificates, setCertificates] = useState<CertificateItem[]>(initialCertificates);
  const [activeTab, setActiveTab] = useState<'MY_CERT' | 'MANAGE_USERS' | 'TEMPLATES' | 'BULK'>(
    isAdmin ? 'MANAGE_USERS' : 'MY_CERT'
  );
  const [selectedUserForGen, setSelectedUserForGen] = useState<string>(userOptions[0]?.id || '');
  const [selectedTemplateForGen, setSelectedTemplateForGen] = useState<string>(templates[0]?.id || 'tpl_classic_gold');
  const [previewCert, setPreviewCert] = useState<CertificateItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDownloadingMyCert, setIsDownloadingMyCert] = useState<boolean>(false);

  const [isPending, startTransition] = useTransition();

  // Template Form State (For Edit Template)
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate>(
    templates[0] || {
      id: 'tpl_classic_gold',
      name: 'Classic Gold Honor',
      description: 'Desain klasik',
      layout_type: 'CLASSIC',
      background_color: '#0b0f19',
      border_style: 'GOLD',
      accent_color: '#eab308',
      signatory_name: 'Kian HQ Leadership',
      signatory_title: 'Executive Program Director',
      custom_subtext: 'Sertifikat ini diberikan sebagai bentuk penghargaan resmi.',
      is_active: 1,
      created_at: 0,
      updated_at: 0,
    }
  );

  const myCert = certificates.find((c) => c.user_id === initialMyCert?.user_id) || initialMyCert;

  const refreshCertificates = () => {
    startTransition(async () => {
      const refreshed = await getCertificates();
      setCertificates(refreshed);
    });
  };

  const handleGenerateSingle = (userId: string) => {
    if (!userId) return;
    startTransition(async () => {
      const res = await generateCertificateForUser(userId, selectedTemplateForGen, 'DRAFT');
      if (res.success) {
        alert(`Sertifikat berhasil dibuat/diperbarui! Code: ${res.certificateCode}`);
        refreshCertificates();
      } else {
        alert(`Gagal membuat sertifikat: ${res.error}`);
      }
    });
  };

  const handleGenerateBulk = (status: 'DRAFT' | 'PUBLISHED') => {
    if (!confirm(`Apakah Anda yakin ingin merekap ulang semua data capaian dan membuat sertifikat untuk seluruh (${userOptions.length}) peserta?`)) {
      return;
    }
    startTransition(async () => {
      const res = await generateCertificatesForAllUsers(selectedTemplateForGen, status);
      if (res.success) {
        alert(`Berhasil merekap dan membuat ${res.count} sertifikat peserta!`);
        refreshCertificates();
      } else {
        alert(`Gagal: ${res.error}`);
      }
    });
  };

  const handlePublishToggle = (certId: string, currentStatus: string) => {
    const nextPublish = currentStatus !== 'PUBLISHED';
    startTransition(async () => {
      const res = await publishCertificates([certId], nextPublish);
      if (res.success) {
        if (previewCert && previewCert.id === certId) {
          setPreviewCert({ ...previewCert, status: nextPublish ? 'PUBLISHED' : 'DRAFT' });
        }
        refreshCertificates();
      } else {
        alert(`Gagal mengubah status: ${res.error}`);
      }
    });
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveCertificateTemplate(editingTemplate);
      if (res.success) {
        alert('Template berhasil diperbarui!');
        refreshCertificates();
      } else {
        alert(`Gagal menyimpan template: ${res.error}`);
      }
    });
  };

  const handleDownloadMyPdf = async () => {
    const printElement = document.getElementById('certificate-print-area');
    if (!printElement || !myCert) return;

    try {
      setIsDownloadingMyCert(true);
      const canvas = await html2canvas(printElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      const width = imgWidth * ratio;
      const height = imgHeight * ratio;
      const x = (pdfWidth - width) / 2;
      const y = (pdfHeight - height) / 2;

      pdf.addImage(imgData, 'PNG', x, y, width, height);
      pdf.save(`Sertifikat_${myCert.user_name.replace(/\s+/g, '_')}_${myCert.certificate_code}.pdf`);
    } catch (err) {
      console.error('Download error:', err);
      alert('Gagal mengunduh sertifikat.');
    } finally {
      setIsDownloadingMyCert(false);
    }
  };

  // Filtered Certificates for Admin Table
  const filteredCertificates = certificates.filter((c) => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesQuery =
      searchQuery === '' ||
      c.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.certificate_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.user_email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="w-full space-y-6">
      
      {/* Real-time Loading Overlay */}
      {isPending && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center pointer-events-none">
          <div className="bg-zinc-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-zinc-800 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">Memproses data sertifikat...</span>
          </div>
        </div>
      )}

      {/* Top Header Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('MY_CERT')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'MY_CERT'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          <span>🎖️</span> Sertifikat Saya
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('MANAGE_USERS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'MANAGE_USERS'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              <span>👥</span> Kelola Sertifikat Peserta ({certificates.length})
            </button>

            <button
              onClick={() => setActiveTab('TEMPLATES')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'TEMPLATES'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              <span>🎨</span> Desain & Template ({templates.length})
            </button>

            <button
              onClick={() => setActiveTab('BULK')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'BULK'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              <span>🚀</span> Generasi Massal / Auto Recap
            </button>
          </>
        )}
      </div>

      {/* TAB 1: SERTIFIKAT SAYA (Member / Personal View) */}
      {activeTab === 'MY_CERT' && (
        <div className="space-y-6">
          {/* Performance Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Tugas Selesai</p>
              <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
                {userMetrics.tasks_completed} <span className="text-xs font-medium text-zinc-400">Tasks</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Sparks</p>
              <p className="text-2xl font-black text-amber-500 mt-1">
                ✨ {userMetrics.sparks_earned}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Lencana Achievements</p>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                🏅 {userMetrics.badges_count}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Grade Performa</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {userMetrics.score_grade}
              </p>
            </div>
          </div>

          {/* Certificate View or Pending Banner */}
          {myCert && myCert.status === 'PUBLISHED' ? (
            <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>📜</span> Sertifikat Resmi Kian HQ
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Sertifikat ini telah dipublikasi secara resmi dan terverifikasi secara publik.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-mono font-bold">
                    VERIFIED & PUBLISHED
                  </span>
                </div>
              </div>

              {/* Certificate Canvas Frame */}
              <div className="w-full overflow-x-auto py-2">
                <CertificateCardView
                  certificate={myCert}
                  onDownloadPdf={handleDownloadMyPdf}
                  isDownloading={isDownloadingMyCert}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-3xl mx-auto">
                ⏳
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                Sertifikat Dalam Proses / Pengawasan
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Seluruh capaian dan progres performa Anda (
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">{userMetrics.tasks_completed} tugas</span>,{' '}
                <span className="font-semibold text-amber-500">{userMetrics.sparks_earned} Sparks</span>) telah otomatis terekam oleh sistem. 
                Sertifikat fisik digital dapat diunduh begitu dipublikasi oleh Koordinator/Admin.
              </p>
              {myCert && (
                <div className="inline-block px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                  Status Draf ID: {myCert.certificate_code}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: KELOLA SERTIFIKAT PESERTA (Admin View) */}
      {isAdmin && activeTab === 'MANAGE_USERS' && (
        <div className="space-y-6">
          {/* Quick Generate Single Toolbar */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>⚡</span> Quick Generate Sertifikat Per Peserta
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                value={selectedUserForGen}
                onChange={(e) => setSelectedUserForGen(e.target.value)}
                className="w-full sm:w-auto flex-1 px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-hidden"
              >
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role || 'Trooper'}) — {u.email}
                  </option>
                ))}
              </select>

              <select
                value={selectedTemplateForGen}
                onChange={(e) => setSelectedTemplateForGen(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-hidden"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    Template: {tpl.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleGenerateSingle(selectedUserForGen)}
                className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-sm transition-all"
              >
                + Generate / Recap User
              </button>
            </div>
          </div>

          {/* Filter & Search Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Cari nama peserta / kode sertifikat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white w-full sm:w-64 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-zinc-500">Filter Status:</span>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === 'ALL'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Semua ({certificates.length})
              </button>
              <button
                onClick={() => setStatusFilter('PUBLISHED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === 'PUBLISHED'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Published ({certificates.filter((c) => c.status === 'PUBLISHED').length})
              </button>
              <button
                onClick={() => setStatusFilter('DRAFT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === 'DRAFT'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Draft ({certificates.filter((c) => c.status === 'DRAFT').length})
              </button>
            </div>
          </div>

          {/* Certificates Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950 text-[11px] font-bold text-zinc-400 uppercase border-b border-zinc-200 dark:border-zinc-800">
                    <th className="p-4">Peserta & Email</th>
                    <th className="p-4">Kode Sertifikat</th>
                    <th className="p-4">Capaian Metrics</th>
                    <th className="p-4">Template</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                  {filteredCertificates.length > 0 ? (
                    filteredCertificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-zinc-900 dark:text-white">{cert.user_name}</p>
                          <p className="text-[11px] text-zinc-500">{cert.user_role || 'Trooper'} • {cert.user_email}</p>
                        </td>

                        <td className="p-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                          {cert.certificate_code}
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold">
                              {cert.performance_metrics.tasks_completed} Tasks
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                              ✨ {cert.performance_metrics.sparks_earned}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                              🏅 {cert.performance_metrics.badges_count}
                            </span>
                          </div>
                        </td>

                        <td className="p-4 text-zinc-600 dark:text-zinc-400 font-medium">
                          {cert.template_name || 'Default'}
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                              cert.status === 'PUBLISHED'
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {cert.status}
                          </span>
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setPreviewCert(cert)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white"
                            >
                              👁️ Preview
                            </button>

                            <button
                              onClick={() => handlePublishToggle(cert.id, cert.status)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                cert.status === 'PUBLISHED'
                                  ? 'bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30'
                                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30'
                              }`}
                            >
                              {cert.status === 'PUBLISHED' ? 'Draft' : 'Publish'}
                            </button>

                            <button
                              onClick={() => handleGenerateSingle(cert.user_id)}
                              title="Rekap Ulang Capaian"
                              className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                            >
                              🔄
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500">
                        Belum ada sertifikat yang dibuat. Klik tombol "+ Generate" untuk membuat sertifikat baru.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DESAIN & TEMPLATE MANAGER (Admin View) */}
      {isAdmin && activeTab === 'TEMPLATES' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Template Selection List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Pilih Template Untuk Di-edit</h3>
            <div className="grid grid-cols-1 gap-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setEditingTemplate(tpl)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    editingTemplate.id === tpl.id
                      ? 'bg-amber-500/10 border-amber-500 text-zinc-900 dark:text-white shadow-md'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{tpl.name}</h4>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800">
                      Layout: {tpl.layout_type}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{tpl.description || tpl.custom_subtext}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Template Edit Form */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>⚙️</span> Edit Setting Template: {editingTemplate.name}
            </h3>

            <form onSubmit={handleSaveTemplate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Nama Template</label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Layout Style</label>
                <select
                  value={editingTemplate.layout_type}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      layout_type: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                >
                  <option value="CLASSIC">CLASSIC (Gold Honor Theme)</option>
                  <option value="MODERN">MODERN (Cyber Neon Dark)</option>
                  <option value="ELEGANT">ELEGANT (Corporate Navy Blue)</option>
                  <option value="VIBRANT">VIBRANT (Creative Gradient)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Nama Penanda Tangan</label>
                  <input
                    type="text"
                    value={editingTemplate.signatory_name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, signatory_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Jabatan Penanda Tangan</label>
                  <input
                    type="text"
                    value={editingTemplate.signatory_title}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, signatory_title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Pernyataan Penghargaan (Subtext)</label>
                <textarea
                  rows={3}
                  value={editingTemplate.custom_subtext}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, custom_subtext: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md transition-all"
              >
                Simpan Perubahan Template
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: GENERASI MASSAL / BULK (Admin View) */}
      {isAdmin && activeTab === 'BULK' && (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xs max-w-2xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-600 text-zinc-950 flex items-center justify-center text-3xl mx-auto shadow-lg">
            🚀
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
              Generasi & Rekapitulasi Sertifikat Massal
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              Sistem akan otomatis menghitung akumulasi tugas yang telah diselesaikan, poin Sparks, dan lencana prestasi dari seluruh 
              <span className="font-bold text-zinc-900 dark:text-white"> {userOptions.length} anggota</span> di database Kian HQ.
            </p>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-left text-xs space-y-2">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
              Template yang Digunakan:
            </p>
            <select
              value={selectedTemplateForGen}
              onChange={(e) => setSelectedTemplateForGen(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.layout_type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => handleGenerateBulk('DRAFT')}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              ⚡ Generate Draft Semua Peserta
            </button>

            <button
              onClick={() => handleGenerateBulk('PUBLISHED')}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              🟢 Generate & Langsung Dipublikasikan
            </button>
          </div>
        </div>
      )}

      {/* Certificate Preview Modal */}
      {previewCert && (
        <CertificatePreviewModal
          certificate={previewCert}
          templates={templates}
          isOpen={!!previewCert}
          onClose={() => setPreviewCert(null)}
          onPublishToggle={handlePublishToggle}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
