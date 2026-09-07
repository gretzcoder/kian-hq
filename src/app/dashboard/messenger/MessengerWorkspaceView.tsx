'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getRecentConversationsAction,
  getDirectMessagesAction,
  sendDirectMessageAction,
  toggleDMReactionAction,
  acceptMessageRequestAction,
  deleteConversationPOVAction,
  voteDMPollAction,
  markCommunityChannelReadAction,
  getCurrentUserIdAction,
  ConversationItem,
  DirectMessage,
} from '@/modules/direct-messages/dmActions';
import {
  getWorkspaceChats,
  sendWorkspaceMessage,
  toggleWorkspaceChatReaction,
  voteWorkspacePollAction,
  markWorkspaceChatsRead,
} from '@/modules/workspaces/chatActions';
import {
  getCommunityMessages,
  sendCommunityMessage,
  toggleCommunityReaction,
} from '@/modules/community/communityActions';
import { respondFriendRequestAction, getFriendshipStatusAction, FriendshipStatus } from '@/modules/friends/friendActions';
import { ConversationList } from '@/components/chat/ConversationList';
import { CompactMessageBubble } from '@/components/chat/CompactMessageBubble';
import { CompactChatComposer, StickerOption } from '@/components/chat/CompactChatComposer';
import { DateSeparatorDivider } from '@/components/chat/DateSeparatorDivider';
import { CreatePollModal } from '@/components/chat/CreatePollModal';
import UserAvatar from '@/components/ui/UserAvatar';
import { DeletePOVModal } from '@/components/DeletePOVModal';
import { useFloatingMessenger } from '@/modules/direct-messages/components/FloatingMessengerContext';

const STICKERS: StickerOption[] = [
  { id: 'STK_1', emoji: '🚀', name: 'Gasss Rocket!' },
  { id: 'STK_2', emoji: '💯', name: '100% Mantap' },
  { id: 'STK_3', emoji: '✨', name: 'Sparkles Hype' },
  { id: 'STK_4', emoji: '⚡', name: 'Super Flash' },
  { id: 'STK_5', emoji: '🏆', name: 'Juara Tropi' },
  { id: 'STK_6', emoji: '🎉', name: 'Pesta Hore' },
  { id: 'STK_7', emoji: '💪', name: 'Semangat Kaka' },
  { id: 'STK_8', emoji: '🎯', name: 'Tepat Sasaran' },
  { id: 'STK_9', emoji: '☕', name: 'Ngopi Dulu' },
  { id: 'STK_10', emoji: '🦥', name: 'Mode Santuy' },
];

function getDateDividerLabel(timestamp: number): string {
  try {
    const msgDate = new Date(timestamp > 1e11 ? timestamp : timestamp * 1000);
    const now = new Date();

    const isToday = msgDate.toDateString() === now.toDateString();
    if (isToday) return 'Hari Ini';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (msgDate.toDateString() === yesterday.toDateString()) return 'Kemarin';

    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(msgDate);
  } catch {
    return '';
  }
}

function deduplicateDirectMessages(msgs: DirectMessage[]): DirectMessage[] {
  const seenIds = new Set<string>();
  const result: DirectMessage[] = [];

  for (const m of msgs) {
    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);

    const isDuplicateContent = result.some(
      (existing) =>
        existing.senderId === m.senderId &&
        existing.message === m.message &&
        Math.abs(existing.createdAt - m.createdAt) < 4000
    );

    if (!isDuplicateContent) {
      result.push(m);
    }
  }

  return result;
}

