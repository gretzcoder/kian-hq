'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface DocumentPreviewContainerProps {
  children: React.ReactNode;
  className?: string;
  showToolbar?: boolean;
  defaultMode?: 'fit' | '100' | 'custom';
  initialScale?: number;
}

export const DocumentPreviewContainer: React.FC<DocumentPreviewContainerProps> = ({
  children,
  className = '',
  showToolbar = true,
  defaultMode = 'fit',
  initialScale,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<'fit' | '100' | 'custom'>(defaultMode);
  const [scale, setScale] = useState<number>(initialScale || 1);
  const [contentHeight, setContentHeight] = useState<number>(1123);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Measure content height (e.g. 1123px for 1 page, 2278px for 2 pages with gap, etc.)
  useEffect(() => {
    if (!contentRef.current) return;

    const measureHeight = () => {
      if (contentRef.current) {
        const h = contentRef.current.offsetHeight || contentRef.current.scrollHeight;
        if (h > 0) {
          setContentHeight(h);
        }
      }
    };

    measureHeight();

    const resizeObserver = new ResizeObserver(() => {
      measureHeight();
    });

    resizeObserver.observe(contentRef.current);
    return () => resizeObserver.disconnect();
  }, [children]);

  // Calculate auto-fit scale based on container width & window height
  const updateFitScale = useCallback(() => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    setContainerWidth(cw);

    if (cw <= 0) return;

    // Available width with a small padding margin (16px on mobile, 32px on desktop)
    const padding = cw < 640 ? 16 : 32;
    const availableWidth = Math.max(240, cw - padding);
    const fitWidthScale = Math.min(1.0, Number((availableWidth / 794).toFixed(3)));

    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const availableHeight = Math.max(320, vh - 220);
    const fitPageScale = Math.min(1.0, Number((availableHeight / 1123).toFixed(3)));

    if (mode === 'fit') {
      // Smart fit: on mobile use width fit, on desktop balance height & width so full page is visible
      const smartScale = cw < 640 ? fitWidthScale : Math.min(fitWidthScale, fitPageScale);
      setScale(smartScale);
    }
  }, [mode]);

  useEffect(() => {
    updateFitScale();

    const handleResize = () => {
      updateFitScale();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateFitScale]);

  // Handle Mode & Zoom Adjustments
  const handleSetFit = () => {
    setMode('fit');
    if (containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const padding = cw < 640 ? 16 : 32;
      const availableWidth = Math.max(240, cw - padding);
      const fitWidthScale = Math.min(1.0, Number((availableWidth / 794).toFixed(3)));
      const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
      const availableHeight = Math.max(320, vh - 220);
      const fitPageScale = Math.min(1.0, Number((availableHeight / 1123).toFixed(3)));
      const smartScale = cw < 640 ? fitWidthScale : Math.min(fitWidthScale, fitPageScale);
      setScale(smartScale);
    }
  };

  const handleSet100 = () => {
    setMode('100');
    setScale(1.0);
  };

  const handleZoomIn = () => {
    setMode('custom');
    setScale((prev) => Math.min(1.75, Number((prev + 0.15).toFixed(2))));
  };

  const handleZoomOut = () => {
    setMode('custom');
    setScale((prev) => Math.max(0.25, Number((prev - 0.15).toFixed(2))));
  };

  const zoomPercent = Math.round(scale * 100);
  const sizerWidth = Math.round(794 * scale);
  const sizerHeight = Math.round(contentHeight * scale);

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      {/* Floating / Top Zoom Controls Bar */}
      {showToolbar && (
        <div className="no-print w-full flex flex-wrap items-center justify-between gap-2.5 mb-4 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <span>📄</span> Pratinjau Dokumen
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
              {zoomPercent}%
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 0.3}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all disabled:opacity-40"
              title="Perkecil (-)"
            >
              －
            </button>

            <button
              type="button"
              onClick={handleSetFit}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'fit'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              title="Paskan dokumen secara otomatis dengan layar"
            >
              📱 Paskan Layar
            </button>

            <button
              type="button"
              onClick={handleSet100}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === '100'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              title="Ukuran Asli 100%"
            >
              100%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 1.75}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all disabled:opacity-40"
              title="Perbesar (+)"
            >
              ＋
            </button>
          </div>
        </div>
      )}

      {/* Outer Scaled Viewport Container */}
      <div
        ref={containerRef}
        className="document-preview-outer w-full bg-zinc-100/90 dark:bg-zinc-950 p-3 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex justify-center overflow-x-auto shadow-inner print:p-0 print:m-0 print:bg-white print:border-none print:shadow-none"
      >
        {/* Sizing Wrapper: forces layout box to match scaled dimensions */}
        <div
          className="document-preview-sizer relative transition-[width,height] duration-150 ease-out print:w-auto print:h-auto print:static"
          style={{
            width: `${sizerWidth}px`,
            minWidth: `${sizerWidth}px`,
            height: `${sizerHeight}px`,
          }}
        >
          {/* Inner Scaled Container */}
          <div
            ref={contentRef}
            className="document-scaler-inner transform origin-top-left absolute top-0 left-0 print:static print:transform-none"
            style={{
              width: '794px',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
