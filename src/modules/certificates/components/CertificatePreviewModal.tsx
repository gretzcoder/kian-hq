'use client';

import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { CertificateItem, CertificateTemplate } from '../certificateTypes';
import { CertificateCardView } from './CertificateCardView';

interface CertificatePreviewModalProps {
  certificate: CertificateItem;
  templates?: CertificateTemplate[];
  isOpen: boolean;
  onClose: () => void;
  onPublishToggle?: (certificateId: string, currentStatus: string) => void;
  isAdmin?: boolean;
}

export const CertificatePreviewModal: React.FC<CertificatePreviewModalProps> = ({
  certificate,
  templates = [],
  isOpen,
  onClose,
  onPublishToggle,
  isAdmin = false,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(certificate.template_id);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentTemplateOverride = templates.find((t) => t.id === selectedTemplateId) || certificate.template_data || undefined;

  const handleDownloadPdf = async () => {
    const printElement = document.getElementById('certificate-print-area');
    if (!printElement) return;

    try {
      setIsExporting(true);
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
      pdf.save(`Sertifikat_${certificate.user_name.replace(/\s+/g, '_')}_${certificate.certificate_code}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Gagal mengekspor PDF. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] overflow-y-auto">
        
        {/* Top Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📜</span> Preview Sertifikat Personal
            </h2>
            <p className="text-xs text-zinc-400">
              Penerima: <span className="text-zinc-200 font-semibold">{certificate.user_name}</span> ({certificate.user_email})
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Template Override Selector (For Admin/Coordinator) */}
        {isAdmin && templates.length > 0 && (
          <div className="mb-6 bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider shrink-0">
              Pilih Desain / Template:
            </label>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    selectedTemplateId === tpl.id
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Certificate Card Render View */}
        <div className="w-full flex-1 overflow-x-auto py-2">
          <CertificateCardView
            certificate={{
              ...certificate,
              template_id: selectedTemplateId,
            }}
            templateOverride={currentTemplateOverride}
            onDownloadPdf={handleDownloadPdf}
            isDownloading={isExporting}
          />
        </div>

        {/* Bottom Actions Bar */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Status Sertifikat:</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                certificate.status === 'PUBLISHED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {certificate.status}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && onPublishToggle && (
              <button
                onClick={() => onPublishToggle(certificate.id, certificate.status)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  certificate.status === 'PUBLISHED'
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                }`}
              >
                {certificate.status === 'PUBLISHED' ? '🔴 Batalkan Publikasi (Draft)' : '🟢 Publikasikan Sertifikat'}
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
