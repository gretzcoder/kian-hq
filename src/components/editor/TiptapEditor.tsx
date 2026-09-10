'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MarkdownViewer } from '@/components/MarkdownViewer';

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  docTitle?: string;
  docSubtitle?: string;
}

export default function TiptapEditor({
  value,
  onChange,
  placeholder = 'Mulai menulis isi dokumen di sini...',
  minHeight = 'min-h-[180px]',
  maxHeight = 'max-h-[300px] sm:max-h-[360px]',
  docTitle = 'Brief / Instruksi Pengerjaan',
  docSubtitle = 'Lembar Instruksi & Brief Tugas',
}: TiptapEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: true,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: true,
        },
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: true,
        HTMLAttributes: {
          class: 'rounded-xl shadow-md border border-zinc-200 dark:border-zinc-800 my-4 max-w-full block mx-auto',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-purple-600 dark:text-purple-400 font-semibold underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `tiptap prose-editor focus:outline-none ${minHeight}`,
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      if (!value) {
        editor.commands.setContent('');
      }
    }
  }, [value, editor]);

  if (!mounted || !editor) {
    return (
      <div className={`border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 bg-zinc-50 dark:bg-zinc-900/50 ${minHeight} animate-pulse text-xs text-zinc-400 flex flex-col items-center justify-center gap-2`}>
        <div className="text-2xl">📄</div>
        <div>Memuat DOCX Document Editor...</div>
      </div>
    );
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Masukkan URL Link:', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertCustomTable = () => {
    const rowsStr = window.prompt('Masukkan Jumlah Baris (Rows):', '3');
    if (rowsStr === null) return;
    const colsStr = window.prompt('Masukkan Jumlah Kolom (Columns):', '3');
    if (colsStr === null) return;

    const rows = parseInt(rowsStr, 10);
    const cols = parseInt(colsStr, 10);

    if (isNaN(rows) || rows <= 0 || isNaN(cols) || cols <= 0) {
      window.alert('Jumlah baris dan kolom harus berupa angka lebih dari 0.');
      return;
    }

    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  };

  const insertImage = () => {
    const rawUrl = window.prompt(
      'Masukkan Link URL Gambar (Mendukung Google Drive, Unsplash, Imgur, CDN, dll):\n\nTips Google Drive: Cukup paste link "Share / Bagikan" dari Google Drive, sistem akan otomatis mengonversinya menjadi URL gambar HD!'
    );
    if (!rawUrl) return;

    const finalUrl = convertGoogleDriveImageUrl(rawUrl);

    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('data:image/')) {
      window.alert('URL gambar harus diawali dengan http:// atau https://');
      return;
    }

    editor.chain().focus().setImage({ src: finalUrl }).run();
  };

  const htmlContent = editor.getHTML();
  const textOnly = htmlContent.replace(/<[^>]*>/g, '').trim();
  const wordCount = textOnly ? textOnly.split(/\s+/).filter(Boolean).length : 0;
  const charCount = textOnly.length;

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-zinc-200/60 dark:bg-zinc-950 shadow-lg transition-all flex flex-col relative">
      {/* 📄 DOCX Title Bar */}
      <div className="bg-zinc-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-zinc-800 sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
            📄
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs">Brief / Instruksi Pengerjaan</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30">
                Word Layout
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Lembar Instruksi & Brief Tugas</p>
          </div>
        </div>

        {/* Edit / Preview Mode Ribbon Toggle */}
        <div className="flex items-center bg-zinc-800 p-0.5 rounded-xl text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`px-3 py-1 rounded-lg transition-all ${
              mode === 'edit'
                ? 'bg-blue-600 text-white shadow-xs font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            ✏️ Edit Dokumen
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`px-3 py-1 rounded-lg transition-all ${
              mode === 'preview'
                ? 'bg-blue-600 text-white shadow-xs font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            👁️ Pratinjau Lembar Dokumen
          </button>
        </div>
      </div>

      {mode === 'edit' ? (
        <>
          {/* 🎛️ Word DOCX Ribbon Toolbar - Sticky Toolbar Google Docs style */}
          <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-2 flex flex-wrap items-center gap-1.5 text-xs select-none shadow-xs overflow-x-auto max-w-full min-w-0 sticky top-0 z-20 shrink-0">
            {/* Formatting Group */}
            <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/60 p-0.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`px-2.5 py-1 rounded-md font-black transition-colors ${
                  editor.isActive('bold')
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Teks Tebal (Ctrl+B)"
              >
                B
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`px-2.5 py-1 rounded-md italic font-serif transition-colors ${
                  editor.isActive('italic')
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Teks Miring (Ctrl+I)"
              >
                I
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`px-2.5 py-1 rounded-md underline transition-colors ${
                  editor.isActive('underline')
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Garis Bawah (Ctrl+U)"
              >
                U
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`px-2.5 py-1 rounded-md line-through transition-colors ${
                  editor.isActive('strike')
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Coret Teks"
              >
                S
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${
                  editor.isActive('highlight')
                    ? 'bg-yellow-400 text-zinc-900 font-extrabold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Stabilo / Highlight Teks"
              >
                🖍️
              </button>
            </div>

            {/* Heading Style Selector */}
            <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/60 p-0.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => editor.chain().focus().setParagraph().run()}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  editor.isActive('paragraph') && !editor.isActive('heading')
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Teks Normal"
              >
                Normal
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`px-2 py-1 rounded-md text-[11px] transition-colors ${
                  editor.isActive('heading', { level: 1 })
                    ? 'bg-blue-600 text-white font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Judul Utama (H1)"
              >
                Judul (H1)
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`px-2 py-1 rounded-md text-[11px] transition-colors ${
                  editor.isActive('heading', { level: 2 })
                    ? 'bg-blue-600 text-white font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Sub Judul (H2)"
              >
                Sub (H2)
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`px-2 py-1 rounded-md text-[11px] transition-colors ${
                  editor.isActive('heading', { level: 3 })
                    ? 'bg-blue-600 text-white font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Heading 3 (H3)"
              >
                H3
              </button>
            </div>

            {/* Alignment Group */}
            <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/60 p-0.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${
                  editor.isActive({ textAlign: 'left' })
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Rata Kiri"
              >
                ≡ Kiri
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${
                  editor.isActive({ textAlign: 'center' })
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Rata Tengah"
              >
                ≡ Tengah
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${
                  editor.isActive({ textAlign: 'right' })
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Rata Kanan"
              >
                ≡ Kanan
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${
                  editor.isActive({ textAlign: 'justify' })
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Rata Kanan Kiri (Justify)"
              >
                ≡ Justify
              </button>
            </div>

            {/* Insert Elements Group */}
            <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/60 p-0.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
              <button
                type="button"
                onClick={insertCustomTable}
                className="px-2 py-1 rounded-md text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 flex items-center gap-1 transition-colors"
                title="Sisipkan Tabel Baru (Bisa tentukan jumlah baris & kolom)"
              >
                📊 + Tabel
              </button>
              <button
                type="button"
                onClick={insertImage}
                className="px-2 py-1 rounded-md text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1 transition-colors"
                title="Sisipkan Gambar via Link URL (tanpa beban server storage)"
              >
                🖼️ + Gambar
              </button>
            </div>

            {/* Active Table Operations Sub-Bar */}
            {editor.isActive('table') && (
              <div className="flex items-center gap-0.5 bg-blue-500/10 dark:bg-blue-500/20 p-0.5 rounded-lg border border-blue-500/30 text-[10px]">
                <span className="font-bold text-blue-600 dark:text-blue-300 px-1">Tabel:</span>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-blue-600 hover:text-white font-bold"
                  title="Tambah Baris di Bawah"
                >
                  + Baris
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-blue-600 hover:text-white font-bold"
                  title="Tambah Kolom di Kanan"
                >
                  + Kolom
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 text-red-600 hover:bg-red-600 hover:text-white font-bold"
                  title="Hapus Baris Saat Ini"
                >
                  - Baris
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 text-red-600 hover:bg-red-600 hover:text-white font-bold"
                  title="Hapus Kolom Saat Ini"
                >
                  - Kolom
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="px-1.5 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 font-extrabold"
                  title="Hapus Seluruh Tabel"
                >
                  🗑️ Hapus Tabel
                </button>
              </div>
            )}

            {/* List & Structure Group */}
            <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/60 p-0.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${
                  editor.isActive('bulletList')
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Bullet List"
              >
                • List
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${
                  editor.isActive('orderedList')
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Numbered List"
              >
                1. List
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${
                  editor.isActive('blockquote')
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Kutipan"
              >
                “ Quote
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className="px-2 py-1 rounded-md text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                title="Garis Pemisah Horizontal"
              >
                ― Pembatas
              </button>
            </div>

            {/* Link & History */}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={setLink}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${
                  editor.isActive('link')
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Sisipkan Link"
              >
                🔗 Link
              </button>

              <span className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />

              <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="px-2 py-1 rounded-md text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40"
                title="Undo (Ctrl+Z)"
              >
                ↩
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="px-2 py-1 rounded-md text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40"
                title="Redo (Ctrl+Y)"
              >
                ↪
              </button>
            </div>
          </div>

          {/* 📄 DOCX Paper Canvas Page Container - Scrollable area */}
          <div className={`bg-zinc-100 dark:bg-zinc-950 p-3 sm:p-4 overflow-y-auto ${maxHeight} flex-1 scroll-smooth`}>
            <div className={`max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-md ${minHeight} p-4 sm:p-6 transition-all`}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </>
      ) : (
        /* 👁️ DOCX Document Preview Mode */
        <div className={`bg-zinc-100 dark:bg-zinc-950 p-3 sm:p-4 overflow-y-auto ${maxHeight} flex-1 scroll-smooth`}>
          <div className={`max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-md ${minHeight} p-4 sm:p-6 transition-all`}>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <span>📄 Pratinjau Dokumen Laporan (.docx)</span>
              </span>
              <span className="text-[10px] text-zinc-400">
                Persis seperti yang akan dibaca oleh Ketua Tim / Mentor
              </span>
            </div>

            {textOnly ? (
              <div
                className="prose-editor text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            ) : (
              <div className="py-16 text-center text-xs text-zinc-400 italic">
                Dokumen masih kosong. Klik tab &quot;✏️ Edit Dokumen&quot; untuk mulai menulis isi laporan.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📊 DOCX Status Footer Bar */}
      <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-4 py-2 flex flex-wrap items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
        <div className="flex items-center gap-4">
          <span>Halaman 1 dari 1</span>
          <span>•</span>
          <span><strong className="text-zinc-700 dark:text-zinc-300 font-bold">{wordCount}</strong> kata</span>
          <span>•</span>
          <span><strong className="text-zinc-700 dark:text-zinc-300 font-bold">{charCount}</strong> karakter</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          <span>Format HTML DOCX</span>
        </div>
      </div>
    </div>
  );
}

export function DocxDocumentViewer({
  content,
  docTitle = 'Brief / Instruksi Pengerjaan',
  roleName = 'Brief & Instruksi Tugas Workspace',
  badgeText = 'Dokumen Brief',
}: {
  content: string;
  docTitle?: string;
  roleName?: string;
  badgeText?: string;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullscreen]);

  if (!content) return null;

  const contentClean = content
    .replace(/^\[DIRECT_BRIEF_CATEGORIES:\s*(\[[\s\S]*?\])\]\s*/i, '')
    .replace(/^\[DIRECT_BRIEF\]\s*/i, '')
    .trim();
  const textOnly = contentClean.replace(/<[^>]*>/g, '').trim();
  const wordCount = textOnly ? textOnly.split(/\s+/).filter(Boolean).length : 0;
  const charCount = textOnly.length;

  return (
    <>
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-zinc-200/60 dark:bg-zinc-950 shadow-lg transition-all my-3">
        {/* 📄 DOCX Title Bar (Read-Only) */}
        <div className="bg-zinc-900 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs border-b border-zinc-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs shrink-0">
              📄
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-xs truncate">{docTitle}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30 shrink-0">
                  {badgeText}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 truncate">{roleName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 font-medium border border-zinc-700/80 select-none">
              👁️ Preview Only
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-semibold border border-blue-500/30 transition-all cursor-pointer active:scale-95 shadow-xs"
              title="Lihat Brief Layar Penuh (Full Screen)"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
              <span>Full Screen</span>
            </button>
          </div>
        </div>

        {/* 📄 DOCX Paper Canvas Page */}
        <div className="bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-6 overflow-y-auto max-h-[560px] scroll-smooth">
          <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-xl min-h-[260px] p-6 sm:p-10 transition-all">
            <MarkdownViewer content={contentClean} />
          </div>
        </div>

        {/* 📊 DOCX Status Footer Bar */}
        <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-4 py-2 flex flex-wrap items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-4">
            <span>Halaman 1 dari 1</span>
            <span>•</span>
            <span><strong className="text-zinc-700 dark:text-zinc-300 font-bold">{wordCount}</strong> kata</span>
            <span>•</span>
            <span><strong className="text-zinc-700 dark:text-zinc-300 font-bold">{charCount}</strong> karakter</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
            <span>Format Lembar Brief</span>
          </div>
        </div>
      </div>

      {/* ⛶ Fullscreen Modal Overlay */}
      {isFullscreen && mounted && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex flex-col p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFullscreen(false);
          }}
        >
          {/* Fullscreen Header */}
          <div className="max-w-5xl w-full mx-auto bg-zinc-900 text-white px-4 sm:px-6 py-3 rounded-t-2xl flex items-center justify-between gap-4 border border-zinc-800 border-b-0 shadow-2xl shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md shrink-0">
                📄
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-sm sm:text-base truncate">{docTitle}</span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30 shrink-0">
                    {badgeText}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate">{roleName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className="hidden md:inline-flex text-[11px] text-zinc-400 px-2.5 py-1 bg-zinc-800/80 rounded-lg border border-zinc-700/60 font-mono">
                ESC untuk keluar
              </span>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-200 hover:text-red-400 font-semibold border border-zinc-700 hover:border-red-500/30 transition-all text-xs cursor-pointer active:scale-95 shadow-xs"
                title="Tutup Mode Layar Penuh"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Tutup Full Screen</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Canvas Content */}
          <div className="max-w-5xl w-full mx-auto bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-8 flex-1 overflow-y-auto border-x border-zinc-800 shadow-2xl scroll-smooth">
            <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-xl min-h-[400px] p-6 sm:p-12 transition-all">
              <MarkdownViewer content={contentClean} />
            </div>
          </div>

          {/* Fullscreen Footer */}
          <div className="max-w-5xl w-full mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-t-0 rounded-b-2xl px-5 py-3 flex flex-wrap items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 shadow-2xl shrink-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <span>Halaman 1 dari 1</span>
              <span>•</span>
              <span><strong className="text-zinc-700 dark:text-zinc-300 font-bold">{wordCount}</strong> kata</span>
              <span>•</span>
              <span><strong className="text-zinc-700 dark:text-zinc-300 font-bold">{charCount}</strong> karakter</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400">Mode Full Screen • Format Lembar Brief</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * Converts any Google Drive share / view / file link into a direct high-resolution image CDN stream URL.
 */
export function convertGoogleDriveImageUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  const trimmed = rawUrl.trim();

  // Match Google Drive file ID pattern
  const fileMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/id=([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);

  if (fileMatch && fileMatch[1]) {
    const fileId = fileMatch[1];
    // High-resolution Google CDN direct image stream endpoint
    return `https://lh3.googleusercontent.com/d/${fileId}=w1600`;
  }

  return trimmed;
}

/**
 * Replaces any un-converted Google Drive web page image URLs inside HTML string with direct image CDN streams.
 */
export function fixGoogleDriveImagesInHtml(html: string): string {
  if (!html) return html;
  return html.replace(
    /src=["'](https?:\/\/(?:drive\.google\.com|docs\.google\.com)[^"']+)["']/g,
    (_match, p1) => {
      const converted = convertGoogleDriveImageUrl(p1);
      return `src="${converted}"`;
    }
  );
}

