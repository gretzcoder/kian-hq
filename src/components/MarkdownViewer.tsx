import React from 'react';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

/**
 * Lightweight, safe, and beautiful Markdown Viewer.
 * Supports bold, italic, inline code, code blocks, headers (h1-h3), lists, blockquotes, horizontal rules, and links.
 */
export function MarkdownViewer({ content, className = '' }: MarkdownViewerProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-2 pl-2">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  lines.forEach((line, index) => {
    // Handle Code Block ```
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${elements.length}`}
            className="bg-zinc-950 dark:bg-zinc-900 text-zinc-100 p-3 rounded-xl text-xs font-mono overflow-x-auto my-2 border border-zinc-800"
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // Handle Unordered List - or *
    const listMatch = line.match(/^[\s]*[-*]\s+(.*)$/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      return;
    } else {
      flushList();
    }

    // Handle Headers #, ##, ###
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${index}`} className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 my-2">
          {renderInlineMarkdown(line.slice(2))}
        </h1>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${index}`} className="text-sm font-bold text-zinc-900 dark:text-zinc-100 my-2">
          {renderInlineMarkdown(line.slice(3))}
        </h2>
      );
      return;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${index}`} className="text-xs font-bold text-zinc-800 dark:text-zinc-200 my-1.5">
          {renderInlineMarkdown(line.slice(4))}
        </h3>
      );
      return;
    }

    // Handle Blockquote >
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${index}`}
          className="border-l-4 border-purple-500 pl-3 italic text-zinc-600 dark:text-zinc-400 my-2 text-xs"
        >
          {renderInlineMarkdown(line.slice(2))}
        </blockquote>
      );
      return;
    }

    // Handle Horizontal Rule --- or ***
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={`hr-${index}`} className="my-3 border-zinc-200 dark:border-zinc-800" />);
      return;
    }

    // Empty lines
    if (line.trim() === '') {
      elements.push(<div key={`space-${index}`} className="h-1.5" />);
      return;
    }

    // Standard Paragraph
    elements.push(
      <p key={`p-${index}`} className="my-1 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
        {renderInlineMarkdown(line)}
      </p>
    );
  });

  flushList();

  return <div className={`markdown-body ${className}`}>{elements}</div>;
}

/**
 * Helper to parse inline markdown formatting like **bold**, *italic*, `code`, and [links](url).
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Tokenizer pattern matching links, code, bold, italic
  const regex = /(\[.*?\]\(.*?\)|\`.*?\`|\*\*.*?\*\*|\*.*?\*)/g;
  const rawParts = text.split(regex);

  rawParts.forEach((part, idx) => {
    if (!part) return;

    // Link: [Text](URL)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      parts.push(
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 dark:text-purple-400 font-semibold underline hover:opacity-80"
        >
          {linkMatch[1]}
        </a>
      );
      return;
    }

    // Inline Code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      parts.push(
        <code
          key={idx}
          className="bg-zinc-200/60 dark:bg-zinc-800 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded text-[11px] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
      return;
    }

    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      parts.push(
        <strong key={idx} className="font-bold text-zinc-950 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
      return;
    }

    // Italic: *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      parts.push(
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
      return;
    }

    // Plain Text
    parts.push(<span key={idx}>{part}</span>);
  });

  return parts;
}
