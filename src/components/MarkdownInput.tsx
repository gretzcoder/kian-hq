'use client';

import { useState } from 'react';
import { MarkdownViewer } from '@/components/MarkdownViewer';

interface MarkdownInputProps {
  name?: string;
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  required?: boolean;
  className?: string;
}

export default function MarkdownInput({
  name,
  value: externalValue,
  onChange: externalOnChange,
  placeholder = 'Ketik teks di sini (mendukung Markdown: **bold**, *italic*, # heading, - list, [link](url)...',
  rows = 5,
  label,
  required = false,
  className = '',
}: MarkdownInputProps) {
  const [internalValue, setInternalValue] = useState('');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  const text = externalValue !== undefined ? externalValue : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (externalOnChange) {
      externalOnChange(val);
    } else {
      setInternalValue(val);
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Header Label + Toggle Tabs */}
      <div className="flex items-center justify-between gap-2">
        {label && (
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 ml-auto text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeTab === 'write'
                ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-sm font-black'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            ✏️ Tulis
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
              activeTab === 'preview'
                ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-sm font-black'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            👁️ Preview Live
            {text.trim().length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Editor & Live Preview Panel */}
      {activeTab === 'write' ? (
        <textarea
          name={name}
          rows={rows}
          value={text}
          onChange={handleChange}
          required={required}
          placeholder={placeholder}
          className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200 resize-none font-mono leading-relaxed"
        />
      ) : (
        <div
          style={{ minHeight: `${rows * 24}px` }}
          className="w-full bg-zinc-50 dark:bg-zinc-900/40 border border-purple-500/30 rounded-xl p-4 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 overflow-y-auto leading-relaxed shadow-inner"
        >
          {text.trim().length === 0 ? (
            <p className="text-zinc-400 dark:text-zinc-500 italic text-xs">
              Belum ada teks yang ditulis. Klik tab &quot;Tulis&quot; untuk mulai mengetik format Markdown.
            </p>
          ) : (
            <MarkdownViewer content={text} />
          )}
        </div>
      )}
    </div>
  );
}
