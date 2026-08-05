'use client';

import { useState } from 'react';

export type ParsedLinkInfo =
  | { type: 'CANVA'; embedUrl: string; originalUrl: string; label: string; icon: string }
  | { type: 'GDRIVE_FILE'; embedUrl: string; originalUrl: string; label: string; icon: string }
  | { type: 'GDRIVE_FOLDER'; embedUrl: string; originalUrl: string; label: string; icon: string }
  | { type: 'OTHER'; originalUrl: string; label: string; icon: string };

export function parseSubmittedLink(rawUrl: string): ParsedLinkInfo {
  const url = (rawUrl ?? '').trim();

  // 1. Canva Design Matching
  if (url.includes('canva.com/design/')) {
    const match = url.match(/canva\.com\/design\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
    if (match && match[1]) {
      const designId = match[1];
      const hash = match[2] ? `/${match[2]}` : '';
      const embedUrl = `https://www.canva.com/design/${designId}${hash}/view?embed`;
      return {
        type: 'CANVA',
        embedUrl,
        originalUrl: url,
        label: 'Canva Design Project',
        icon: '🎨',
      };
    }
  }

  // 2. Google Drive File Matching
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

  // 3. Google Drive Folder Matching
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

  const hasEmbed = info.type === 'CANVA' || info.type === 'GDRIVE_FILE' || info.type === 'GDRIVE_FOLDER';
  const embedUrl = 'embedUrl' in info ? info.embedUrl : null;

  return (
    <div className="border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 rounded-2xl p-4 space-y-3 shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl p-1.5 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold shrink-0">
            {info.icon}
          </span>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
              {info.label}
            </span>
            <a
              href={info.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline truncate max-w-xs sm:max-w-md block"
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
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>{showPreview ? '▲ Sembunyikan Frame' : '👁️ Buka Live Preview'}</span>
            </button>
          )}

          <a
            href={info.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-sm active:scale-95 flex items-center gap-1"
          >
            <span>Buka Link ↗</span>
          </a>
        </div>
      </div>

      {/* Embedded Live Preview iFrame for Canva & Google Drive */}
      {hasEmbed && showPreview && embedUrl && (
        <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 relative">
          {!loaded && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-400 dark:text-zinc-500">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">Memuat preview {info.label}...</span>
            </div>
          )}

          <div
            style={{ display: loaded ? 'block' : 'none' }}
            className="relative w-full overflow-hidden"
          >
            <div className="relative pt-[56.25%] sm:pt-[50%]">
              <iframe
                src={embedUrl}
                onLoad={() => setLoaded(true)}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                title={`${info.label} Preview`}
                className="absolute inset-0 w-full h-full border-0 rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
