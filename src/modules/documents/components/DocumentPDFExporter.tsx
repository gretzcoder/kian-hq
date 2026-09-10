'use client';

import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface DocumentPDFExporterProps {
  documentNumber: string;
  documentTitle: string;
  className?: string;
  onExportStart?: () => void;
  onExportEnd?: () => void;
}

export const DocumentPDFExporter: React.FC<DocumentPDFExporterProps> = ({
  documentNumber,
  documentTitle,
  className = '',
  onExportStart,
  onExportEnd,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    if (onExportStart) onExportStart();

    try {
      // Find all rendered page elements (Page 1, Page 2 Lampiran, etc.)
      const pageElements = document.querySelectorAll('.document-print-page');

      if (!pageElements || pageElements.length === 0) {
        alert('Elemen dokumen tidak ditemukan untuk diekspor.');
        return;
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i] as HTMLElement;

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        const canvas = await html2canvas(pageEl, {
          scale: 2, // 300 DPI high clarity
          useCORS: true,
          backgroundColor: '#FFFFFF',
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }

      const sanitizedTitle = (documentTitle || 'Dokumen_KIAN')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const sanitizedNum = (documentNumber || 'Surat')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');

      pdf.save(`${sanitizedTitle}_${sanitizedNum}.pdf`);
    } catch (err) {
      console.error('Export PDF Error:', err);
      alert('Gagal mengekspor PDF. Pastikan gambar dan aset dapat dimuat dengan baik.');
    } finally {
      setIsExporting(false);
      if (onExportEnd) onExportEnd();
    }
  };

  return (
    <button
      type="button"
      onClick={handleExportPDF}
      disabled={isExporting}
      className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md ${
        isExporting
          ? 'bg-zinc-400 text-white cursor-wait'
          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white active:scale-95 shadow-purple-500/20'
      } ${className}`}
    >
      {isExporting ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Memproses PDF...</span>
        </>
      ) : (
        <>
          <span>📥</span>
          <span>Download PDF Resmi (A4)</span>
        </>
      )}
    </button>
  );
};
