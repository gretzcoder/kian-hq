'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

interface ToolState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  h3: boolean;
  ul: boolean;
  ol: boolean;
}

const DEFAULT_TOOL_STATE: ToolState = {
  bold: false, italic: false, underline: false,
  h3: false, ul: false, ol: false,
};

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [toolState, setToolState] = useState<ToolState>(DEFAULT_TOOL_STATE);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const savedRangeRef = useRef<Range | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  // Detect active formatting at current selection/cursor
  const updateToolState = useCallback(() => {
    const sel = window.getSelection();
    if (!sel) return;

    const blockElement = (() => {
      let node: Node | null = sel.anchorNode;
      while (node && node !== editorRef.current) {
        if ((node as Element).tagName) {
          return node as Element;
        }
        node = node.parentNode;
      }
      return null;
    })();

    const tag = blockElement?.tagName?.toUpperCase() ?? '';
    const closestH3 = blockElement?.closest?.('h3') ?? null;

    // Check if inside UL or OL
    const inUl = !!blockElement?.closest?.('ul');
    const inOl = !!blockElement?.closest?.('ol');

    setToolState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      h3: !!closestH3 || tag === 'H3',
      ul: inUl,
      ol: inOl,
    });
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
    updateToolState();
  }, [onChange, updateToolState]);

  const focus = () => {
    editorRef.current?.focus();
  };

  // Execute a command while keeping focus/selection intact
  const exec = (command: string, val?: string) => {
    focus();
    document.execCommand(command, false, val);
    handleInput();
    updateToolState();
  };

  const preventFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // H3 toggle: if already in H3, switch to 'div'; otherwise format as H3
  const toggleH3 = () => {
    focus();
    if (toolState.h3) {
      document.execCommand('formatBlock', false, 'div');
    } else {
      document.execCommand('formatBlock', false, 'h3');
    }
    handleInput();
    updateToolState();
  };

  // UL toggle
  const toggleUL = () => {
    focus();
    document.execCommand('insertUnorderedList', false, undefined);
    handleInput();
    updateToolState();
  };

  // OL toggle
  const toggleOL = () => {
    focus();
    document.execCommand('insertOrderedList', false, undefined);
    handleInput();
    updateToolState();
  };

  // Save selection before opening link modal
  const openLinkModal = (e: React.MouseEvent) => {
    e.preventDefault();
    focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      setLinkText(sel.toString());
    }
    setLinkUrl('');
    setShowLinkModal(true);
  };

  const insertLink = () => {
    if (!linkUrl.trim()) {
      setShowLinkModal(false);
      return;
    }
    focus();
    // Restore saved selection
    const sel = window.getSelection();
    if (savedRangeRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    // If text is selected, wrap it; else insert the url as link text
    if (sel && !sel.isCollapsed) {
      document.execCommand('createLink', false, linkUrl.trim());
    } else {
      const text = linkText.trim() || linkUrl.trim();
      document.execCommand('insertHTML', false,
        `<a href="${linkUrl.trim()}" target="_blank" rel="noopener noreferrer">${text}</a>`
      );
    }
    handleInput();
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  const btnBase = 'relative flex items-center justify-center rounded-lg transition-all text-xs font-bold select-none cursor-pointer px-2.5 py-1.5';
  const btnActive = 'bg-purple-600 text-white shadow-sm shadow-purple-500/30';
  const btnInactive = 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100';
  const divider = <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />;

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
      {/* Tab bar + Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/80">
        {/* Write / Preview Tab */}
        <div className="flex items-center gap-0.5 p-1 shrink-0">
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => setActiveTab('write')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'write'
                ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            ✍️ Edit
          </button>
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'preview'
                ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            👁️ Preview
          </button>
        </div>

        {/* Toolbar (only in write mode) */}
        {activeTab === 'write' && (
          <div className="flex flex-wrap items-center gap-0.5 px-2 pb-1.5 sm:pb-0 sm:py-1.5 sm:border-l sm:border-zinc-200 sm:dark:border-zinc-700">
            {/* Bold */}
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={() => exec('bold')}
              title="Bold (Ctrl+B)"
              className={`${btnBase} font-black ${toolState.bold ? btnActive : btnInactive}`}
            >
              B
            </button>
            {/* Italic */}
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={() => exec('italic')}
              title="Italic (Ctrl+I)"
              className={`${btnBase} italic ${toolState.italic ? btnActive : btnInactive}`}
            >
              I
            </button>
            {/* Underline */}
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={() => exec('underline')}
              title="Underline (Ctrl+U)"
              className={`${btnBase} underline ${toolState.underline ? btnActive : btnInactive}`}
            >
              U
            </button>

            {divider}

            {/* H3 */}
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={toggleH3}
              title="Judul (H3)"
              className={`${btnBase} ${toolState.h3 ? btnActive : btnInactive}`}
            >
              H3
            </button>

            {divider}

            {/* Bullet List */}
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={toggleUL}
              title="Bullet List"
              className={`${btnBase} ${toolState.ul ? btnActive : btnInactive}`}
            >
              ≡ •
            </button>
            {/* Numbered List */}
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={toggleOL}
              title="Numbered List"
              className={`${btnBase} ${toolState.ol ? btnActive : btnInactive}`}
            >
              ≡ 1.
            </button>

            {divider}

            {/* Insert Link */}
            <button
              type="button"
              onMouseDown={openLinkModal}
              title="Insert Link"
              className={`${btnBase} ${btnInactive}`}
            >
              🔗
            </button>

            {divider}

            {/* Undo */}
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={() => exec('undo')}
              title="Undo (Ctrl+Z)"
              className={`${btnBase} ${btnInactive}`}
            >
              ↩
            </button>
            {/* Redo */}
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={() => exec('redo')}
              title="Redo (Ctrl+Y)"
              className={`${btnBase} ${btnInactive}`}
            >
              ↪
            </button>

            {divider}

            {/* Clear Format */}
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={() => exec('removeFormat')}
              title="Hapus Format"
              className={`${btnBase} ${btnInactive} text-zinc-400`}
            >
              🧹
            </button>
          </div>
        )}
      </div>

      {/* Editor Content Area */}
      {activeTab === 'write' ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={updateToolState}
          onMouseUp={updateToolState}
          onSelect={updateToolState}
          data-placeholder={placeholder ?? 'Tulis laporan di sini...'}
          className={[
            'p-4 min-h-[160px] max-h-[360px] overflow-y-auto text-sm text-zinc-900 dark:text-zinc-100',
            'focus:outline-none leading-relaxed',
            'prose dark:prose-invert max-w-none',
            '[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-zinc-400 [&:empty]:before:pointer-events-none',
          ].join(' ')}
        />
      ) : (
        <div className="p-4 min-h-[160px] max-h-[360px] overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950/20">
          {value?.trim() ? (
            <div
              dangerouslySetInnerHTML={{ __html: value }}
              className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-zinc-900 dark:text-zinc-100"
            />
          ) : (
            <p className="text-zinc-400 text-sm italic">Belum ada konten laporan yang ditulis.</p>
          )}
        </div>
      )}

      {/* Link Insert Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-100">🔗 Tambahkan Link</h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {!linkText && (
                <div>
                  <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 block mb-1">Teks Link (opsional)</label>
                  <input
                    type="text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    placeholder="Teks yang tampil"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500 text-zinc-900 dark:text-zinc-100 transition-colors"
                  />
                </div>
              )}
              {linkText && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Teks yang diseleksi: <span className="font-bold text-zinc-800 dark:text-zinc-200">&ldquo;{linkText}&rdquo;</span></p>
              )}
              <div>
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 block mb-1">URL <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://contoh.com"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertLink(); } }}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500 text-zinc-900 dark:text-zinc-100 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-bold px-3 py-2 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={insertLink}
                disabled={!linkUrl.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
              >
                Sisipkan Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
