'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  CommunityChannel,
  CommunityMessage,
  CommunityMember,
  CommunityMemberGroup,
  getCommunityChannels,
  getCommunityMessages,
  getCommunityMembers,
  sendCommunityMessage,
  toggleCommunityReaction,
} from '../communityActions';
import type { EmojiClickData } from 'emoji-picker-react';

// Dynamic import for emoji-picker-react to ensure smooth SSR rendering
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface CommunityChatViewProps {
  initialWorkChannels: CommunityChannel[];
  initialGeneralChannels: CommunityChannel[];
  initialChannelId?: string;
  initialOnlineRoleGroups?: CommunityMemberGroup[];
  initialOfflineMembers?: CommunityMember[];
  initialTotalOnline?: number;
  initialTotalOffline?: number;
  currentUserId: string;
}

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '👍', '😂', '✨', '🚀', '💡'];

// 100% Pure Community, Chill, Funny & Meme Stickers (No Workspace Vibe)
const STICKER_PACKS = [
  // 😂 LUCU & MEME VIBES
  { id: 'STK_CAT_COFFEE', icon: '🐱☕', label: 'Mengisi Daya Kopi...', tag: 'Kopi Senja', bg: 'from-amber-500 to-orange-600' },
  { id: 'STK_SLOTH_CHILL', icon: '🦥', label: 'Mode Santuy Abis~', tag: 'Relax', bg: 'from-emerald-500 to-teal-600' },
  { id: 'STK_DINO_RAWR', icon: '🦖🔥', label: 'RAWR! Menyala Gais!', tag: 'Menyala 🔥', bg: 'from-purple-600 to-pink-600' },
  { id: 'STK_POPCORN_DRAMA', icon: '🍿👀', label: 'Nyimak Dulu Deh...', tag: 'Nimbrung', bg: 'from-yellow-400 to-amber-600' },
  { id: 'STK_MELT_LIFE', icon: '🫠', label: 'Meleleh Ketiban Kehidupan', tag: 'Meleleh', bg: 'from-rose-500 to-red-600' },
  { id: 'STK_CLOWN_CIRCUS', icon: '🎪🤡', label: 'Lucu Banget Komedi Hari Ini', tag: 'Ngakak', bg: 'from-indigo-500 to-purple-600' },

  // 🔥 HYPE, SANTAI & SELEBRASI
  { id: 'STK_PARTY_ANIMAL', icon: '🥳🎉', label: 'Pesta Ria Komunitas!', tag: 'Party!', bg: 'from-pink-500 to-purple-600' },
  { id: 'STK_ROCKET_MOON', icon: '🚀✨', label: 'Gas Pol Rem Blong!', tag: 'Gasss!', bg: 'from-blue-600 to-indigo-600' },
  { id: 'STK_GG_WP', icon: '🏆💯', label: 'Keren Banget Nilai 100!', tag: 'Mantap', bg: 'from-amber-400 to-yellow-600' },
  { id: 'STK_BIG_BRAIN', icon: '🧠💡', label: 'Punya Ide Brilian!', tag: 'Hore!', bg: 'from-cyan-500 to-blue-600' },
  { id: 'STK_HEART_BURST', icon: '💖🌸', label: 'Love You All Guys~', tag: 'Luvv', bg: 'from-rose-400 to-pink-600' },
  { id: 'STK_HIGHFIVE_TEAM', icon: '🙌🔥', label: 'Tos Dulu Kita Semua!', tag: 'Hype', bg: 'from-emerald-500 to-green-600' },

  // 🍕 DAILY FUN & CHILL
  { id: 'STK_SNACK_TIME', icon: '🍕🥤', label: 'Waktunya Jajan & Camilan!', tag: 'Jajan', bg: 'from-purple-500 to-pink-500' },
  { id: 'STK_SLEEPY_HEAD', icon: '😴💤', label: 'Izin Rebahan Dulu...', tag: 'Sleepy', bg: 'from-blue-500 to-indigo-700' },
  { id: 'STK_MUSIC_VIBES', icon: '🎧🎶', label: 'Asyik Dengerin Musik', tag: 'Chill Vibes', bg: 'from-emerald-600 to-teal-700' },
  { id: 'STK_GAMING_MODE', icon: '🎮🕹️', label: 'Gas Mabar Main Game!', tag: 'Gaming', bg: 'from-yellow-400 to-amber-500' },
];

