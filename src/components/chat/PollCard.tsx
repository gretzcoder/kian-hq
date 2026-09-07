'use client';

import React from 'react';

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // userIds who voted for this option
}

export interface PollData {
  id: string;
  question: string;
  options: PollOption[];
  multipleAnswers?: boolean;
}

export interface PollCardProps {
  poll: PollData;
  messageId?: string;
  currentUserId?: string;
  onVote: (optionId: string) => void;
  isMe?: boolean;
}

export function parsePollPayload(messageText: string): PollData | null {
  if (!messageText || !messageText.startsWith('[poll_data:')) return null;
  try {
    const rawJson = messageText.slice(11, -1);
    return JSON.parse(rawJson) as PollData;
  } catch {
    return null;
  }
}

export function serializePollPayload(poll: PollData): string {
  return `[poll_data:${JSON.stringify(poll)}]`;
}

export function PollCard({ poll, currentUserId, onVote, isMe = false }: PollCardProps) {
  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);

  return (
    <div className={`p-3 sm:p-4 rounded-2xl border text-xs space-y-3 w-full max-w-sm select-none ${
      isMe
        ? 'bg-purple-950/60 border-purple-500/40 text-white'
        : 'bg-zinc-900/90 border-zinc-800 text-zinc-100'
    }`}>
      {/* Poll Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">📊</span>
          <h4 className="font-black text-xs sm:text-sm text-zinc-100 truncate">
            {poll.question}
          </h4>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 shrink-0">
          {poll.multipleAnswers ? 'Multi Vote' : 'Voting Tim'}
        </span>
      </div>

      {/* Options List */}
      <div className="space-y-2">
        {poll.options.map((opt) => {
          const voteCount = opt.votes?.length || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const hasVoted = Boolean(currentUserId && opt.votes?.includes(currentUserId));

          return (
            <button
              key={opt.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVote(opt.id);
              }}
              className={`w-full p-2.5 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                hasVoted
                  ? 'border-purple-500/80 bg-purple-500/20 shadow-xs'
                  : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'
              }`}
            >
              {/* Progress Fill Bar */}
              <div
                style={{ width: `${percentage}%` }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600/40 to-indigo-600/40 transition-all duration-300 pointer-events-none"
              />

              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    hasVoted ? 'bg-purple-500 border-purple-400 text-white' : 'border-zinc-600'
                  }`}>
                    {hasVoted && '✓'}
                  </div>
                  <span className="font-semibold text-xs text-zinc-100 truncate">
                    {opt.text}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
                  <span className="font-bold text-purple-300">{percentage}%</span>
                  <span className="text-zinc-400">({voteCount})</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="pt-1 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
        <span>{totalVotes} total suara</span>
        <span className="italic text-purple-400 font-sans">Tekan opsi untuk memilih</span>
      </div>
    </div>
  );
}
