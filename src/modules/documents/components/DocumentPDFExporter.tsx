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

    // Find all scaled wrapper parents to temporarily unscale them during canvas capture
    const scaledParents: { el: HTMLElement; origTransform: string; origTransition: string }[] = [];
    const elementsToReset = document.querySelectorAll('.transform, [class*="scale-"]');
    elementsToReset.forEach((el) => {
      const htmlEl = el as HTMLElement;
      scaledParents.push({
        el: htmlEl,
        origTransform: htmlEl.style.transform,
        origTransition: htmlEl.style.transition,
      });
      htmlEl.style.transition = 'none';
      htmlEl.style.transform = 'none';
    });

    try {
      // Find all rendered page elements in live DOM
      const pageElements = document.querySelectorAll('.document-print-page');

      if (!pageElements || pageElements.length === 0) {
        alert('Elemen dokumen tidak ditemukan untuk diekspor.');
        return;
      }

      // Wait 80ms for DOM reflow after removing scale transform
      await new Promise((r) => setTimeout(r, 80));

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

        // Wait for all images inside this page to be fully loaded
        const imgs = pageEl.querySelectorAll('img');
        await Promise.all(
          Array.from(imgs).map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((res) => {
              img.onload = res;
              img.onerror = res;
              setTimeout(res, 1000);
            });
          })
        );

        const canvas = await html2canvas(pageEl, {
          scale: 2, // 300 DPI high resolution
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#FFFFFF',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: 794,
          height: 1123,
          windowWidth: 794,
          windowHeight: 1123,
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
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
      alert('Gagal mengekspor PDF. Pastikan seluruh gambar dan konten telah termuat sempurna di layar.');
    } finally {
      // Restore all original parent scales and transitions
      scaledParents.forEach(({ el, origTransform, origTransition }) => {
        el.style.transform = origTransform;
        el.style.transition = origTransition;
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


