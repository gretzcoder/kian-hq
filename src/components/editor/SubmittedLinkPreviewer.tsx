'use client';

import { useState } from 'react';
import { DocxDocumentViewer } from './TiptapEditor';

export type ParsedLinkInfo =
  | { type: 'CANVA'; embedUrl?: string; originalUrl: string; label: string; icon: string; isShortlink?: boolean }
  | { type: 'GDRIVE_FILE'; embedUrl: string; originalUrl: string; label: string; icon: string }
  | { type: 'GDRIVE_FOLDER'; embedUrl: string; originalUrl: string; label: string; icon: string }
  | { type: 'FIGMA'; embedUrl: string; originalUrl: string; label: string; icon: string }
  | { type: 'LOOM'; embedUrl: string; originalUrl: string; label: string; icon: string }
  | { type: 'YOUTUBE'; embedUrl: string; originalUrl: string; label: string; icon: string }
  | { type: 'HTML_DOC'; htmlContent: string; originalUrl: string; label: string; icon: string; titleSnippet: string; extractedLink?: string }
  | { type: 'OTHER'; embedUrl?: string; originalUrl: string; label: string; icon: string };

export function parseSubmittedLink(rawUrl: string): ParsedLinkInfo {
  let url = (rawUrl ?? '').trim();
  if (!url) {
    return { type: 'OTHER', originalUrl: '', label: 'Link Result', icon: '🔗' };
  }

  // 0. Detect HTML rich text or multiline document content
  const isHtml = /<[a-z][\s\S]*>/i.test(url) || url.includes('</p>') || url.includes('</div>') || url.includes('</span>') || url.includes('</ul>') || url.includes('</ol>') || url.includes('<h');
  const isMultiline = url.includes('\n');

  if (isHtml || isMultiline) {
    const textOnly = url.replace(/<[^>]*>/g, '').trim();
    const hrefMatch = url.match(/href=["'](https?:\/\/[^"']+)["']/i);
    const firstUrlMatch = url.match(/(https?:\/\/[^\s<"']+)/i);

    // If it's just a single URL wrapped inside a single tag (e.g. <p><a href="https://drive...">...</a></p>)
    const isSingleWrappedUrl =
      (hrefMatch && (textOnly === hrefMatch[1] || textOnly.startsWith('http'))) ||
      (!url.includes('<h') && !url.includes('<ul') && !url.includes('<ol') && textOnly.length < 250 && firstUrlMatch && textOnly === firstUrlMatch[1]);

    if (isSingleWrappedUrl) {
      url = hrefMatch ? hrefMatch[1] : firstUrlMatch![1];
    } else {
      // It's a full rich text document report
      const cleanSnippet = textOnly.slice(0, 120) + (textOnly.length > 120 ? '...' : '');
      const extractedLink = hrefMatch ? hrefMatch[1] : firstUrlMatch ? firstUrlMatch[1] : undefined;
      return {
        type: 'HTML_DOC',
        htmlContent: rawUrl,
        originalUrl: extractedLink || '',
        label: 'Dokumen Laporan Teks (.docx)',
        icon: '📄',
        titleSnippet: cleanSnippet || 'Dokumen Laporan Teks',
        extractedLink,
      };
    }
  }

  // 1. Canva (both canva.com/design and shortlinks like canva.link / canva.me / canva.site)
  if (
    url.includes('canva.com') ||
    url.includes('canva.link') ||
    url.includes('canva.me') ||
    url.includes('canva.site')
  ) {
    const match = url.match(/canva\.com\/design\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
    let embedUrl: string | undefined = undefined;
    if (match && match[1]) {
      const designId = match[1];
      const hash = match[2] ? `/${match[2]}` : '';
      embedUrl = `https://www.canva.com/design/${designId}${hash}/view?embed`;
    }
    const isShortlink = !match;
    return {
      type: 'CANVA',
      embedUrl,
      originalUrl: url,
      label: isShortlink ? 'Canva Design & Asset (Shortlink)' : 'Canva Design & Asset',
      icon: '🎨',
      isShortlink,
    };
  }

  // 2. Google Docs
  const docMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch?.[1]) {
    return {
      type: 'GDRIVE_FILE',
      embedUrl: `https://docs.google.com/document/d/${docMatch[1]}/preview`,
      originalUrl: url,
      label: 'Google Docs Document',
      icon: '📝',
    };
  }

  // 3. Google Slides
  const presMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (presMatch?.[1]) {
    return {
      type: 'GDRIVE_FILE',
      embedUrl: `https://docs.google.com/presentation/d/${presMatch[1]}/embed`,
      originalUrl: url,
      label: 'Google Slides Presentation',
      icon: '📊',
    };
  }

  // 4. Google Sheets
  const sheetMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch?.[1]) {
    return {
      type: 'GDRIVE_FILE',
      embedUrl: `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/pubhtml?widget=true&headers=false`,
      originalUrl: url,
      label: 'Google Sheets Spreadsheet',
      icon: '📈',
    };
  }

  // 5. Google Drive File
  const driveFileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1] && (url.includes('drive.google.com') || url.includes('docs.google.com'))) {
    const fileId = driveFileMatch[1];
    return {
      type: 'GDRIVE_FILE',
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      originalUrl: url,
      label: 'Google Drive File',
      icon: '📁',
    };
  }

  // 6. Google Drive Folder
  const driveFolderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (driveFolderMatch && driveFolderMatch[1] && url.includes('drive.google.com')) {
    const folderId = driveFolderMatch[1];
    return {
      type: 'GDRIVE_FOLDER',
      embedUrl: `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`,
      originalUrl: url,
      label: 'Google Drive Folder',
      icon: '📂',
    };
  }

  // 7. Figma
  if (url.includes('figma.com/')) {
    return {
      type: 'FIGMA',
      embedUrl: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`,
      originalUrl: url,
      label: 'Figma Design File',
      icon: '🎨',
    };
  }

  // 8. Loom
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9_-]+)/);
  if (loomMatch?.[1]) {
    return {
      type: 'LOOM',
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
      originalUrl: url,
      label: 'Loom Video Recording',
      icon: '📹',
    };
  }

  // 9. Youtube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch?.[1]) {
    return {
      type: 'YOUTUBE',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      originalUrl: url,
      label: 'YouTube Video',
      icon: '▶️',
    };
  }

  // Fallback for any HTTP/HTTPS URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return {
      type: 'OTHER',
      embedUrl: url,
      originalUrl: url,
      label: 'Submitted Web Result',
      icon: '🔗',
    };
  }

  return {
    type: 'OTHER',
    originalUrl: url,
    label: 'Link Result',
    icon: '🔗',
  };
}

export function SubmittedLinkPreviewer({
  url,
  autoExpand = true,
}: {
  url: string;
  autoExpand?: boolean;
}) {
  const [showPreview, setShowPreview] = useState(autoExpand);
  const [loaded, setLoaded] = useState(false);
  const info = parseSubmittedLink(url);

  // Render rich text HTML document report (e.g. DOCX Tiptap reports)
  if (info.type === 'HTML_DOC') {
    return (
      <div className="border border-purple-500/20 dark:border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/10 rounded-2xl p-4 space-y-3 shadow-sm">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-xl p-2 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold shrink-0">
              {info.icon}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block">
                {info.label}
              </span>
              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-xs sm:max-w-xl">
                {info.titleSnippet}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 text-purple-700 dark:text-purple-300 border border-purple-500/20 shadow-2xs hover:bg-purple-50 dark:hover:bg-zinc-700 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>{showPreview ? '▲ Sembunyikan Dokumen' : '👁️ Buka Live Preview'}</span>
            </button>

            {info.extractedLink && (
              <a
                href={info.extractedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <span>Buka Link ↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Embedded Document Viewer */}
        {showPreview && (
          <div className="mt-2">
            <DocxDocumentViewer content={info.htmlContent} />
          </div>
        )}
      </div>
    );
  }

  const embedUrl = 'embedUrl' in info ? info.embedUrl : undefined;
  const hasEmbed = Boolean(embedUrl);
  const isCanvaShortlink = info.type === 'CANVA' && info.isShortlink;

  return (
    <div className="border border-purple-500/20 dark:border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/10 rounded-2xl p-4 space-y-3 shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl p-2 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold shrink-0">
            {info.icon}
          </span>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block">
              {info.label}
            </span>
            <a
              href={info.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline truncate max-w-xs sm:max-w-md block"
            >
              {info.originalUrl} ↗
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasEmbed && (
            <button
              type="button"
              onClick={() => {
                setShowPreview((prev) => !prev);
                if (!showPreview) setLoaded(false);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 text-purple-700 dark:text-purple-300 border border-purple-500/20 shadow-2xs hover:bg-purple-50 dark:hover:bg-zinc-700 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>{showPreview ? '▲ Sembunyikan Frame' : '👁️ Buka Live Preview'}</span>
            </button>
          )}

          <a
            href={info.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Link ↗</span>
          </a>
        </div>
      </div>

      {/* Helpful banner for Canva shortlinks */}
      {isCanvaShortlink && (
        <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-2 flex items-center gap-2 font-medium">
          <span>💡</span>
          <span>Tautan Canva ini berupa <strong>shortlink (canva.link)</strong>. Karena batasan keamanan dari Canva, shortlink tidak dapat dipratinjau dalam frame. Silakan klik tombol <strong>Buka Link ↗</strong> untuk melihat karya di Canva.</span>
        </div>
      )}

      {/* Embedded Live Preview iFrame */}
      {hasEmbed && showPreview && embedUrl && (
        <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 relative shadow-inner">
          {!loaded && (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-zinc-400 dark:text-zinc-500">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">Memuat live preview {info.label}...</span>
            </div>
          )}

          <div
            style={{ display: loaded ? 'block' : 'none' }}
            className="relative w-full overflow-hidden"
          >
            <div className="relative pt-[60%] sm:pt-[52%]">
              <iframe
                src={embedUrl}
                onLoad={() => setLoaded(true)}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                title={`${info.label} Live Preview`}
                className="absolute inset-0 w-full h-full border-0 rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
