'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFloatingMessenger } from './FloatingMessengerContext';
import {
  getDirectMessagesAction,
  sendDirectMessageAction,
  toggleDMReactionAction,
  acceptMessageRequestAction,
  DirectMessage,
} from '../dmActions';
import { respondFriendRequestAction, getFriendshipStatusAction, FriendshipStatus } from '@/modules/friends/friendActions';
import UserAvatar from '@/components/ui/UserAvatar';

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '👏', '🙌'];
const STICKERS = ['🚀', '💯', '✨', '⚡', '🏆', '🎉', '💪', '🎯', '⭐', '🎈'];

export function FloatingMessengerWidget() {
  const { activePartnerId, activePartnerName, activePartnerAvatar, closeChat } = useFloatingMessenger();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [partnerInfo, setPartnerInfo] = useState<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    userType: string | null;
    isFriend: boolean;
    isRequest: boolean;
  } | null>(null);

  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('NONE');
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages & friendship status
  const fetchMessages = async () => {
    if (!activePartnerId) return;
    try {
      const res = await getDirectMessagesAction(activePartnerId);
      if (res.success && res.messages) {
        setMessages(res.messages);
        if (res.partnerInfo) setPartnerInfo(res.partnerInfo);
      }
    } catch {}
  };

  const fetchFriendship = async () => {
    if (!activePartnerId) return;
    try {
      const res = await getFriendshipStatusAction(activePartnerId);
      if (res.success) setFriendshipStatus(res.status);
    } catch {}
  };

  useEffect(() => {
    if (activePartnerId) {
      setLoading(true);
      Promise.all([fetchMessages(), fetchFriendship()]).finally(() => setLoading(false));

      const interval = setInterval(fetchMessages, 3000); // 3s polling for DMs
      return () => clearInterval(interval);
    }
  }, [activePartnerId]);

  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isMinimized]);

  if (!activePartnerId) return null;

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() && !attachmentUrl.trim()) return;

    setSending(true);
    try {
      const res = await sendDirectMessageAction({
        receiverId: activePartnerId,
        message: textToSend,
        attachmentUrl: attachmentUrl.trim() || undefined,
        replyToId: replyingTo?.id || undefined,
      });

      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message!]);
        setInputText('');
        setAttachmentUrl('');
        setShowAttachmentInput(false);
        setReplyingTo(null);
        setShowStickers(false);
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await toggleDMReactionAction(messageId, emoji);
      if (res.success && res.reactions) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions! } : m))
        );
      }
    } catch {}
  };

  const handleAcceptRequest = async () => {
    await acceptMessageRequestAction(activePartnerId);
    if (partnerInfo) setPartnerInfo({ ...partnerInfo, isRequest: false });
    fetchMessages();
  };

  const handleFriendRequest = async () => {
    if (friendshipStatus === 'NONE') {
      await respondFriendRequestAction(activePartnerId, 'ACCEPT');
      fetchFriendship();
    }
  };

  const name = partnerInfo?.name || activePartnerName || 'User';
  const avatar = partnerInfo?.avatarUrl || activePartnerAvatar || null;

  return (
    <div className="fixed bottom-0 right-3 sm:right-6 z-[90] w-[340px] sm:w-[380px] bg-white dark:bg-[#09090b] rounded-t-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
      {/* Messenger Header Bar */}
      <div className="p-3 bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-zinc-900 text-white flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar src={avatar} name={name} size="sm" square className="rounded-xl ring-2 ring-white/20" />
          <div className="min-w-0">
            <h4 className="text-xs font-black truncate leading-tight flex items-center gap-1.5">
              <span>{name}</span>
              {partnerInfo?.isFriend && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-normal">Teman</span>
              )}
            </h4>
            <p className="text-[10px] text-zinc-300 truncate">
              {partnerInfo?.email || 'Personal Chat'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Add Friend Button if not friends */}
          {friendshipStatus === 'NONE' && (
            <button
              type="button"
              onClick={handleFriendRequest}
              title="Tambah Teman"
              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
            >
              <span>👥</span> +Teman
            </button>
          )}

          {/* Minimize toggle */}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-7 h-7 rounded-lg hover:bg-white/15 text-white text-xs font-black transition-colors flex items-center justify-center"
          >
            {isMinimized ? '□' : '—'}
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={closeChat}
            className="w-7 h-7 rounded-lg hover:bg-white/15 text-white text-xs font-black transition-colors flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Message Request Notification Banner */}
          {partnerInfo?.isRequest && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 p-2.5 text-center text-xs space-y-1.5 shrink-0">
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                📩 Permintaan Pesan (Message Request)
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                User ini belum berada di daftar teman Anda. Pilihlah untuk menerima pesan ini.
              </p>
              <button
                type="button"
                onClick={handleAcceptRequest}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg transition-all shadow-xs"
              >
                ✓ Terima Pesan
              </button>
            </div>
          )}

          {/* Message History Stream */}
          <div className="p-3 overflow-y-auto space-y-2.5 max-h-[320px] min-h-[220px] text-xs bg-zinc-50/50 dark:bg-black/40 flex-1 scrollbar-thin">
            {loading && messages.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 text-xs animate-pulse font-bold">
                Memuat percakapan...
              </div>
            ) : messages.length === 0 ? (
              <div className="py-10 text-center space-y-2 text-zinc-400">
                <span className="text-3xl opacity-60">💬</span>
                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Belum Ada Pesan</p>
                <p className="text-[10px] max-w-[200px] mx-auto">
                  Mulai percakapan personal dengan <strong>{name}</strong>!
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId !== activePartnerId;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {/* Reply quote snippet */}
                    {m.replyMessage && (
                      <div
                        className={`text-[10px] p-1.5 rounded-t-xl mb-0.5 border max-w-[80%] opacity-80 ${
                          isMe
                            ? 'bg-purple-900/20 border-purple-500/30 text-purple-300 text-right'
                            : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-400 text-left'
                        }`}
                      >
                        <p className="font-bold truncate">↩ {m.replyMessage.senderName}</p>
                        <p className="truncate">{m.replyMessage.message}</p>
                      </div>
                    )}

                    <div className="flex items-end gap-1.5 max-w-[85%]">
                      {!isMe && (
                        <UserAvatar src={avatar} name={name} size="xs" square className="rounded-lg mb-1 shrink-0" />
                      )}

                      <div className="group relative">
                        {/* Message Bubble */}
                        <div
                          className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-2xs ${
                            isMe
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs'
                              : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/80 rounded-bl-xs'
                          }`}
                        >
                          {m.attachmentUrl && (
                            <div className="mb-1.5 rounded-xl overflow-hidden border border-white/20">
                              <img src={m.attachmentUrl} alt="Attachment" className="max-h-40 w-full object-cover" />
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{m.message}</p>

                          {/* Timestamp & Delivery Indicator */}
                          <div className={`mt-1 flex items-center gap-1 text-[9px] ${isMe ? 'justify-end text-purple-200/80' : 'justify-start text-zinc-400'}`}>
                            <span>{new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && (
                              <span title={m.status === 'READ' ? 'Terbaca' : 'Terkirim'} className="font-bold">
                                {m.status === 'READ' ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick Reaction Bar on Hover */}
                        <div className={`absolute -top-7 ${isMe ? 'right-0' : 'left-0'} hidden group-hover:flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-2 py-0.5 shadow-md z-10 animate-in fade-in duration-150`}>
                          {COMMON_EMOJIS.slice(0, 5).map((e) => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => handleToggleReaction(m.id, e)}
                              className="hover:scale-125 transition-transform text-xs"
                            >
                              {e}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setReplyingTo(m)}
                            className="text-[10px] text-purple-500 font-bold hover:underline ml-1"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Reactions Display */}
                    {m.reactions && m.reactions.length > 0 && (
                      <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {m.reactions.map((r) => (
                          <span
                            key={r.emoji}
                            className="px-1.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-[10px] border border-zinc-300 dark:border-zinc-700 flex items-center gap-0.5"
                          >
                            <span>{r.emoji}</span>
                            <span className="font-bold text-[9px] text-zinc-500">{r.userIds.length}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sticker & Emoji Picker */}
          {showStickers && (
            <div className="p-2 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSendMessage(s)}
                  className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl text-lg transition-transform hover:scale-125 shrink-0"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Replying Banner Quote */}
          {replyingTo && (
            <div className="px-3 py-1.5 bg-purple-500/10 border-t border-purple-500/20 text-[10px] flex items-center justify-between text-purple-600 dark:text-purple-400">
              <span className="truncate">
                Replying: &quot;{replyingTo.message}&quot;
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="font-bold text-xs hover:text-purple-400 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Attachment URL Input Bar */}
          {showAttachmentInput && (
            <div className="p-2 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1 text-xs">
              <input
                type="text"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="Paste gambar/file URL..."
                className="flex-1 px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowAttachmentInput(false)}
                className="text-zinc-400 text-xs hover:text-zinc-600 px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Message Input Box */}
          <div className="p-2 bg-white dark:bg-[#09090b] border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowStickers(!showStickers)}
              className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 text-sm transition-colors"
              title="Stickers / Emoji"
            >
              😊
            </button>
            <button
              type="button"
              onClick={() => setShowAttachmentInput(!showAttachmentInput)}
              className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 text-sm transition-colors"
              title="Lampiran Gambar"
            >
              🖼️
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Ketik pesan..."
              className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={sending || (!inputText.trim() && !attachmentUrl.trim())}
              className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              🚀
            </button>
          </div>
        </>
      )}
    </div>
  );
}
