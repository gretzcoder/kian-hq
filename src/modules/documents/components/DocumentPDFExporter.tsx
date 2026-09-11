'use client';

import React, { useState } from 'react';
import { toPng } from 'html-to-image';
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

    // Temporarily disable parent CSS transforms and scaling wrappers during snapshot for exact A4 bounding box
    const elementsToReset = document.querySelectorAll(
      '.document-preview-sizer, .document-scaler-inner, .transform, [class*="scale-"]'
    );
    const resetStates: { el: HTMLElement; origInlineStyle: string }[] = [];

    elementsToReset.forEach((el) => {
      const htmlEl = el as HTMLElement;
      resetStates.push({
        el: htmlEl,
        origInlineStyle: htmlEl.getAttribute('style') || '',
      });
      // Temporarily remove transform and fixed scaled bounding box for natural 794x1123 A4 snapshot
      htmlEl.style.transform = 'none';
      htmlEl.style.transition = 'none';
      if (htmlEl.classList.contains('document-preview-sizer')) {
        htmlEl.style.width = '794px';
        htmlEl.style.minWidth = '794px';
        htmlEl.style.height = 'auto';
      }
      if (htmlEl.classList.contains('document-scaler-inner')) {
        htmlEl.style.position = 'static';
        htmlEl.style.width = '794px';
      }
    });

    try {
      // Find all rendered page elements in the DOM
      const pageElements = document.querySelectorAll('.document-print-page');

      if (!pageElements || pageElements.length === 0) {
        alert('Elemen dokumen tidak ditemukan untuk diekspor.');
        return;
      }

      // Allow 100ms for layout reflow and font settling
      await new Promise((r) => setTimeout(r, 100));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i] as HTMLElement;

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        // Generate high-resolution PNG using native SVG foreignObject pipeline (supports lab/oklch/Tailwind v4)
        const dataUrl = await toPng(pageEl, {
          quality: 0.98,
          pixelRatio: 2, // 300 DPI high resolution
          backgroundColor: '#FFFFFF',
          cacheBust: true,
          width: 794,
          height: 1123,
          canvasWidth: 794 * 2,
          canvasHeight: 1123 * 2,
          style: {
            transform: 'none',
            width: '794px',
            minWidth: '794px',
            maxWidth: '794px',
            height: '1123px',
            minHeight: '1123px',
            maxHeight: '1123px',
            position: 'static',
            margin: '0',
            boxSizing: 'border-box',
          },
        });

        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }

      const sanitizedTitle = (documentTitle || 'Dokumen_KIAN')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const sanitizedNum = (documentNumber || 'Surat')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');

      pdf.save(`${sanitizedTitle}_${sanitizedNum}.pdf`);
    } catch (err: any) {
      console.error('Export PDF Error:', err);
      alert(
        `Gagal mengekspor PDF: ${err?.message || 'Pastikan browser mengizinkan unduhan berkas.'}`
      );
    } finally {
      // Restore all original parent scales, widths, and styles
      resetStates.forEach(({ el, origInlineStyle }) => {
        if (origInlineStyle) {
          el.setAttribute('style', origInlineStyle);
        } else {
          el.removeAttribute('style');
        }
      });
      setIsExporting(false);
      if (onExportEnd) onExportEnd();
    }
  };

  return (
    <button
      type="button"
      onClick={handleExportPDF}
      disabled={isExporting}
      className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md ${
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




