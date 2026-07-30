'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { sendWorkspaceMessage, deleteWorkspaceMessage, WorkspaceChatMessage } from '@/modules/workspaces/chatActions';
import { MarkdownViewer } from '@/components/MarkdownViewer';

interface WorkspaceChatRoomProps {
  workspaceId: string;
  currentUserId: string;
  initialMessages: WorkspaceChatMessage[];
  canDeleteAny: boolean;
}

export function WorkspaceChatRoom({
  workspaceId,
  currentUserId,
  initialMessages,
  canDeleteAny,
}: WorkspaceChatRoomProps) {
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputMessage.trim() || isPending) return;

    const msgText = inputMessage;
    setInputMessage('');

    // Optimistic UI update
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: WorkspaceChatMessage = {
      id: tempId,
      workspace_id: workspaceId,
      user_id: currentUserId,
      user_name: 'Anda',
      message: msgText,
      created_at: Math.floor(Date.now() / 1000),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    startTransition(async () => {
      const res = await sendWorkspaceMessage(workspaceId, msgText);
      if (!res.success) {
        // Rollback on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    });
  }

  function handleDelete(messageId: string) {
    startTransition(async () => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      await deleteWorkspaceMessage(messageId, workspaceId);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm flex flex-col h-[580px]">
      {/* Room Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>💬</span> Workspace Discussion Room
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Ruang diskusi & koordinasi langsung antar anggota workspace.
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full">
          {messages.length} Messages
        </span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-2xl">
            <span className="text-3xl mb-2">💬</span>
            <p className="text-zinc-500 text-xs font-medium">Belum ada obrolan di workspace ini.</p>
            <p className="text-zinc-400 text-[11px] mt-1">Mulaikan obrolan pertama dengan tim Anda di bawah!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUserId;

            return (
              <div
                key={msg.id}
                className={`group flex items-start gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isMe
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}>
                  {(msg.user_name || 'U').charAt(0).toUpperCase()}
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end text-right' : 'items-start'}`}>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                      {isMe ? 'Anda' : msg.user_name || 'User'}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-mono">
                      {new Date(msg.created_at * 1000).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className={`relative rounded-2xl p-3.5 text-xs shadow-sm border ${
                    isMe
                      ? 'bg-purple-600 text-white border-purple-500 rounded-tr-none'
                      : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-900 dark:text-zinc-100 border-zinc-200/80 dark:border-zinc-800 rounded-tl-none'
                  }`}>
                    {isMe ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    ) : (
                      <MarkdownViewer content={msg.message} />
                    )}

                    {(isMe || canDeleteAny) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(msg.id)}
                        disabled={isPending}
                        className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] transition-all shadow-md"
                        title="Hapus pesan"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSend} className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 items-end">
        <textarea
          rows={2}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tulis pesan... (Shift+Enter untuk baris baru, Enter untuk kirim)"
          disabled={isPending}
          className="flex-1 bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-2xl px-4 py-3 focus:outline-none transition-all resize-none"
        />
        <button
          type="submit"
          disabled={isPending || !inputMessage.trim()}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-3.5 rounded-2xl transition-all active:scale-95 shadow-md shadow-purple-500/20 shrink-0 self-stretch flex items-center justify-center gap-1.5"
        >
          <span>Kirim</span>
          <span>🚀</span>
        </button>
      </form>
    </div>
  );
}
