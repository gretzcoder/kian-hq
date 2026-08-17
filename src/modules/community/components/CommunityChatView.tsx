'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import UserAvatar from '@/components/ui/UserAvatar';
import { useUI } from '@/components/ui/UIProvider';
import {
  CommunityChannel,
  CommunityCategory,
  CommunityMessage,
  CommunityMember,
  CommunityMemberGroup,
  getCommunityChannels,
  getCommunityMessages,
  getCommunityMembers,
  sendCommunityMessage,
  toggleCommunityReaction,
  clearCommunityChannelMessages,
  clearCommunityCategoryMessages,
  createCommunityCategory,
  updateCommunityCategory,
  deleteCommunityCategory,
  reorderCommunityCategory,
  createCommunityChannel,
  updateCommunityChannel,
  deleteCommunityChannel,
  reorderCommunityChannel,
  setDefaultCommunityChannel,
} from '../communityActions';
import { getUserBadgesAction } from '@/modules/badges/badgeActions';
import { BadgeItem, CATEGORY_META } from '@/modules/badges/badgeTypes';
import { UserProfileModal } from '@/components/UserProfileModal';
import type { EmojiClickData } from 'emoji-picker-react';

// Dynamic import for emoji-picker-react to ensure smooth SSR rendering
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface CommunityChatViewProps {
  initialWorkChannels: CommunityChannel[];
  initialGeneralChannels: CommunityChannel[];
  initialCategories?: CommunityCategory[];
  initialDefaultChannelId?: string | null;
  initialChannelId?: string;
  canManageCommunity?: boolean;
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

/**
 * Checks if a string is a valid image URL or image attachment
 */
function isImageUrl(url?: string): boolean {
  if (!url) return false;
  const clean = url.trim().split('?')[0].toLowerCase();
  if (/\.(jpeg|jpg|gif|png|webp|svg|bmp|avif)$/i.test(clean)) return true;
  if (
    url.includes('drive.google.com/uc?') ||
    url.includes('images.unsplash.com') ||
    url.includes('i.imgur.com') ||
    url.includes('res.cloudinary.com') ||
    url.includes('r2.dev') ||
    url.startsWith('data:image/')
  ) {
    return true;
  }
  return false;
}

/**
 * Safely parse SQLite UTC timestamp string into JS Date object
 */
function parseUtcDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  let s = dateStr.trim();
  if (!s.endsWith('Z') && !s.includes('+') && !s.includes('Z')) {
    s = s.replace(' ', 'T') + 'Z';
  }
  return new Date(s);
}

/**
 * Format timestamp strictly in GMT+7 (Asia/Jakarta) 24-hour HH:mm format without WIB suffix
 */
function formatWibMessageTime(dateStr: string): string {
  try {
    const d = parseUtcDate(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch (e) {
    return dateStr;
  }
}

/**
 * WhatsApp / Discord style Date Separator Divider label
 */
function formatDateDivider(dateStr: string): string {
  try {
    const msgDate = parseUtcDate(dateStr);
    const now = new Date();

    const msgYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(msgDate);
    const nowYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

    const [msgY, msgM, msgD] = msgYmd.split('-').map(Number);
    const [nowY, nowM, nowD] = nowYmd.split('-').map(Number);

    const dMsg = new Date(msgY, msgM - 1, msgD);
    const dNow = new Date(nowY, nowM - 1, nowD);

    const diffMs = dNow.getTime() - dMsg.getTime();
    const diffDays = Math.round(diffMs / (1000 * 3600 * 24));

    if (diffDays === 0) return 'Hari Ini';
    if (diffDays === 1) return 'Kemarin';

    if (diffDays > 1 && diffDays < 7) {
      const dayName = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
      }).format(msgDate);
      return dayName.charAt(0).toUpperCase() + dayName.slice(1);
    }

    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(msgDate);
  } catch (e) {
    return dateStr;
  }
}

