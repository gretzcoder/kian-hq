'use client';

import { useState } from 'react';

interface CollapsibleNoteViewerProps {
  content: string | null | undefined;
  maxInitialHeight?: number;
  className?: string;
  badgeLabel?: string;
  authorName?: string | null;
  authorRole?: string | null;
  type?: 'REVISION' | 'APPRECIATION' | 'GENERAL';
}

export function CollapsibleNoteViewer({
  content,
  className = '',
  badgeLabel,
  authorName,
  authorRole,
  type = 'REVISION',
}: CollapsibleNoteViewerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!content || !content.trim()) return null;

  const trimmed = content.trim();
  const isHtml = trimmed.includes('<');
  const isLong =
    trimmed.length > 180 ||
    trimmed.includes('\n') ||
    trimmed.includes('<p>') ||
    trimmed.includes('<ul>') ||
    trimmed.includes('<ol>') ||
    trimmed.includes('<img');

  const cardStyle =
    type === 'REVISION'
      ? 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/30 border-red-200/80 dark:border-red-800/60'
      : type === 'APPRECIATION'
      ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/30 border-purple-200/80 dark:border-purple-800/60'
      : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800';

  const badgeStyle =
    type === 'REVISION'
      ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20'
      : type === 'APPRECIATION'
      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20'
      : 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/20';

  const icon = type === 'REVISION' ? '💬' : type === 'APPRECIATION' ? '💬' : '📝';

  return (
    <div className={`p-4 rounded-2xl border shadow-2xs space-y-2.5 ${cardStyle} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-zinc-200/60 dark:border-zinc-800/40">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-xl bg-white/80 dark:bg-zinc-900/80 flex items-center justify-center text-xs font-black shrink-0 border border-zinc-200/40 dark:border-zinc-800/40 shadow-2xs">
            {icon}
          </span>
          <div>
            <p className="text-xs font-black text-zinc-900 dark:text-zinc-100">
              {type === 'REVISION'
                ? `Catatan Revisi dari ${authorName || 'Evaluator QC'}`
                : type === 'APPRECIATION'
                ? 'Catatan Apresiasi & Feedback Evaluator'
                : 'Catatan Feedback'}
            </p>
            {authorRole && (
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                {authorRole}
              </p>
            )}
          </div>
        </div>

        {badgeLabel && (
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${badgeStyle}`}>
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Content Container */}
      <div className="relative">
        <div
          className={`p-3.5 rounded-xl bg-white/95 dark:bg-zinc-950/95 border border-zinc-200/60 dark:border-zinc-800/60 transition-all duration-300 relative ${
            !expanded && isLong ? 'max-h-[130px] overflow-hidden' : 'max-h-none'
          }`}
        >
          {isHtml ? (
            <div
              className="prose dark:prose-invert prose-xs max-w-none text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-medium leading-relaxed"
              dangerouslySetInnerHTML={{ __html: trimmed }}
            />
          ) : (
            <p className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed italic whitespace-pre-wrap">
              "{trimmed}"
            </p>
          )}

          {/* Fade-out gradient mask when collapsed */}
          {!expanded && isLong && (
            <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white dark:from-zinc-950 to-transparent pointer-events-none" />
          )}
        </div>

        {/* Expand / Collapse Toggle Button */}
        {isLong && (
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/40 text-purple-700 dark:text-purple-300 font-bold text-xs shadow-2xs hover:shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>{expanded ? '👆 Sembunyikan' : '👇 Lihat Selengkapnya (Expand)'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