export default function CommunityChatView({
  initialWorkChannels,
  initialGeneralChannels,
  initialChannelId,
  initialOnlineRoleGroups = [],
  initialOfflineMembers = [],
  initialTotalOnline = 0,
  initialTotalOffline = 0,
  currentUserId,
}: CommunityChatViewProps) {
  const allChannels = [...initialWorkChannels, ...initialGeneralChannels];
  const defaultChannel =
    allChannels.find((c) => c.id === initialChannelId) ||
    initialWorkChannels[0] ||
    initialGeneralChannels[0];

  const [workChannels, setWorkChannels] = useState<CommunityChannel[]>(initialWorkChannels);
  const [generalChannels, setGeneralChannels] = useState<CommunityChannel[]>(initialGeneralChannels);
  const [activeChannel, setActiveChannel] = useState<CommunityChannel>(defaultChannel);

  // Community Members State (Role-Hierarchical Online Groups + Single Offline Bottom Group)
  const [onlineRoleGroups, setOnlineRoleGroups] = useState<CommunityMemberGroup[]>(initialOnlineRoleGroups);
  const [offlineMembers, setOfflineMembers] = useState<CommunityMember[]>(initialOfflineMembers);
  const [totalOnline, setTotalOnline] = useState(initialTotalOnline);
  const [totalOffline, setTotalOffline] = useState(initialTotalOffline);
  const [showMemberSidebar, setShowMemberSidebar] = useState(false); // Closed by default on mobile
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Mention Autocomplete State
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [selectedMentionCursor, setSelectedMentionCursor] = useState(0);

  // Selected Member for Profile Highlight Card Modal
  const [selectedMemberCard, setSelectedMemberCard] = useState<CommunityMember | null>(null);

  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);

  // Popover modal state for Emojis & Community Stickers
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker'>('emoji');
  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);

  const [replyingTo, setReplyingTo] = useState<CommunityMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [mobileChannelOpen, setMobileChannelOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Unified members array for mentions
  const allMembersList: CommunityMember[] = React.useMemo(() => {
    const onlineList = onlineRoleGroups.flatMap((g) => g.members);
    const combined = [...onlineList, ...offlineMembers];
    const uniqueMap = new Map<string, CommunityMember>();
    for (const m of combined) {
      if (!uniqueMap.has(m.id)) uniqueMap.set(m.id, m);
    }
    return Array.from(uniqueMap.values());
  }, [onlineRoleGroups, offlineMembers]);

  // Mention candidates filter
  const mentionCandidates = React.useMemo(() => {
    if (!mentionQuery) return allMembersList.slice(0, 8);
    const q = mentionQuery.toLowerCase();
    return allMembersList
      .filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allMembersList, mentionQuery]);

  // Helper to parse message text and turn @mentions into clickable profile buttons
  const renderMessageContent = (text: string, isSelf: boolean) => {
    const parts = text.split(/(@[\w.-]+)/g);

    return parts.map((part, index) => {
      if (part.startsWith('@') && part.length > 1) {
        const queryHandle = part.substring(1).toLowerCase();

        // Find member matching handle or name
        const matchingMember = allMembersList.find((m) => {
          const firstName = m.name.split(' ')[0].toLowerCase();
          const fullName = m.name.toLowerCase();
          const emailUser = m.email.split('@')[0].toLowerCase();
          return (
            firstName === queryHandle ||
            fullName === queryHandle ||
            emailUser === queryHandle ||
            m.name.toLowerCase().startsWith(queryHandle)
          );
        });

        return (
          <button
            key={index}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (matchingMember) {
                setSelectedMemberCard(matchingMember);
              } else {
                const foundAny = allMembersList.find((m) =>
                  m.name.toLowerCase().includes(queryHandle)
                );
                if (foundAny) {
                  setSelectedMemberCard(foundAny);
                } else {
                  // Fallback highlight card
                  setSelectedMemberCard({
                    id: `mention_${queryHandle}`,
                    name: part.substring(1),
                    email: `${queryHandle}@kian.com`,
                    role_name: 'Anggota Komunitas',
                    role_color: '#7c3aed',
                    is_online: false,
                  });
                }
              }
            }}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-lg text-xs font-black transition-all active:scale-95 cursor-pointer shadow-2xs ${
              isSelf
                ? 'bg-white/25 text-white hover:bg-white/40 ring-1 ring-white/30'
                : 'bg-purple-500/20 text-purple-600 dark:text-purple-300 hover:bg-purple-500/30 ring-1 ring-purple-500/30'
            }`}
            title={`Klik untuk lihat profil ${matchingMember ? matchingMember.name : part}`}
          >
            <span>@</span>
            <span>{matchingMember ? matchingMember.name.split(' ')[0] : part.substring(1)}</span>
          </button>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  // Input change handler with @mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInputMessage(val);

    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!query.includes(' ') && !query.includes('\n')) {
          setMentionQuery(query);
          setMentionIndex(lastAtIndex);
          setShowMentionSuggestions(true);
          setSelectedMentionCursor(0);
          return;
        }
      }
    }

    setShowMentionSuggestions(false);
  };

  // Insert mention into input text
  const insertMention = (member: CommunityMember) => {
    const mentionHandle = member.name.includes(' ') ? member.name.split(' ')[0] : member.name;
    const beforeAt = inputMessage.slice(0, mentionIndex);
    const afterCursor = inputMessage.slice(mentionIndex + 1 + mentionQuery.length);

    const newText = `${beforeAt}@${mentionHandle} ${afterCursor}`;
    setInputMessage(newText);
    setShowMentionSuggestions(false);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Handle KeyDown for Navigation & Mentions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionSuggestions && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionCursor((prev) => (prev + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionCursor((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionCandidates[selectedMentionCursor]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentionSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Scroll to bottom of message list
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Scroll to specific quoted message
  const scrollToMessage = (msgId: string) => {
    const el = messageRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(msgId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  // Load messages for current channel
  const fetchMessages = async (channelId: string, isInitial = false) => {
    if (isInitial) setLoadingMessages(true);
    try {
      const data = await getCommunityMessages(channelId);
      setMessages(data);
      if (isInitial) {
        setTimeout(() => scrollToBottom(false), 100);
      }
    } catch (err) {
      console.error('Failed to load community messages:', err);
    } finally {
      if (isInitial) setLoadingMessages(false);
    }
  };

  // Fetch community members & role groups
  const fetchMembers = async () => {
    try {
      const data = await getCommunityMembers();
      setOnlineRoleGroups(data.onlineRoleGroups);
      setOfflineMembers(data.offlineMembers);
      setTotalOnline(data.totalOnline);
      setTotalOffline(data.totalOffline);
    } catch (err) {
      console.error('Failed to fetch community members:', err);
    }
  };

  // Refresh channels (unreads)
  const refreshChannels = async () => {
    try {
      const { workChannels: w, generalChannels: g } = await getCommunityChannels();
      setWorkChannels(w);
      setGeneralChannels(g);
    } catch (err) {
      console.error('Failed to refresh channels:', err);
    }
  };

  // Channel change handler
  const handleSelectChannel = (channel: CommunityChannel) => {
    setActiveChannel(channel);
    setMobileChannelOpen(false);
    setReplyingTo(null);
    setShowPickerModal(false);
    setShowMentionSuggestions(false);
    setReactingToMessageId(null);
    fetchMessages(channel.id, true);
  };

  // Initial load & Polling
  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    if (activeChannel?.id) {
      fetchMessages(activeChannel.id, true);

      const interval = setInterval(() => {
        fetchMessages(activeChannel.id, false);
        refreshChannels();
        fetchMembers();
      }, 4000);

      return () => clearInterval(interval);
    }
  }, [activeChannel?.id]);

  // Send text message or reply
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !attachmentUrl.trim()) return;

    setSending(true);
    const msgText = inputMessage;
    const attUrl = attachmentUrl;
    const parentId = replyingTo?.id;

    setInputMessage('');
    setAttachmentUrl('');
    setShowAttachmentInput(false);
    setShowPickerModal(false);
    setShowMentionSuggestions(false);
    setReplyingTo(null);

    try {
      const res = await sendCommunityMessage(activeChannel.id, msgText, attUrl, parentId);
      if (res.success) {
        await fetchMessages(activeChannel.id, false);
        scrollToBottom(true);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  // Send Sticker
  const handleSendSticker = async (sticker: typeof STICKER_PACKS[0]) => {
    setShowPickerModal(false);
    setShowMentionSuggestions(false);
    setReactingToMessageId(null);
    setSending(true);
    const stickerPayload = `[STICKER:${sticker.id}|${sticker.icon}|${sticker.label}|${sticker.bg}]`;
    const parentId = replyingTo?.id;
    setReplyingTo(null);

    try {
      const res = await sendCommunityMessage(activeChannel.id, stickerPayload, undefined, parentId);
      if (res.success) {
        await fetchMessages(activeChannel.id, false);
        scrollToBottom(true);
      }
    } catch (err) {
      console.error('Failed to send sticker:', err);
    } finally {
      setSending(false);
    }
  };

  // Emoji Selected Handler (For Input Text OR Reaction)
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const selectedEmoji = emojiData.emoji;

    if (reactingToMessageId) {
      // User is reacting to a message with flexible emoji
      handleReaction(reactingToMessageId, selectedEmoji);
      setReactingToMessageId(null);
      setShowPickerModal(false);
    } else {
      // User is appending emoji to input message
      setInputMessage((prev) => prev + selectedEmoji);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  // Toggle emoji reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleCommunityReaction(messageId, emoji);
      fetchMessages(activeChannel.id, false);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Helper to parse sticker text
  const parseSticker = (text: string) => {
    if (text.startsWith('[STICKER:') && text.endsWith(']')) {
      const parts = text.slice(9, -1).split('|');
      if (parts.length >= 4) {
        return {
          id: parts[0],
          icon: parts[1],
          label: parts[2],
          bg: parts[3],
        };
      }
    }
    return null;
  };

  // Helper to find or construct CommunityMember from message info
  const openMemberCardFromMessage = (msg: CommunityMessage) => {
    for (const group of onlineRoleGroups) {
      const found = group.members.find((m) => m.id === msg.user_id);
      if (found) {
        setSelectedMemberCard(found);
        return;
      }
    }
    const foundOffline = offlineMembers.find((m) => m.id === msg.user_id);
    if (foundOffline) {
      setSelectedMemberCard(foundOffline);
      return;
    }

    setSelectedMemberCard({
      id: msg.user_id,
      name: msg.user_name,
      email: msg.user_email,
      avatar_url: msg.user_avatar,
      role_name: msg.user_role_name || 'Anggota Tim',
      role_color: msg.user_role_color || '#7c3aed',
      is_online: false,
    });
  };

  // Search Filtered Offline Members
  const filteredOfflineMembers = offlineMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row bg-white dark:bg-[#09090b] rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden h-[calc(100vh-140px)] min-h-[580px] relative">
      {/* ── MOBILE TOP CHANNEL & MEMBER CONTROLLER BAR ── */}
      <div className="lg:hidden p-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-2 shrink-0 z-20">
        <button
          onClick={() => setMobileChannelOpen((p) => !p)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-black text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 active:scale-95 transition-transform shadow-2xs truncate max-w-[60%]"
        >
          <span className="text-base">{activeChannel.icon}</span>
          <span className="truncate">{activeChannel.name}</span>
          <span className="text-zinc-400 text-[10px] shrink-0">{mobileChannelOpen ? '▲' : '▼'}</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Member Sidebar Toggle */}
          <button
            onClick={() => setShowMemberSidebar((p) => !p)}
            className={`px-3 py-2 rounded-2xl border text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 shadow-xs ${
              showMemberSidebar
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-purple-500/20'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <span>👥</span>
            <span>{totalOnline} Online</span>
          </button>
        </div>
      </div>

      {/* ── BACKDROP OVERLAY FOR MOBILE CHANNEL DRAWER ── */}
      {mobileChannelOpen && (
        <div
          onClick={() => setMobileChannelOpen(false)}
          className="lg:hidden absolute inset-0 bg-black/40 z-20 backdrop-blur-xs animate-in fade-in"
        />
      )}

      {/* ── SIDEBAR: DESKTOP PERMANENT / MOBILE SLIDE-DOWN DRAWER ── */}
      <aside
        className={`lg:w-72 border-r border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/95 backdrop-blur-md flex flex-col shrink-0 transition-all ${
          mobileChannelOpen
            ? 'absolute top-14 left-0 right-0 z-30 max-h-[70vh] rounded-b-3xl border-b shadow-2xl flex animate-in slide-in-from-top duration-200'
            : 'hidden lg:flex lg:relative'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-purple-500/20">
              💬
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Community Hub
              </h2>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Saluran Diskusi & Obrolan</p>
            </div>
          </div>

          {mobileChannelOpen && (
            <button
              onClick={() => setMobileChannelOpen(false)}
              className="lg:hidden text-zinc-400 hover:text-zinc-600 text-xs font-bold px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800"
            >
              ✕ Tutup
            </button>
          )}
        </div>

        {/* Channel Category Lists */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* 💼 KATEGORI KERJAAN */}
          <div className="space-y-1">
            <p className="px-3 text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>💼</span>
              <span>Kategori Kerjaan</span>
            </p>
            {workChannels.map((ch) => {
              const isActive = activeChannel.id === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleSelectChannel(ch)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-sm shrink-0">{ch.icon}</span>
                    <span className="truncate">{ch.name}</span>
                  </div>
                  {!!ch.unreadCount && ch.unreadCount > 0 && !isActive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500 text-white shrink-0 shadow-xs">
                      {ch.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 💬 GENERAL & SANTAI */}
          <div className="space-y-1">
            <p className="px-3 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>💬</span>
              <span>General & Santai</span>
            </p>
            {generalChannels.map((ch) => {
              const isActive = activeChannel.id === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleSelectChannel(ch)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-sm shrink-0">{ch.icon}</span>
                    <span className="truncate">{ch.name}</span>
                  </div>
                  {!!ch.unreadCount && ch.unreadCount > 0 && !isActive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500 text-white shrink-0 shadow-xs">
                      {ch.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── MAIN CHAT CANVAS ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#09090b] relative">
        {/* Active Channel Header */}
        <header className="px-4 py-3 sm:px-6 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-3 shrink-0 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-lg font-bold shrink-0 shadow-xs">
              {activeChannel.icon}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-2">
                <span>{activeChannel.name}</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                  ● Live Channel
                </span>
              </h1>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {activeChannel.description}
              </p>
            </div>
          </div>

          {/* Desktop Right Member Toggle Button */}
          <button
            onClick={() => setShowMemberSidebar((p) => !p)}
            className={`hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border text-xs font-bold transition-all active:scale-95 shadow-xs ${
              showMemberSidebar
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400'
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-purple-600'
            }`}
            title="Tampilkan / Sembunyikan Daftar Anggota"
          >
            <span>👥</span>
            <span>{totalOnline} Online</span>
            <span className="text-[10px] text-zinc-400">({totalOnline + totalOffline} Total)</span>
          </button>
        </header>

        {/* Message Stream Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full text-xs text-zinc-400 gap-2">
              <span className="animate-spin text-purple-500">⏳</span>
              <span>Memuat percakapan...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12">
              <span className="text-5xl p-5 rounded-3xl bg-purple-500/10 shadow-inner">
                {activeChannel.icon}
              </span>
              <p className="text-base font-black text-zinc-900 dark:text-zinc-100">
                Selamat Datang di {activeChannel.name}!
              </p>
              <p className="text-xs text-zinc-400 max-w-sm">
                Belum ada pesan di saluran ini. Mulai percakapan, bagikan ide, stiker lucu, emotikon, atau sapa anggota tim Anda!
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isSelf = msg.user_id === currentUserId;
              const isPrevSameUser =
                index > 0 && messages[index - 1].user_id === msg.user_id;
              const isHighlighted = highlightedMessageId === msg.id;
              const sticker = parseSticker(msg.message);

              return (
                <div
                  key={msg.id}
                  ref={(el) => { messageRefs.current[msg.id] = el; }}
                  className={`flex gap-3 group transition-all duration-300 rounded-2xl p-1.5 ${
                    isHighlighted ? 'bg-purple-500/15 ring-2 ring-purple-500/40' : ''
                  } ${isPrevSameUser ? 'mt-0.5' : 'mt-4'}`}
                >
                  {!isPrevSameUser ? (
                    <button
                      type="button"
                      onClick={() => openMemberCardFromMessage(msg)}
                      className="shrink-0 hover:opacity-80 transition-opacity mt-0.5"
                    >
                      <UserAvatar
                        src={msg.user_avatar}
                        name={msg.user_name}
                        size="md"
                        square
                      />
                    </button>
                  ) : (
                    <div className="w-9 shrink-0" />
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    {!isPrevSameUser && (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openMemberCardFromMessage(msg)}
                          className="font-black text-xs text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left"
                        >
                          {msg.user_name}
                        </button>
                        {msg.user_role_name && (
                          <span
                            className="text-[9px] font-bold px-2 py-0.2 rounded-full text-white shadow-2xs"
                            style={{
                              backgroundColor: msg.user_role_color || '#7c3aed',
                            }}
                          >
                            {msg.user_role_name}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}

                    {/* Quoted Reply Card (If this message is replying to another message) */}
                    {msg.reply_to && (
                      <button
                        onClick={() => scrollToMessage(msg.reply_to!.id)}
                        className="w-full max-w-xl text-left p-2.5 rounded-xl border-l-4 border-purple-500 bg-purple-500/10 hover:bg-purple-500/15 transition-all text-xs mb-1.5 group/quote block"
                      >
                        <p className="font-bold text-[10px] text-purple-600 dark:text-purple-300 flex items-center gap-1">
                          <span>↩️ Membalas @{msg.reply_to.user_name}</span>
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-300 line-clamp-1 italic text-[11px] mt-0.5">
                          "{msg.reply_to.message}"
                        </p>
                      </button>
                    )}

                    {/* Message Body or Cute Sticker Card */}
                    <div className="space-y-2 relative">
                      {sticker ? (
                        /* Cute & Fresh Sticker Card */
                        <div className="inline-flex items-center gap-3 p-3 sm:p-4 rounded-3xl bg-gradient-to-tr from-purple-500/10 via-indigo-500/10 to-pink-500/10 border-2 border-purple-500/20 shadow-md backdrop-blur-md hover:scale-[1.03] transition-all">
                          <span className="text-3xl sm:text-4xl animate-bounce drop-shadow-md">{sticker.icon}</span>
                          <div>
                            <span className="text-xs font-black tracking-tight text-zinc-900 dark:text-zinc-100 block">
                              {sticker.label}
                            </span>
                            <span className="inline-block text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded-full mt-1">
                              Stiker Komunitas
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Text Bubble with Interactive Clickable @Mentions */
                        <div
                          className={`text-xs sm:text-sm leading-relaxed p-3 sm:p-3.5 rounded-2xl max-w-[90%] sm:max-w-2xl whitespace-pre-wrap break-words ${
                            isSelf
                              ? 'bg-purple-600 text-white rounded-tl-xs shadow-xs'
                              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800/80 rounded-tl-xs'
                          }`}
                        >
                          {renderMessageContent(msg.message, isSelf)}
                          {msg.attachment_url && (
                            <div className="mt-2.5 pt-2 border-t border-white/20 dark:border-zinc-800">
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs underline font-bold hover:opacity-80"
                              >
                                <span>📎 Lampiran / Reference Link</span>
                                <span>➔</span>
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Emoji Reactions & Reply Action Bar */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {msg.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => handleReaction(msg.id, r.emoji)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                              r.userReacted
                                ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-300'
                                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-purple-300'
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] font-mono">{r.count}</span>
                          </button>
                        ))}

                        {/* Reply Button Trigger */}
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/20 flex items-center gap-1 active:scale-95"
                          title="Balas Pesan Ini"
                        >
                          <span>↩️</span>
                          <span>Balas</span>
                        </button>

                        {/* Quick Reaction Emoji Picker */}
                        <div className="opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(msg.id, emoji)}
                              className="p-1 text-xs hover:scale-125 transition-transform"
                              title={`React ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                          {/* Flexible Reaction Trigger Button ➕ */}
                          <button
                            onClick={() => {
                              setReactingToMessageId(msg.id);
                              setPickerTab('emoji');
                              setShowPickerModal(true);
                            }}
                            className="p-1 text-xs hover:scale-125 transition-transform font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 rounded-full w-5 h-5 flex items-center justify-center border border-purple-500/20"
                            title="Beri Reaksi dengan Emoji Bebas (Flexible)..."
                          >
                            ➕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── MENTION AUTOCOMPLETE POPOVER DROPDOWN ── */}
        {showMentionSuggestions && mentionCandidates.length > 0 && (
          <div className="absolute bottom-20 left-4 right-4 sm:left-24 sm:max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-2.5 z-40 animate-in fade-in slide-in-from-bottom-2">
            <div className="px-3 py-1.5 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <span>⚡ Mention Anggota Komunitas</span>
              </span>
              <span className="text-[9px] font-bold text-zinc-400">Gunakan ↑↓ & Enter</span>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1">
              {mentionCandidates.map((member, idx) => {
                const isSelected = idx === selectedMentionCursor;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => insertMention(member)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-left transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 font-bold'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <UserAvatar src={member.avatar_url} name={member.name} size="xs" square />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{member.name}</p>
                        <p
                          className={`text-[9px] truncate ${
                            isSelected ? 'text-purple-100' : 'text-zinc-400'
                          }`}
                        >
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-purple-500/10 text-purple-600'
                      }`}
                    >
                      {member.role_name || 'MEMBER'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── UNIFIED EMOJI & COMMUNITY STICKER PICKER MODAL POPOVER ── */}
        {showPickerModal && (
          <div className="absolute bottom-20 left-2 right-2 sm:left-6 sm:right-auto sm:w-[350px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-3 shadow-2xl z-30 animate-in fade-in duration-150">
            {/* Top Tab Bar: [ ✨ Emoji ] [ 🎨 Stiker Komunitas ]   ✕ */}
            <div className="flex items-center justify-between p-1.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-2xl mb-3">
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPickerTab('emoji')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    pickerTab === 'emoji'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  ✨ Emoji
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('sticker')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    pickerTab === 'sticker'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  🎨 Stiker Komunitas
                </button>
              </div>

              <div className="flex items-center gap-2">
                {reactingToMessageId && (
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                    Mode Reaksi
                  </span>
                )}
                <button
                  onClick={() => {
                    setShowPickerModal(false);
                    setReactingToMessageId(null);
                  }}
                  className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 flex items-center justify-center text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* TAB CONTENT: EMOJI PICKER WITH SEARCH & CATEGORIES */}
            {pickerTab === 'emoji' ? (
              <div className="rounded-2xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  searchPlaceholder="Cari emoji..."
                  width="100%"
                  height={320}
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                />
              </div>
            ) : (
              /* TAB CONTENT: CUTE & FRESH COMMUNITY STICKERS GRID */
              <div className="grid grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto p-1">
                {STICKER_PACKS.map((stk) => (
                  <button
                    key={stk.id}
                    onClick={() => handleSendSticker(stk)}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60 hover:bg-purple-500/10 hover:border-purple-400 transition-all group active:scale-95 text-center shadow-2xs"
                  >
                    <span className="text-3xl group-hover:scale-125 transition-transform drop-shadow-xs">
                      {stk.icon}
                    </span>
                    <span className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 mt-1.5 leading-tight">
                      {stk.label}
                    </span>
                    <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full mt-1">
                      {stk.tag}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MESSAGE INPUT & REPLY FOOTER ── */}
        <footer className="p-3 sm:p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b] shrink-0">
          {/* Quote Reply Banner Active Bar */}
          {replyingTo && (
            <div className="mb-3 p-2.5 sm:p-3 bg-purple-500/10 border-l-4 border-purple-500 rounded-r-2xl flex items-center justify-between gap-2 animate-in fade-in">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <span>↩️ Membalas @{replyingTo.user_name}</span>
                </p>
                <p className="text-xs text-zinc-700 dark:text-zinc-200 truncate italic mt-0.5">
                  "{replyingTo.message}"
                </p>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs hover:bg-purple-500/30 transition-colors"
                title="Batal Membalas"
              >
                ✕
              </button>
            </div>
          )}

          {/* Attachment Link Input Field */}
          {showAttachmentInput && (
            <div className="mb-2.5 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-2 animate-in fade-in">
              <span className="text-xs">📎</span>
              <input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="Paste URL lampiran / Google Drive / Figma / Referensi..."
                className="flex-1 bg-transparent text-xs outline-none text-zinc-900 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => setShowAttachmentInput(false)}
                className="text-xs text-zinc-400 hover:text-zinc-600 px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Main Action & Text Input Row */}
          <form onSubmit={handleSendMessage} className="flex items-end gap-2">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => setShowAttachmentInput((p) => !p)}
              className={`p-2.5 rounded-2xl border transition-all text-xs shrink-0 ${
                showAttachmentInput || attachmentUrl
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-purple-600'
              }`}
              title="Sematkan Link Lampiran"
            >
              📎
            </button>

            {/* Combined Emoji & Sticker Picker Trigger Button */}
            <button
              type="button"
              onClick={() => {
                setReactingToMessageId(null);
                setPickerTab('emoji');
                setShowPickerModal((p) => !p);
              }}
              className={`p-2.5 rounded-2xl border transition-all text-xs shrink-0 ${
                showPickerModal
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-purple-600'
              }`}
              title="Buka Emoji & Stiker Komunitas"
            >
              <span className="hidden sm:inline">✨ Emoji & Stiker</span>
              <span className="sm:hidden text-xs">✨</span>
            </button>

            {/* Input Text Box with @mention listener */}
            <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus-within:border-purple-500 rounded-2xl px-3.5 py-2 flex items-center gap-2 transition-all shadow-xs">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  replyingTo
                    ? `Balas @${replyingTo.user_name}...`
                    : `Tulis pesan di #${activeChannel.name}... (Ketik @ untuk mention anggota)`
                }
                className="w-full bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none resize-none max-h-24"
              />
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={sending || (!inputMessage.trim() && !attachmentUrl.trim())}
              className="p-2.5 sm:px-4 sm:py-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-xs shadow-md shadow-purple-500/20 disabled:opacity-50 transition-all shrink-0 active:scale-95"
            >
              {sending ? '...' : 'Kirim ➔'}
            </button>
          </form>
        </footer>
      </main>

      {/* ── BACKDROP OVERLAY FOR MOBILE MEMBER SIDEBAR DRAWER ── */}
      {showMemberSidebar && (
        <div
          onClick={() => setShowMemberSidebar(false)}
          className="xl:hidden absolute inset-0 bg-black/50 z-30 backdrop-blur-xs animate-in fade-in"
        />
      )}

      {/* ── RIGHT MEMBER SIDEBAR (VIBRANT PREMIUM DISCORD GLASS STYLE) ── */}
      {showMemberSidebar && (
        <aside
          className={`xl:w-64 border-l border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl flex flex-col shrink-0 transition-all z-40 ${
            showMemberSidebar
              ? 'absolute top-0 bottom-0 right-0 w-80 max-w-[88vw] shadow-2xl flex animate-in slide-in-from-right duration-200 xl:relative xl:top-0 xl:w-64 xl:shadow-none'
              : 'hidden xl:flex'
          }`}
        >
          {/* Top Banner Gradient Header on Mobile */}
          <div className="p-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white flex items-center justify-between shadow-md shadow-purple-500/20 xl:hidden shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">👥</span>
              <span className="text-xs font-black uppercase tracking-wider">Anggota Komunitas</span>
              <span className="text-[10px] font-extrabold bg-emerald-400/30 border border-emerald-300/40 text-emerald-200 px-2 py-0.5 rounded-full">
                ● {totalOnline} Online
              </span>
            </div>
            <button
              onClick={() => setShowMemberSidebar(false)}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Member Search Bar & Status Pills */}
          <div className="p-3.5 border-b border-zinc-200/60 dark:border-zinc-800/60 space-y-2.5 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 flex items-center gap-2 shadow-inner focus-within:ring-2 focus-within:ring-purple-500/40 transition-all">
              <span className="text-xs text-zinc-400">🔍</span>
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder="Cari Anggota Komunitas..."
                className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 outline-none placeholder:text-zinc-400"
              />
              {memberSearchQuery && (
                <button
                  onClick={() => setMemberSearchQuery('')}
                  className="text-[10px] text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Online & Offline Stats Pills */}
            <div className="flex items-center justify-between px-1 text-[10px] font-bold">
              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Online — {totalOnline}</span>
              </span>
              <span className="text-zinc-500 dark:text-zinc-400 bg-zinc-500/10 border border-zinc-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                <span>Offline — {totalOffline}</span>
              </span>
            </div>
          </div>

          {/* Categorized Member Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {/* 1. ONLINE ROLE GROUPS */}
            {onlineRoleGroups.map((group) => {
              const filteredMembers = group.members.filter(
                (m) =>
                  m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                  m.email.toLowerCase().includes(memberSearchQuery.toLowerCase())
              );

              if (filteredMembers.length === 0) return null;

              return (
                <div key={group.groupName} className="space-y-2">
                  {/* Group Header Badge */}
                  <div className="px-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: group.roleColor || '#7c3aed' }}
                      />
                      <span className="truncate">{group.groupName}</span>
                    </span>
                    <span className="font-mono text-zinc-400 shrink-0 font-extrabold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                      {filteredMembers.length}
                    </span>
                  </div>

                  {/* Online Premium Glass Cards */}
                  <div className="space-y-1.5">
                    {filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSelectedMemberCard(member)}
                        className="w-full text-left p-2.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/60 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-indigo-500/10 hover:border-purple-500/30 transition-all shadow-2xs hover:shadow-md hover:scale-[1.01] flex items-center justify-between gap-2.5 active:scale-98 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <UserAvatar
                              src={member.avatar_url}
                              name={member.name}
                              size="sm"
                              square
                              className="rounded-xl shadow-2xs ring-1 ring-purple-500/20"
                            />
                            {/* Online Green Glow Dot */}
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-900 bg-emerald-500 ring-1 ring-emerald-400" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {member.name}
                            </p>
                            <p className="text-[9px] text-zinc-400 truncate">
                              {member.email}
                            </p>
                          </div>
                        </div>

                        {/* Role Tag Pill */}
                        <span
                          className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white shadow-2xs shrink-0"
                          style={{ backgroundColor: member.role_color || '#7c3aed' }}
                        >
                          {member.role_name?.slice(0, 10) || 'ROLE'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 2. OFFLINE GROUP */}
            {filteredOfflineMembers.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
                <div className="px-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 shrink-0" />
                    <span>Offline</span>
                  </span>
                  <span className="font-mono text-zinc-400 font-extrabold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                    {filteredOfflineMembers.length}
                  </span>
                </div>

                <div className="space-y-1.5 opacity-85 hover:opacity-100 transition-opacity">
                  {filteredOfflineMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedMemberCard(member)}
                      className="w-full text-left p-2.5 rounded-2xl border border-zinc-200/40 dark:border-zinc-800/40 bg-zinc-50/70 dark:bg-zinc-900/30 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-all shadow-2xs flex items-center justify-between gap-2.5 active:scale-98 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <UserAvatar
                            src={member.avatar_url}
                            name={member.name}
                            size="sm"
                            square
                            className="rounded-xl grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                          />
                          {/* Offline Gray Status Badge Dot */}
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-400" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate text-zinc-600 dark:text-zinc-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {member.name}
                          </p>
                          <p className="text-[9px] text-zinc-400/80 truncate">
                            {member.email}
                          </p>
                        </div>
                      </div>

                      {/* Soft Role Tag Pill */}
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
                        {member.role_name?.slice(0, 10) || 'OFFLINE'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── DISCORD-STYLE PROFILE HIGHLIGHT CARD MODAL POPOVER ── */}
      {selectedMemberCard && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedMemberCard(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Banner Gradient */}
            <div
              className="h-28 w-full relative p-3"
              style={{
                backgroundImage: `linear-gradient(to right, ${
                  selectedMemberCard.role_color || '#7c3aed'
                }, #6366f1, #ec4899)`,
              }}
            >
              <button
                onClick={() => setSelectedMemberCard(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center text-xs font-bold transition-colors shadow-xs"
              >
                ✕
              </button>
            </div>

            {/* Avatar Overlapping Header */}
            <div className="px-6 relative pb-6">
              <div className="-mt-12 mb-3 flex items-end justify-between">
                <div className="relative">
                  <UserAvatar
                    src={selectedMemberCard.avatar_url}
                    name={selectedMemberCard.name}
                    size="lg"
                    square
                    className="ring-4 ring-white dark:ring-zinc-900 shadow-xl rounded-2xl"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-900 ${
                      selectedMemberCard.is_online
                        ? 'bg-emerald-500 ring-2 ring-emerald-400'
                        : 'bg-zinc-400'
                    }`}
                  />
                </div>

                <span
                  className="px-3.5 py-1 rounded-full text-xs font-extrabold text-white shadow-sm"
                  style={{ backgroundColor: selectedMemberCard.role_color || '#7c3aed' }}
                >
                  {selectedMemberCard.role_name || 'Anggota Tim'}
                </span>
              </div>

              {/* Member Details */}
              <div className="space-y-1">
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>{selectedMemberCard.name}</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  {selectedMemberCard.email}
                </p>
              </div>

              {/* Activity Status Card */}
              <div className="mt-3.5 p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                  Status Kehadiran
                </p>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      selectedMemberCard.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                    }`}
                  />
                  <span
                    className={
                      selectedMemberCard.is_online
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-500'
                    }
                  >
                    {selectedMemberCard.is_online
                      ? 'Sedang Online (Aktif di Community)'
                      : 'Offline / Tidak Aktif'}
                  </span>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const name = selectedMemberCard.name.split(' ')[0];
                      setInputMessage((prev) => `@${name} ${prev}`);
                      setSelectedMemberCard(null);
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    className="px-3 py-2.5 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <span>💬</span>
                    <span>Mention @{selectedMemberCard.name.split(' ')[0]}</span>
                  </button>

                  <Link
                    href={`/dashboard/profile?userId=${selectedMemberCard.id}`}
                    onClick={() => setSelectedMemberCard(null)}
                    className="px-3 py-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all text-center active:scale-95"
                  >
                    <span>👤</span>
                    <span>Lihat Profil Lengkap</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
