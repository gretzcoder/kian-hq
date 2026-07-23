'use client';

import { useState, useRef, useEffect } from 'react';
import { askAIAssistant } from '../actions';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Halo! Saya KIAN HQ AI Assistant. Ada yang bisa saya bantu terkait tugas, proyek aktif, atau guideline dokumentasi tim hari ini?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg = textToSend.trim();
    setInput('');
    setLoading(true);

    // 1. Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);

    try {
      // 2. Call Server Action
      const res = await askAIAssistant(userMsg);
      if (res.success && res.answer) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.answer || '' },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ Gagal: ${res.error || 'Terjadi kesalahan sistem.'}` },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error: ${err.message || 'Gagal terhubung ke AI Engine.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const presets = [
    { label: '📋 Lihat tugas saya', prompt: 'Tampilkan tugas saya' },
    { label: '📁 Daftar proyek aktif', prompt: 'Daftar proyek aktif' },
    { label: '📖 Tampilkan guideline', prompt: 'Tampilkan guideline tim' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-[calc(100vh-14rem)] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0e0e10]/30 rounded-3xl overflow-hidden shadow-sm">
      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xl px-5 py-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-none shadow-[0_4px_16px_rgba(147,51,234,0.15)]'
                  : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-none'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs px-5 py-3.5 rounded-2xl rounded-bl-none flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce delay-200" />
              </div>
              KIAN AI sedang mencari data di database...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Preset prompt buttons */}
      <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950/20 flex flex-wrap gap-2 items-center">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-500 font-bold uppercase tracking-wider mr-2">Quick Presets:</span>
        {presets.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(preset.prompt)}
            disabled={loading}
            className="text-xs bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold px-3.5 py-1.5 rounded-full transition-all disabled:opacity-50 shadow-sm"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Input panel */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="p-4 border-t border-zinc-200 dark:border-zinc-900 bg-white dark:bg-[#0a0a0c] flex gap-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanyakan tugas saya, status proyek, atau dokumentasi..."
          disabled={loading}
          className="flex-1 bg-zinc-100/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-2xl px-5 py-3 focus:outline-none transition-all disabled:opacity-50 duration-200"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 text-white dark:text-black disabled:text-zinc-400 dark:disabled:text-zinc-600 font-bold text-sm px-6 py-3 rounded-2xl transition-all duration-300 disabled:opacity-50 active:scale-[0.98]"
        >
          Send
        </button>
      </form>
    </div>
  );
}