export default function CommunityChatView({
  initialWorkChannels,
  initialGeneralChannels,
  initialCategories,
  initialDefaultChannelId,
  initialChannelId,
  canManageCommunity = false,
  initialOnlineRoleGroups = [],
  initialOfflineMembers = [],
  initialTotalOnline = 0,
  initialTotalOffline = 0,
  currentUserId,
}: CommunityChatViewProps) {
  const { toast } = useUI();
  const allChannels = [...initialWorkChannels, ...initialGeneralChannels];
  const defaultChannel =
    allChannels.find((c) => c.id === initialChannelId) ||
    initialWorkChannels[0] ||
    initialGeneralChannels[0];

  const [workChannels, setWorkChannels] = useState<CommunityChannel[]>(initialWorkChannels);
  const [generalChannels, setGeneralChannels] = useState<CommunityChannel[]>(initialGeneralChannels);
  const [activeChannel, setActiveChannel] = useState<CommunityChannel>(defaultChannel);

  // Admin / Coordinator Channel & Category Management State
  const [categories, setCategories] = useState<CommunityCategory[]>(initialCategories || [
    { id: 'cat_work', name: 'KATEGORI KERJAAN', icon: '💼', sort_order: 1 },
    { id: 'cat_general', name: 'GENERAL & SANTAI', icon: '💬', sort_order: 2 },
  ]);

  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<CommunityChannel | null>(null);
  const [channelForm, setChannelForm] = useState({
    name: '',
    description: '',
    category: 'WORK',
    icon: '💬',
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CommunityCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    icon: '📁',
  });

  const refreshChannels = async () => {
    try {
      const res = await getCommunityChannels();
      setWorkChannels(res.workChannels);
      setGeneralChannels(res.generalChannels);
      if (res.categories && res.categories.length > 0) {
        setCategories(res.categories);
      }
    } catch (err) {
      console.error('Failed to refresh channels:', err);
    }
  };

  const handleSetDefaultChannel = async (channelId: string) => {
    const res = await setDefaultCommunityChannel(channelId);
    if (res.success) {
      toast('Default Chat Room berhasil diperbarui! Semua user akan otomatis masuk ke room ini.', 'success');
      await refreshChannels();
    } else {
      toast(res.error || 'Gagal mengubah Default Chat Room', 'error');
    }
  };

  const openChannelModal = (ch?: CommunityChannel, targetCat?: string) => {
    if (ch) {
      setEditingChannel(ch);
      setChannelForm({
        name: ch.name,
        description: ch.description || '',
        category: ch.category || 'WORK',
        icon: ch.icon || '💬',
      });
    } else {
      setEditingChannel(null);
      setChannelForm({
        name: '',
        description: '',
        category: targetCat || 'WORK',
        icon: '💬',
      });
    }
    setIsChannelModalOpen(true);
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelForm.name.trim()) return;

    if (editingChannel) {
      const res = await updateCommunityChannel({
        id: editingChannel.id,
        name: channelForm.name,
        description: channelForm.description,
        category: channelForm.category,
        icon: channelForm.icon,
      });
      if (res.success) {
        toast('Saluran chat berhasil diperbarui!', 'success');
        setIsChannelModalOpen(false);
        await refreshChannels();
      } else {
        toast(res.error || 'Gagal mengedit saluran', 'error');
      }
    } else {
      const res = await createCommunityChannel({
        name: channelForm.name,
        description: channelForm.description,
        category: channelForm.category,
        icon: channelForm.icon,
      });
      if (res.success) {
        toast('Saluran chat baru berhasil dibuat!', 'success');
        setIsChannelModalOpen(false);
        await refreshChannels();
      } else {
        toast(res.error || 'Gagal membuat saluran', 'error');
      }
    }
  };

  const handleDeleteChannel = async (ch: CommunityChannel) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus saluran "${ch.name}" beserta seluruh obrolannya?`)) return;
    const res = await deleteCommunityChannel(ch.id);
    if (res.success) {
      toast(`Saluran "${ch.name}" berhasil dihapus.`, 'success');
      await refreshChannels();
    } else {
      toast(res.error || 'Gagal menghapus saluran', 'error');
    }
  };

  const handleReorderChannel = async (channelId: string, direction: 'UP' | 'DOWN') => {
    const res = await reorderCommunityChannel(channelId, direction);
    if (res.success) {
      await refreshChannels();
    } else {
      toast(res.error || 'Gagal mengurutkan saluran', 'error');
    }
  };

  const openCategoryModal = (cat?: CommunityCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryForm({ name: cat.name, icon: cat.icon || '📁' });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', icon: '📁' });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    if (editingCategory) {
      const res = await updateCommunityCategory({
        id: editingCategory.id,
        name: categoryForm.name,
        icon: categoryForm.icon,
      });
      if (res.success) {
        toast('Kategori berhasil diperbarui!', 'success');
        setIsCategoryModalOpen(false);
        await refreshChannels();
      } else {
        toast(res.error || 'Gagal mengedit kategori', 'error');
      }
    } else {
      const res = await createCommunityCategory({
        name: categoryForm.name,
        icon: categoryForm.icon,
      });
      if (res.success) {
        toast('Kategori baru berhasil dibuat!', 'success');
        setIsCategoryModalOpen(false);
        await refreshChannels();
      } else {
        toast(res.error || 'Gagal membuat kategori', 'error');
      }
    }
  };

  const handleDeleteCategory = async (cat: CommunityCategory) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus kategori "${cat.name}"?`)) return;
    const res = await deleteCommunityCategory(cat.id);
    if (res.success) {
      toast('Kategori berhasil dihapus.', 'success');
      await refreshChannels();
    } else {
      toast(res.error || 'Gagal menghapus kategori', 'error');
    }
  };

  const handleReorderCategory = async (categoryId: string, direction: 'UP' | 'DOWN') => {
    const res = await reorderCommunityCategory(categoryId, direction);
    if (res.success) {
      await refreshChannels();
    } else {
      toast(res.error || 'Gagal mengurutkan kategori', 'error');
    }
  };

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
  const [memberBadges, setMemberBadges] = useState<BadgeItem[]>([]);
  const [loadingMemberBadges, setLoadingMemberBadges] = useState(false);

  useEffect(() => {
    if (selectedMemberCard?.id) {
      setLoadingMemberBadges(true);
      getUserBadgesAction(selectedMemberCard.id).then((b) => {
        setMemberBadges(b);
        setLoadingMemberBadges(false);
      });
    } else {
      setMemberBadges([]);
    }
  }, [selectedMemberCard?.id]);

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
  const [longPressMessageId, setLongPressMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear Chat Handlers
  const handleClearChannel = async (channelId: string) => {
    if (!confirm(`Apakah Anda yakin ingin membersihkan seluruh riwayat percakapan di saluran #${activeChannel.name}?`)) return;
    const res = await clearCommunityChannelMessages(channelId);
    if (res.success) {
      setMessages([]);
    } else {
      alert(res.error || 'Gagal membersihkan chat');
    }
  };

  const handleClearCategory = async (cat: 'WORK' | 'GENERAL') => {
    const label = cat === 'WORK' ? 'Kategori Kerjaan' : 'Kategori General & Santai';
    if (!confirm(`Apakah Anda yakin ingin membersihkan seluruh percakapan di seluruh saluran ${label}?`)) return;
    const res = await clearCommunityCategoryMessages(cat);
    if (res.success) {
      const msgs = await getCommunityMessages(activeChannel.id);
      setMessages(msgs);
    } else {
      alert(res.error || 'Gagal membersihkan chat kategori');
    }
  };

  // Long-press handlers for mobile (touch and hold to show toolbar)
  const handleTouchStart = (msgId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressMessageId(msgId);
      // Haptic feedback if supported
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const dismissLongPress = () => {
    setLongPressMessageId(null);
  };

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
    const parts = text.split(/(@[\w.-]+|(?:https?:\/\/[^\s]+))/g);

    return parts.map((part, index) => {
      // Handle @mentions
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
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-black transition-all active:scale-95 cursor-pointer bg-purple-500/15 text-purple-500 dark:text-purple-300 hover:bg-purple-500/25 hover:underline"
            title={`Klik untuk lihat profil ${matchingMember ? matchingMember.name : part}`}
          >
            <span>@</span>
            <span>{matchingMember ? matchingMember.name.split(' ')[0] : part.substring(1)}</span>
          </button>
        );
      }

      // Handle embedded HTTP/HTTPS URLs
      if (part.startsWith('http://') || part.startsWith('https://')) {
        const isImg = isImageUrl(part);
        return (
          <span key={index} className="inline-block my-1 max-w-full min-w-0">
            <a
              href={part}
              target="_blank"
              rel="noreferrer"
              className="underline font-bold text-xs hover:opacity-80 transition-opacity text-blue-500 dark:text-blue-400 break-all [overflow-wrap:anywhere]"
            >
              {part} ➔
            </a>
            {isImg && (
              <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 max-w-sm shadow-md bg-zinc-950/40 group/img relative">
                <a href={part} target="_blank" rel="noreferrer" className="block relative group/zoom">
                  <img
                    src={part}
                    alt="Pratinjau Gambar Teks"
                    className="w-full max-h-64 object-cover rounded-2xl group-hover/zoom:scale-[1.02] transition-transform duration-200"
                    onError={(e) => {
                      (e.target as HTMLElement).parentElement?.parentElement?.remove();
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/zoom:opacity-100 transition-opacity p-2.5 flex items-end justify-between">
                    <span className="text-white text-[10px] font-bold truncate">Klik gambar penuh ↗</span>
                    <span className="text-white text-xs">🔍</span>
                  </div>
                </a>
              </div>
            )}
          </span>
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
    <div className="flex-1 w-full max-w-full overflow-x-hidden flex flex-col lg:flex-row bg-white dark:bg-[#09090b] rounded-none sm:rounded-3xl border-0 sm:border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden h-[calc(100dvh-100px)] sm:h-[calc(100dvh-120px)] lg:h-[calc(100vh-140px)] min-h-0 sm:min-h-[580px] relative">
      {/* ── MOBILE TOP CHANNEL & MEMBER CONTROLLER BAR ── */}
      <div className="lg:hidden p-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-2 shrink-0 z-20 max-w-full overflow-hidden">
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
        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between flex-wrap gap-2">
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

          {canManageCommunity && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openCategoryModal()}
                className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-all cursor-pointer"
                title="Tambah Kategori Baru"
              >
                + Kat
              </button>
              <button
                type="button"
                onClick={() => openChannelModal()}
                className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                title="Tambah Saluran Chat Baru"
              >
                + Chat
              </button>
            </div>
          )}

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
            <div className="px-3 flex items-center justify-between mb-1.5 group/cat">
              <p className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                <span>💼</span>
                <span>Kategori Kerjaan</span>
              </p>
              <div className="flex items-center gap-1">
                {canManageCommunity && (
                  <button
                    type="button"
                    onClick={() => openChannelModal(undefined, 'WORK')}
                    className="text-[9px] font-bold text-purple-500 hover:text-purple-700 hover:bg-purple-500/10 px-1 py-0.5 rounded transition-all cursor-pointer"
                    title="Tambah Saluran ke Kategori Kerjaan"
                  >
                    + Saluran
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleClearCategory('WORK')}
                  className="text-[9px] font-bold text-red-500 hover:text-red-600 hover:bg-red-500/10 px-1.5 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                  title="Bersihkan seluruh chat di Kategori Kerjaan"
                >
                  <span>🧹</span>
                  <span>Bersihkan</span>
                </button>
              </div>
            </div>

            {workChannels.map((ch) => {
              const isActive = activeChannel.id === ch.id;
              return (
                <div key={ch.id} className="relative group/chan flex items-center">
                  <button
                    onClick={() => handleSelectChannel(ch)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 pr-12">
                      <span className="text-sm shrink-0">{ch.icon || '💬'}</span>
                      <span className="truncate">{ch.name}</span>
                      {Boolean(ch.is_default) && (
                        <span
                          title="Default Chat Room saat ini"
                          className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight shrink-0 ${
                            isActive ? 'bg-amber-400 text-purple-950' : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                          }`}
                        >
                          ⭐ Default
                        </span>
                      )}
                    </div>

                    {!!ch.unreadCount && ch.unreadCount > 0 && !isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500 text-white shrink-0 shadow-xs">
                        {ch.unreadCount}
                      </span>
                    )}
                  </button>

                  {canManageCommunity && (
                    <div className="absolute right-2 opacity-0 group-hover/chan:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs px-1.5 py-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSetDefaultChannel(ch.id); }}
                        title={ch.is_default ? 'Default Chat Room saat ini' : 'Jadikan Default Chat Room'}
                        className={`p-0.5 text-xs transition-transform hover:scale-110 cursor-pointer ${ch.is_default ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-400'}`}
                      >
                        {ch.is_default ? '⭐' : '☆'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleReorderChannel(ch.id, 'UP'); }}
                        title="Naikkan Saluran"
                        className="text-[10px] text-zinc-400 hover:text-purple-400 px-0.5 cursor-pointer"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleReorderChannel(ch.id, 'DOWN'); }}
                        title="Turunkan Saluran"
                        className="text-[10px] text-zinc-400 hover:text-purple-400 px-0.5 cursor-pointer"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openChannelModal(ch); }}
                        title="Edit Saluran"
                        className="text-xs text-zinc-400 hover:text-blue-400 px-0.5 cursor-pointer"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteChannel(ch); }}
                        title="Hapus Saluran"
                        className="text-xs text-zinc-400 hover:text-red-400 px-0.5 cursor-pointer"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 💬 GENERAL & SANTAI */}
          <div className="space-y-1">
            <div className="px-3 flex items-center justify-between mb-1.5 group/cat">
              <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                <span>💬</span>
                <span>General & Santai</span>
              </p>
              <div className="flex items-center gap-1">
                {canManageCommunity && (
                  <button
                    type="button"
                    onClick={() => openChannelModal(undefined, 'GENERAL')}
                    className="text-[9px] font-bold text-blue-500 hover:text-blue-700 hover:bg-blue-500/10 px-1 py-0.5 rounded transition-all cursor-pointer"
                    title="Tambah Saluran ke General & Santai"
                  >
                    + Saluran
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleClearCategory('GENERAL')}
                  className="text-[9px] font-bold text-red-500 hover:text-red-600 hover:bg-red-500/10 px-1.5 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                  title="Bersihkan seluruh chat di Kategori General & Santai"
                >
                  <span>🧹</span>
                  <span>Bersihkan</span>
                </button>
              </div>
            </div>

            {generalChannels.map((ch) => {
              const isActive = activeChannel.id === ch.id;
              return (
                <div key={ch.id} className="relative group/chan flex items-center">
                  <button
                    onClick={() => handleSelectChannel(ch)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 pr-12">
                      <span className="text-sm shrink-0">{ch.icon || '💬'}</span>
                      <span className="truncate">{ch.name}</span>
                      {Boolean(ch.is_default) && (
                        <span
                          title="Default Chat Room saat ini"
                          className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight shrink-0 ${
                            isActive ? 'bg-amber-400 text-purple-950' : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                          }`}
                        >
                          ⭐ Default
                        </span>
                      )}
                    </div>

                    {!!ch.unreadCount && ch.unreadCount > 0 && !isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500 text-white shrink-0 shadow-xs">
                        {ch.unreadCount}
                      </span>
                    )}
                  </button>

                  {canManageCommunity && (
                    <div className="absolute right-2 opacity-0 group-hover/chan:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs px-1.5 py-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSetDefaultChannel(ch.id); }}
                        title={ch.is_default ? 'Default Chat Room saat ini' : 'Set sebagai Default Chat Room'}
                        className={`p-0.5 text-xs transition-transform hover:scale-110 cursor-pointer ${ch.is_default ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-400'}`}
                      >
                        {ch.is_default ? '⭐' : '☆'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleReorderChannel(ch.id, 'UP'); }}
                        title="Naikkan Saluran"
                        className="text-[10px] text-zinc-400 hover:text-purple-400 px-0.5 cursor-pointer"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleReorderChannel(ch.id, 'DOWN'); }}
                        title="Turunkan Saluran"
                        className="text-[10px] text-zinc-400 hover:text-purple-400 px-0.5 cursor-pointer"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openChannelModal(ch); }}
                        title="Edit Saluran"
                        className="text-xs text-zinc-400 hover:text-blue-400 px-0.5 cursor-pointer"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteChannel(ch); }}
                        title="Hapus Saluran"
                        className="text-xs text-zinc-400 hover:text-red-400 px-0.5 cursor-pointer"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── MAIN CHAT CANVAS ── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-white dark:bg-[#09090b] relative">
        {/* Backdrop for long-press menu on mobile */}
        {longPressMessageId && (
          <div
            className="fixed inset-0 z-20 bg-black/10 backdrop-blur-[1px]"
            onClick={dismissLongPress}
            onTouchStart={dismissLongPress}
          />
        )}
        {/* Active Channel Header */}
        <header className="hidden lg:flex px-4 py-3 sm:px-6 border-b border-zinc-200/80 dark:border-zinc-800/80 items-center justify-between gap-3 shrink-0 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md z-10">
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

          {/* Desktop Right Member Toggle & Clear Chat Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleClearChannel(activeChannel.id)}
              className="flex items-center gap-1.5 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              title={`Bersihkan chat di saluran #${activeChannel.name}`}
            >
              <span>🧹</span>
              <span>Bersihkan Chat Saluran</span>
            </button>

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
          </div>
        </header>

        {/* Message Stream Scroll Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-6 min-w-0 max-w-full">
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

              const msgDateLabel = formatDateDivider(msg.created_at);
              const prevMsgDateLabel =
                index > 0 ? formatDateDivider(messages[index - 1].created_at) : null;
              const showDateDivider = index === 0 || msgDateLabel !== prevMsgDateLabel;
              const isHeaderRow = !isPrevSameUser || showDateDivider;

              return (
                <React.Fragment key={msg.id}>
                  {showDateDivider && (
                    <div className="flex items-center my-4 px-2 select-none">
                      <div className="flex-1 border-t border-zinc-200/80 dark:border-zinc-800/80" />
                      <span className="px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full shadow-2xs mx-3 shrink-0">
                        📅 {msgDateLabel}
                      </span>
                      <div className="flex-1 border-t border-zinc-200/80 dark:border-zinc-800/80" />
                    </div>
                  )}

                  <div
                    ref={(el) => { messageRefs.current[msg.id] = el; }}
                    onTouchStart={() => handleTouchStart(msg.id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchEnd}
                    className={`flex gap-2 sm:gap-3 group transition-colors duration-150 rounded-xl px-2 sm:px-3 py-1 max-w-full min-w-0 overflow-hidden ${
                      isHighlighted ? 'bg-purple-500/10 border-l-2 border-purple-500' : ''
                    } ${longPressMessageId === msg.id ? 'bg-zinc-100/80 dark:bg-zinc-800/60' : ''} ${
                      isHeaderRow ? 'mt-2.5 pt-0.5' : ''
                    }`}
                  >
                    {isHeaderRow ? (
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
                      <div className="w-9 shrink-0 flex items-center justify-center">
                        <span className="text-[9px] text-zinc-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity select-none">
                          {formatWibMessageTime(msg.created_at)}
                        </span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-0.5 relative overflow-hidden">
                      {isHeaderRow && (
                        <div className="flex items-baseline gap-2 flex-wrap min-w-0 max-w-full">
                          <button
                            type="button"
                            onClick={() => openMemberCardFromMessage(msg)}
                            className="font-bold text-sm hover:underline transition-colors text-left truncate max-w-[160px] sm:max-w-xs"
                            style={{ color: msg.user_role_color || '#a78bfa' }}
                          >
                            {msg.user_name}
                          </button>
                          {msg.user_role_name && (
                            <span
                              className="text-[9px] font-bold px-2 py-0.2 rounded-full text-white shadow-2xs shrink-0"
                              style={{
                                backgroundColor: msg.user_role_color || '#7c3aed',
                              }}
                            >
                              {msg.user_role_name}
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                            {formatWibMessageTime(msg.created_at)}
                          </span>
                        </div>
                      )}

                    {/* Quoted Reply Card (If this message is replying to another message) */}
                    {msg.reply_to && (
                      <button
                        onClick={() => scrollToMessage(msg.reply_to!.id)}
                        className="w-full max-w-[85%] sm:max-w-xl text-left p-1.5 sm:p-2 rounded-lg border-l-3 border-purple-500 bg-purple-500/10 hover:bg-purple-500/15 transition-all text-xs mb-0.5 group/quote block min-w-0 overflow-hidden"
                      >
                        <p className="font-bold text-[10px] text-purple-600 dark:text-purple-300 flex items-center gap-1">
                          <span>↩️ Membalas @{msg.reply_to.user_name}</span>
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-300 line-clamp-1 italic text-[11px] mt-0.5 truncate">
                          "{msg.reply_to.message}"
                        </p>
                      </button>
                    )}

                    {/* Message Body or Sticker */}
                    {sticker ? (
                      <div className="inline-flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/40 hover:scale-[1.02] transition-all max-w-full min-w-0 overflow-hidden">
                        <span className="text-3xl sm:text-4xl drop-shadow-md shrink-0">{sticker.icon}</span>
                        <div className="min-w-0">
                          <span className="text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-100 block truncate">
                            {sticker.label}
                          </span>
                          <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full mt-0.5">
                            Stiker Komunitas
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[13px] sm:text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere] break-all overflow-hidden max-w-full min-w-0">
                        {renderMessageContent(msg.message, isSelf)}
                      </div>
                    )}

                    {/* Attachment */}
                    {msg.attachment_url && (
                      <div className="mt-1 max-w-full min-w-0 overflow-hidden">
                        {isImageUrl(msg.attachment_url) ? (
                          <div className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 max-w-xs sm:max-w-sm shadow-sm bg-zinc-950/40 group/img relative">
                            <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="block relative group/zoom">
                              <img
                                src={msg.attachment_url}
                                alt="Lampiran Gambar"
                                className="w-full max-h-72 object-cover rounded-xl group-hover/zoom:scale-[1.01] transition-transform duration-200"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/zoom:opacity-100 transition-opacity p-3 flex items-end justify-between">
                                <span className="text-white text-[11px] font-bold truncate">Klik untuk gambar penuh ↗</span>
                                <span className="text-white text-xs shrink-0">🔍</span>
                              </div>
                            </a>
                          </div>
                        ) : (
                          <a
                            href={msg.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-zinc-100/80 dark:bg-zinc-800/50 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/50 text-blue-500 dark:text-blue-400 border-zinc-200/80 dark:border-zinc-700/40 max-w-full min-w-0 overflow-hidden"
                          >
                            <span className="shrink-0">📎</span>
                            <span className="truncate max-w-[140px] xs:max-w-[180px] sm:max-w-xs min-w-0">{msg.attachment_url}</span>
                            <span className="shrink-0">➔</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Inline Reaction Counts (always visible when reactions exist) */}
                    {msg.reactions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {msg.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => handleReaction(msg.id, r.emoji)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold border transition-all active:scale-95 ${
                              r.userReacted
                                ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-300'
                                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-purple-300'
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] font-mono">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* ── FLOATING ACTION TOOLBAR ── */}
                    {/* Desktop: hover | Mobile: long-press */}
                    <div className={`absolute -top-3 right-0 transition-all duration-150 ${
                      longPressMessageId === msg.id
                        ? 'opacity-100 pointer-events-auto z-30'
                        : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto z-10'
                    }`}>
                      <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-0.5">
                        {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              handleReaction(msg.id, emoji);
                              dismissLongPress();
                            }}
                            className="p-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 active:bg-zinc-200 dark:active:bg-zinc-600 rounded-md transition-colors"
                            title={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
                        <button
                          onClick={() => {
                            setReactingToMessageId(msg.id);
                            setPickerTab('emoji');
                            setShowPickerModal(true);
                            dismissLongPress();
                          }}
                          className="p-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 active:bg-zinc-200 dark:active:bg-zinc-600 rounded-md transition-colors text-zinc-500 dark:text-zinc-400"
                          title="Emoji lainnya..."
                        >
                          😊
                        </button>
                        <button
                          onClick={() => {
                            setReplyingTo(msg);
                            dismissLongPress();
                          }}
                          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:bg-zinc-200 dark:active:bg-zinc-600 rounded-md transition-colors text-zinc-500 dark:text-zinc-400"
                          title="Balas"
                        >
                          <span className="text-sm">↩️</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </React.Fragment>
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
        <footer className="p-2.5 sm:p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b] shrink-0 max-w-full overflow-hidden">
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
                placeholder="Paste URL lampiran / Google Drive / Figma / Referensi / Gambar..."
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
            <div className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus-within:border-purple-500 rounded-2xl px-3 sm:px-3.5 py-2 flex items-center gap-2 transition-all shadow-xs">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  replyingTo
                    ? `Balas @${replyingTo.user_name}...`
                    : `Tulis pesan di #${activeChannel.name}`
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
        <UserProfileModal
          user={selectedMemberCard}
          onClose={() => setSelectedMemberCard(null)}
          onMention={(firstName) => {
            setInputMessage((prev) => `@${firstName} ${prev}`);
            if (textareaRef.current) textareaRef.current.focus();
          }}
        />
      )}

      {/* Admin Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>{editingCategory ? '✏️ Edit Kategori' : '➕ Tambah Kategori Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: KATEGORI DOKUMENTASI"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Icon Emoji (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="📁"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 cursor-pointer"
                >
                  {editingCategory ? 'Simpan Perubahan' : 'Buat Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Channel Modal */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>{editingChannel ? '✏️ Edit Saluran Chat' : '💬 Tambah Saluran Chat Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsChannelModalOpen(false)}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Kategori Saluran
                </label>
                <select
                  value={channelForm.category}
                  onChange={(e) => setChannelForm({ ...channelForm, category: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:border-purple-500 font-bold"
                >
                  <option value="WORK">💼 Kategori Kerjaan (WORK)</option>
                  <option value="GENERAL">💬 General & Santai (GENERAL)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Nama Saluran
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Designer Lounge"
                  value={channelForm.name}
                  onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Icon Emoji (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="🎨"
                  value={channelForm.icon}
                  onChange={(e) => setChannelForm({ ...channelForm, icon: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Deskripsi Saluran
                </label>
                <textarea
                  rows={2}
                  placeholder="Deskripsi singkat topik obrolan di saluran ini..."
                  value={channelForm.description}
                  onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChannelModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 cursor-pointer"
                >
                  {editingChannel ? 'Simpan Perubahan' : 'Buat Saluran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
