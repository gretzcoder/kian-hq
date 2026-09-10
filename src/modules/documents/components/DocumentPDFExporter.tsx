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

  // Helper to convert any remote images to in-memory Base64 Data URLs so canvas is never tainted
  const convertImagesToDataUrls = async (container: HTMLElement) => {
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map(async (img) => {
        const src = img.getAttribute('src') || img.src;
        if (!src || src.startsWith('data:')) return;

        // Try direct canvas extraction if image is already loaded
        try {
          if (img.complete && img.naturalWidth > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const dataUri = canvas.toDataURL('image/png');
              img.src = dataUri;
              img.setAttribute('src', dataUri);
              return;
            }
          }
        } catch {
          // If canvas drawImage triggers cross-origin warning, try fetch fallback
        }

        // Fetch fallback with blob reader
        try {
          const res = await fetch(src, { mode: 'cors' });
          if (res.ok) {
            const blob = await res.blob();
            const dataUri = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            img.src = dataUri;
            img.setAttribute('src', dataUri);
          }
        } catch {
          img.crossOrigin = 'anonymous';
        }
      })
    );
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    if (onExportStart) onExportStart();

    // Temporarily disable parent CSS transforms for pixel-perfect bounding box calculation
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
      // Find all rendered page elements in the DOM
      const pageElements = document.querySelectorAll('.document-print-page');

      if (!pageElements || pageElements.length === 0) {
        alert('Elemen dokumen tidak ditemukan untuk diekspor.');
        return;
      }

      // Allow 80ms for layout reflow
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

        // Convert any remote image URLs to safe data URIs before rendering
        await convertImagesToDataUrls(pageEl);

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        const canvas = await html2canvas(pageEl, {
          scale: 2, // 300 DPI high resolution
          useCORS: true,
          allowTaint: false, // Must be false to allow canvas.toDataURL() without SecurityError
          backgroundColor: '#FFFFFF',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: 794,
          height: 1123,
          windowWidth: 794,
          windowHeight: 1123,
          onclone: (clonedDoc) => {
            // Normalize all scales and transitions inside html2canvas internal clone
            const allScaled = clonedDoc.querySelectorAll('.transform, [class*="scale-"]');
            allScaled.forEach((node) => {
              const el = node as HTMLElement;
              el.style.transform = 'none';
              el.style.transition = 'none';
            });
          },
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
    } catch (err: any) {
      console.error('Export PDF Error:', err);
      alert(
        `Gagal mengekspor PDF: ${err?.message || 'Pastikan browser mengizinkan unduhan berkas.'}`
      );
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



