'use client';

import React, { useState } from 'react';
import { PollData, serializePollPayload } from './PollCard';

export interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePoll: (pollPayload: string) => void;
}

export function CreatePollModal({ isOpen, onClose, onCreatePoll }: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multipleAnswers, setMultipleAnswers] = useState(false);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions((prev) => [...prev, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qTrimmed = question.trim();
    const validOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!qTrimmed || validOptions.length < 2) return;

    const pollData: PollData = {
      id: `poll_${crypto.randomUUID().replace(/-/g, '')}`,
      question: qTrimmed,
      options: validOptions.map((text, idx) => ({
        id: `opt_${idx + 1}`,
        text,
        votes: [],
      })),
      multipleAnswers,
    };

    const payload = serializePollPayload(pollData);
    onCreatePoll(payload);

    // Reset
    setQuestion('');
    setOptions(['', '']);
    setMultipleAnswers(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 select-none">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <span>📊</span>
            <span>Buat Polling / Voting Tim</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white font-bold text-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Question Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 block">Pertanyaan / Topik Voting</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Contoh: Tentukan nama tim dan ketua kelompok..."
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 shadow-2xs"
            />
          </div>

          {/* Options Input List */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 block">Pilihan Opsi (Min 2, Max 6)</label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-purple-400 w-5 shrink-0">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Pilihan ${idx + 1}`}
                  required
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="text-zinc-500 hover:text-rose-500 text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="w-full py-2 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 text-purple-400 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <span>+</span> Tambah Opsi
              </button>
            )}
          </div>

          {/* Multiple Answers Checkbox */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
            <input
              type="checkbox"
              id="multi_vote"
              checked={multipleAnswers}
              onChange={(e) => setMultipleAnswers(e.target.checked)}
              className="rounded accent-purple-600 cursor-pointer"
            />
            <label htmlFor="multi_vote" className="text-xs text-zinc-300 font-medium cursor-pointer">
              Izinkan memilih lebih dari satu jawaban
            </label>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl hover:bg-zinc-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!question.trim() || options.map((o) => o.trim()).filter(Boolean).length < 2}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 cursor-pointer"
            >
              Kirim Voting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
