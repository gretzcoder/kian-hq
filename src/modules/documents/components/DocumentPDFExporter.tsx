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

  // Helper to convert images to safe inline data URLs to bypass CORS restrictions during export
  const prepareSafeClone = async (sourceElement: HTMLElement): Promise<HTMLElement> => {
    const clone = sourceElement.cloneNode(true) as HTMLElement;
    
    // Reset any CSS transforms, scales, animations or shadows on the clone
    clone.style.transform = 'none';
    clone.style.transformOrigin = 'top left';
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    clone.style.width = '794px';
    clone.style.minWidth = '794px';
    clone.style.maxWidth = '794px';
    clone.style.height = '1123px';
    clone.style.minHeight = '1123px';
    clone.style.maxHeight = '1123px';
    clone.style.position = 'relative';

    // Ensure all images have crossOrigin attribute set or are loaded
    const imgs = clone.querySelectorAll('img');
    await Promise.all(
      Array.from(imgs).map(async (img) => {
        try {
          img.crossOrigin = 'anonymous';
          if (!img.complete) {
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
              setTimeout(resolve, 1500); // 1.5s timeout
            });
          }
        } catch {
          // ignore individual image failure
        }
      })
    );

    return clone;
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    if (onExportStart) onExportStart();

    // Create an offscreen sandbox container
    const sandbox = document.createElement('div');
    sandbox.style.position = 'fixed';
    sandbox.style.left = '-99999px';
    sandbox.style.top = '0';
    sandbox.style.width = '794px';
    sandbox.style.zIndex = '-1000';
    sandbox.style.background = '#FFFFFF';
    sandbox.style.overflow = 'hidden';
    document.body.appendChild(sandbox);

    try {
      // Find all rendered page elements
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
        const safeClone = await prepareSafeClone(pageEl);

        sandbox.innerHTML = '';
        sandbox.appendChild(safeClone);

        // Give browser 50ms to reflow layout
        await new Promise((r) => setTimeout(r, 50));

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        const canvas = await html2canvas(safeClone, {
          scale: 2, // 300 DPI clarity
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#FFFFFF',
          logging: false,
          windowWidth: 794,
          windowHeight: 1123,
        });

        const imgData = canvas.toDataURL('image/png', 0.95);
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
      // Fallback: suggest / trigger native print
      const tryPrint = confirm(
        'Gagal mengekspor PDF secara otomatis. Apakah Anda ingin membuka dialog Cetak / Simpan PDF (Native A4)?'
      );
      if (tryPrint) {
        window.print();
      }
    } finally {
      if (document.body.contains(sandbox)) {
        document.body.removeChild(sandbox);
      }
      setIsExporting(false);
      if (onExportEnd) onExportEnd();
    }
  };

  const handleNativePrint = () => {
    window.print();
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleExportPDF}
        disabled={isExporting}
        className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md ${
          isExporting
            ? 'bg-zinc-400 text-white cursor-wait'
            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white active:scale-95 shadow-purple-500/20'
        }`}
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

      <button
        type="button"
        onClick={handleNativePrint}
        className="px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 active:scale-95"
        title="Cetak atau Simpan PDF resolusi tinggi menggunakan printer dialog"
      >
        <span>🖨️</span>
        <span className="hidden sm:inline">Cetak / Vektor</span>
      </button>
    </div>
  );
};