export function MessengerWorkspaceView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramPartnerId = searchParams.get('chatUserId') || searchParams.get('partnerId');

  const { refreshUnread } = useFloatingMessenger();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUserIdAction().then((uid) => {
      if (uid) setCurrentUserId(uid);
    });
  }, []);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(paramPartnerId);
  const [activeCategory, setActiveCategory] = useState<'PERSONAL' | 'WORKSPACE' | 'COMMUNITY' | 'REQUESTS'>('PERSONAL');
  const [activeTargetUrl, setActiveTargetUrl] = useState<string | null>(null);

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
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);

  // Mobile View Navigation State: 'LIST' | 'CHAT'
  const [mobileView, setMobileView] = useState<'LIST' | 'CHAT'>(paramPartnerId ? 'CHAT' : 'LIST');
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // Poll modal state
  const [showPollModal, setShowPollModal] = useState(false);

  // Actions & Selection state
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());

  // Delete POV Modal state
  const [deletePOVTarget, setDeletePOVTarget] = useState<ConversationItem | null>(null);
  const [submittingDeletePOV, setSubmittingDeletePOV] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Conversation Inbox List
  const fetchInbox = async () => {
    setLoadingConv(true);
    try {
      const res = await getRecentConversationsAction('ALL');
      if (res.success && res.conversations) {
        setConversations(res.conversations);
        if (!activePartnerId && res.conversations.length > 0) {
          const firstItem = res.conversations[0];
          if (firstItem) {
            setActivePartnerId(firstItem.partnerId);
            setActiveCategory(firstItem.category);
            setActiveTargetUrl(firstItem.targetUrl || null);
          }
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoadingConv(false);
    }
  };

  // Fetch Active Messages in-place for Personal, Workspace, or Community
  const fetchActiveChat = async (targetId: string, category: 'PERSONAL' | 'WORKSPACE' | 'COMMUNITY' | 'REQUESTS') => {
    if (!targetId) return;

    try {
      if (category === 'WORKSPACE') {
        markWorkspaceChatsRead(targetId).catch(() => {});
        const wsChats = await getWorkspaceChats(targetId);
        if (wsChats && Array.isArray(wsChats)) {
          const mapped: DirectMessage[] = wsChats.map((r: any) => ({
            id: r.id,
            senderId: r.user_id,
            receiverId: targetId,
            message: r.message,
            attachmentUrl: r.attachment_url,
            replyToId: r.parent_id,
            replyMessage: r.reply_message ? { id: r.parent_id, senderName: r.reply_user_name || 'User', message: r.reply_message } : null,
            reactions: (r.reactions || []).map((rx: any) => ({
              emoji: rx.emoji,
              count: rx.count,
              hasReacted: rx.hasReacted,
              userIds: rx.userNames || [],
            })),
            status: 'READ',
            isRequest: false,
            createdAt: r.created_at * 1000,
            isEdited: r.is_edited,
            editCount: r.edit_count,
            isPinned: r.is_pinned,
          }));
          setMessages(deduplicateDirectMessages(mapped));
        }
        return;
      }

      if (category === 'COMMUNITY') {
        markCommunityChannelReadAction(targetId).catch(() => {});
        const commMsgs = await getCommunityMessages(targetId);
        if (commMsgs && Array.isArray(commMsgs)) {
          const mapped: DirectMessage[] = commMsgs.map((r: any) => ({
            id: r.id,
            senderId: r.user_id,
            receiverId: targetId,
            message: r.message,
            attachmentUrl: r.attachment_url,
            replyToId: r.parent_id,
            replyMessage: r.reply_message ? { id: r.parent_id, senderName: r.reply_user_name || 'User', message: r.reply_message } : null,
            reactions: (r.reactions || []).map((rx: any) => ({
              emoji: rx.emoji,
              count: rx.count,
              hasReacted: rx.hasReacted,
              userIds: rx.userNames || [],
            })),
            status: 'READ',
            isRequest: false,
            createdAt: typeof r.created_at === 'number' ? r.created_at * 1000 : new Date(r.created_at).getTime(),
            isEdited: r.is_edited,
          }));
          setMessages(deduplicateDirectMessages(mapped));
        }
        return;
      }

      // PERSONAL DMs
      const [msgRes, friendRes] = await Promise.all([
        getDirectMessagesAction(targetId),
        getFriendshipStatusAction(targetId),
      ]);

      if (msgRes.success && msgRes.messages) {
        setMessages(deduplicateDirectMessages(msgRes.messages));
        if (msgRes.partnerInfo) setPartnerInfo(msgRes.partnerInfo);
      }
      if (friendRes.success) {
        setFriendshipStatus(friendRes.status);
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  useEffect(() => {
    if (activePartnerId) {
      setLoadingMsg(true);
      fetchActiveChat(activePartnerId, activeCategory).finally(() => setLoadingMsg(false));

      const interval = setInterval(() => fetchActiveChat(activePartnerId, activeCategory), 8_000);
      return () => clearInterval(interval);
    }
  }, [activePartnerId, activeCategory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Handle Selecting ANY Conversation in-place without redirecting!
  const handleSelectConversation = (conv: ConversationItem) => {
    setActivePartnerId(conv.partnerId);
    setActiveCategory(conv.category);
    setActiveTargetUrl(conv.targetUrl || null);
    setPartnerInfo({
      id: conv.partnerId,
      name: conv.partnerName,
      email: conv.partnerEmail,
      avatarUrl: conv.partnerAvatar || null,
      userType: conv.partnerUserType || null,
      isFriend: Boolean(conv.isFriend),
      isRequest: Boolean(conv.isRequest),
    });
    setMobileView('CHAT');
  };

  // Send Message (Handles Personal, Workspace, & Community seamlessly)
  const handleSend = async (text: string, attachmentUrl?: string) => {
    if (!activePartnerId) return;

    if (activeCategory === 'WORKSPACE') {
      const res = await sendWorkspaceMessage(activePartnerId, text, replyingTo?.id, attachmentUrl);
      if (res.success) {
        setReplyingTo(null);
        fetchActiveChat(activePartnerId, 'WORKSPACE');
        fetchInbox();
      }
      return;
    }

    if (activeCategory === 'COMMUNITY') {
      const res = await sendCommunityMessage(activePartnerId, text, replyingTo?.id, attachmentUrl);
      if (res.success) {
        setReplyingTo(null);
        fetchActiveChat(activePartnerId, 'COMMUNITY');
        fetchInbox();
      }
      return;
    }

    // Personal DM
    const res = await sendDirectMessageAction({
      receiverId: activePartnerId,
      message: text,
      attachmentUrl,
      replyToId: replyingTo?.id,
    });

    if (res.success && res.message) {
      setMessages((prev) => [...prev, res.message!]);
      setReplyingTo(null);
      fetchInbox();
      refreshUnread();
    }
  };

  // Vote on Poll
  const handleVotePoll = async (msgId: string, optionId: string) => {
    if (!activePartnerId) return;

    if (activeCategory === 'WORKSPACE') {
      const res = await voteWorkspacePollAction(msgId, optionId, activePartnerId);
      if (res.success) {
        fetchActiveChat(activePartnerId, 'WORKSPACE');
      }
      return;
    }

    const res = await voteDMPollAction(msgId, optionId);
    if (res.success) {
      fetchActiveChat(activePartnerId, activeCategory);
    }
  };

  // Toggle Reaction
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    if (!activePartnerId) return;

    if (activeCategory === 'WORKSPACE') {
      await toggleWorkspaceChatReaction(msgId, emoji, activePartnerId);
      fetchActiveChat(activePartnerId, 'WORKSPACE');
      return;
    }

    if (activeCategory === 'COMMUNITY') {
      await toggleCommunityReaction(msgId, emoji);
      fetchActiveChat(activePartnerId, 'COMMUNITY');
      return;
    }

    const res = await toggleDMReactionAction(msgId, emoji);
    if (res.success && res.reactions) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reactions: res.reactions! } : m))
      );
    }
  };

  // Accept Message Request
  const handleAcceptRequest = async () => {
    if (!activePartnerId) return;
    await acceptMessageRequestAction(activePartnerId);
    if (partnerInfo) setPartnerInfo({ ...partnerInfo, isRequest: false });
    fetchActiveChat(activePartnerId, activeCategory);
    fetchInbox();
  };

  // Add / Accept Friend
  const handleFriendRequest = async () => {
    if (!activePartnerId) return;
    await respondFriendRequestAction(activePartnerId, 'ACCEPT');
    setFriendshipStatus('FRIENDS');
    fetchActiveChat(activePartnerId, activeCategory);
  };

  // Delete POV Action
  const handleConfirmDeletePOV = async () => {
    if (!deletePOVTarget) return;
    setSubmittingDeletePOV(true);
    try {
      await deleteConversationPOVAction(deletePOVTarget.partnerId);
      setDeletePOVTarget(null);
      if (activePartnerId === deletePOVTarget.partnerId) {
        setMessages([]);
      }
      await fetchInbox();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingDeletePOV(false);
    }
  };

  const activeConv = conversations.find((c) => c.partnerId === activePartnerId || c.id === activePartnerId);
  const activeName = partnerInfo?.name || activeConv?.partnerName || 'Chat Room';
  const activeAvatar = partnerInfo?.avatarUrl || activeConv?.partnerAvatar;

  return (
    <div className="flex h-[calc(100vh-80px)] w-full max-w-7xl mx-auto bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden relative">
      {/* ── LEFT PANE: INBOX CONVERSATION LIST (Desktop flex 0-0-340px, Mobile full screen when mobileView === 'LIST') ── */}
      <div
        className={`w-full sm:w-[340px] md:w-[360px] shrink-0 h-full ${
          mobileView === 'LIST' ? 'block' : 'hidden sm:block'
        }`}
      >
        <ConversationList
          conversations={conversations}
          activeId={activePartnerId}
          onSelect={handleSelectConversation}
          onDeletePOV={(conv) => setDeletePOVTarget(conv)}
          loading={loadingConv}
        />
      </div>

      {/* ── CENTER PANE: ACTIVE CHAT ROOM (Flex-1, Mobile full screen when mobileView === 'CHAT') ── */}
      <div
        className={`flex-1 h-full flex flex-col bg-zinc-50/50 dark:bg-black/40 min-w-0 ${
          mobileView === 'CHAT' ? 'block' : 'hidden sm:flex'
        }`}
      >
        {activePartnerId && (activeConv || partnerInfo) ? (
          <>
            {/* Room Top Header Bar */}
            <div className="p-3.5 sm:p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/90 dark:border-zinc-800/90 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile Back Button (`←`) */}
                <button
                  type="button"
                  onClick={() => setMobileView('LIST')}
                  className="sm:hidden w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center font-bold text-sm"
                  title="Kembali ke Inbox"
                >
                  ←
                </button>

                <UserAvatar src={activeAvatar} name={activeName} size="md" square className="rounded-2xl shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-2">
                    <span>{activeName}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 shrink-0">
                      {activeCategory}
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-400 truncate">
                    {partnerInfo?.email || 'Live Chat Stream'}
                  </p>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-1 sm:gap-2">
                {activeTargetUrl && (
                  <button
                    type="button"
                    onClick={() => router.push(activeTargetUrl)}
                    className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer flex items-center gap-1"
                    title="Buka Dashboard Workspace / Channel"
                  >
                    <span>⚡ Halaman Detail</span> ↗
                  </button>
                )}

                {activeCategory === 'PERSONAL' && friendshipStatus === 'NONE' && (
                  <button
                    type="button"
                    onClick={handleFriendRequest}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    + Teman
                  </button>
                )}

                {/* Right Context Panel Toggle */}
                <button
                  type="button"
                  onClick={() => setShowRightSidebar((prev) => !prev)}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    showRightSidebar
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                  title="Toggle Detail Room"
                >
                  ℹ️
                </button>
              </div>
            </div>

            {/* Message Request Notification Banner */}
            {partnerInfo?.isRequest && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 p-3 text-center text-xs space-y-1.5 shrink-0">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  📩 Permintaan Pesan (Message Request)
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  User ini belum berada di daftar teman Anda. Anda dapat menerima pesan ini.
                </p>
                <button
                  type="button"
                  onClick={handleAcceptRequest}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  ✓ Terima Pesan
                </button>
              </div>
            )}

            {/* Stream List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin relative">
              {loadingMsg && messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400 font-bold animate-pulse">
                  Memuat percakapan...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 text-zinc-400">
                  <span className="text-4xl opacity-50">💬</span>
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Belum Ada Pesan</p>
                  <p className="text-xs text-zinc-400 max-w-xs">
                    Mulai percakapan dengan <strong>{activeName}</strong> sekarang!
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = currentUserId
                    ? msg.senderId === currentUserId
                    : activeCategory === 'PERSONAL'
                    ? msg.senderId !== activePartnerId
                    : false;
                  const prevMsg = index > 0 ? messages[index - 1] : null;

                  // Date Separator Divider Check
                  const currentDateLabel = getDateDividerLabel(msg.createdAt);
                  const prevDateLabel = prevMsg ? getDateDividerLabel(prevMsg.createdAt) : null;
                  const showDateDivider = currentDateLabel !== prevDateLabel;

                  // Consecutive Sender Grouping Check (within 2 minutes)
                  const isSameSender =
                    prevMsg &&
                    prevMsg.senderId === msg.senderId &&
                    !showDateDivider &&
                    Math.abs((msg.createdAt > 1e11 ? msg.createdAt : msg.createdAt * 1000) - (prevMsg.createdAt > 1e11 ? prevMsg.createdAt : prevMsg.createdAt * 1000)) < 120_000;

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && <DateSeparatorDivider label={currentDateLabel} />}
                      <CompactMessageBubble
                        id={msg.id}
                        isMe={isMe}
                        showSenderHeader={!isSameSender}
                        senderName={isMe ? 'Anda' : activeName}
                        senderAvatar={isMe ? null : activeAvatar}
                        message={msg.message}
                        attachmentUrl={msg.attachmentUrl}
                        replyMessage={msg.replyMessage}
                        reactions={msg.reactions}
                        status={msg.status}
                        createdAt={msg.createdAt}
                        isEdited={msg.isEdited}
                        isSelectMode={isSelectMode}
                        isSelected={selectedMsgIds.has(msg.id)}
                        currentUserId={currentUserId || undefined}
                        onToggleSelect={(id) => {
                          setSelectedMsgIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          });
                        }}
                        onToggleReaction={handleToggleReaction}
                        onVotePoll={handleVotePoll}
                        onReply={() => setReplyingTo(msg)}
                        onCopy={(text) => navigator.clipboard.writeText(text)}
                        onDelete={() => {
                          setDeletePOVTarget(activeConv || null);
                        }}
                        canEdit={isMe}
                        canDelete={true}
                      />
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Simplified Composer */}
            <CompactChatComposer
              onSend={handleSend}
              replyingTo={
                replyingTo
                  ? {
                      id: replyingTo.id,
                      senderName: replyingTo.senderId === activePartnerId ? activeName : 'Anda',
                      message: replyingTo.message,
                    }
                  : null
              }
              onCancelReply={() => setReplyingTo(null)}
              placeholder={`Tulis pesan untuk ${activeName}...`}
              stickers={STICKERS}
              onOpenPollModal={() => setShowPollModal(true)}
            />
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-zinc-400">
            <span className="text-5xl opacity-40">💬</span>
            <p className="text-base font-bold text-zinc-700 dark:text-zinc-300">Pilih Percakapan</p>
            <p className="text-xs text-zinc-400 max-w-sm">
              Pilihlah salah satu percakapan personal, workspace room, atau community channel dari inbox sebelah kiri.
            </p>
          </div>
        )}
      </div>

      {/* ── RIGHT PANE: COLLAPSIBLE CONTEXT SIDEBAR (Desktop 280px) ── */}
      {showRightSidebar && activePartnerId && (
        <div className="w-72 border-l border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-[#09090b] p-5 flex flex-col space-y-6 overflow-y-auto shrink-0 animate-in slide-in-from-right-5 duration-200">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
              Detail Room
            </h4>
            <button
              type="button"
              onClick={() => setShowRightSidebar(false)}
              className="text-zinc-400 hover:text-white font-bold text-xs"
            >
              ✕
            </button>
          </div>

          <div className="text-center space-y-3">
            <UserAvatar src={activeAvatar} name={activeName} size="xl" square className="mx-auto rounded-3xl ring-4 ring-purple-500/20 shadow-xl" />
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">{activeName}</h3>
              <p className="text-xs text-zinc-400">{partnerInfo?.email || 'Live Chat Stream'}</p>
            </div>
            <span className="inline-block px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px] uppercase tracking-wider rounded-full border border-purple-500/20">
              {activeCategory}
            </span>
          </div>

          <div className="space-y-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <h5 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Aksi Cepat</h5>
            {activeTargetUrl && (
              <button
                type="button"
                onClick={() => router.push(activeTargetUrl)}
                className="w-full p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>⚡</span> Halaman Detail Workspace
              </button>
            )}
            {activeConv && (
              <button
                type="button"
                onClick={() => setDeletePOVTarget(activeConv)}
                className="w-full p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>🗑️</span> Hapus Chat (POV)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create Poll Modal */}
      <CreatePollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onCreatePoll={(pollPayload) => {
          handleSend(pollPayload);
        }}
      />

      {/* Delete POV Modal */}
      <DeletePOVModal
        isOpen={Boolean(deletePOVTarget)}
        onClose={() => setDeletePOVTarget(null)}
        onConfirm={handleConfirmDeletePOV}
        submitting={submittingDeletePOV}
        title={`⚠️ Hapus Percakapan dengan ${deletePOVTarget?.partnerName}?`}
        message="Apakah Anda yakin ingin menghapus percakapan ini? Percakapan ini HANYA akan dihapus dari tampilan Anda (POV). Lawan bicara Anda tetap dapat melihat seluruh isi percakapan."
      />
    </div>
  );
}
