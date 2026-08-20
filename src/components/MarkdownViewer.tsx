import React from 'react';
import { fixGoogleDriveImagesInHtml } from '@/components/editor/TiptapEditor';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

/**
 * Lightweight, safe, and beautiful Markdown & HTML (WYSIWYG) Viewer.
 * Supports Tiptap WYSIWYG HTML output seamlessly with .prose-editor CSS styles.
 */
export function MarkdownViewer({ content, className = '' }: MarkdownViewerProps) {
  if (!content) return null;

  const contentClean = content.replace(/^\[DIRECT_BRIEF\]\s*/i, '').trim();

  const isHtml =
    /^\s*<[a-z][\s\S]*>/i.test(contentClean) ||
    contentClean.includes('<h1') ||
    contentClean.includes('<h2') ||
    contentClean.includes('<h3') ||
    contentClean.includes('<p') ||
    contentClean.includes('<ul') ||
    contentClean.includes('<ol') ||
    contentClean.includes('<strong') ||
    contentClean.includes('</') ||
    contentClean.includes('<br') ||
    contentClean.includes('<table');

  if (isHtml) {
    return (
      <div
        className={`prose-editor text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed ${className}`}
        dangerouslySetInnerHTML={{ __html: fixGoogleDriveImagesInHtml(contentClean) }}
      />
    );
  }

  // Convert plain text newline breaks into HTML paragraph formatting
  const formattedHtml = contentClean
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
    .join('');

  return (
    <div
      className={`prose-editor text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: fixGoogleDriveImagesInHtml(formattedHtml) }}
    />
  );
}
