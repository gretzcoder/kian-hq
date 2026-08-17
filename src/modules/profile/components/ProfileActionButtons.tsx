'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useFloatingMessenger } from '@/modules/direct-messages/components/FloatingMessengerContext';
import {
  getFriendshipStatusAction,
  sendFriendRequestAction,
  respondFriendRequestAction,
  FriendshipStatus,
} from '@/modules/friends/friendActions';

interface ProfileActionButtonsProps {
  targetUserId: string;
  targetUserName: string;
  targetUserAvatar?: string | null;
  isSelf: boolean;
  whatsappNumber?: string | null;
  normalizedWhatsapp?: string | null;
  portfolioUrl?: string | null;
}

export default function ProfileActionButtons({
  targetUserId,
  targetUserName,
  targetUserAvatar,
  isSelf,
  whatsappNumber,
  normalizedWhatsapp,
  portfolioUrl,
}: ProfileActionButtonsProps) {
  const { openChat } = useFloatingMessenger();
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('NONE');
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isSelf && targetUserId) {
      setLoadingStatus(true);
      getFriendshipStatusAction(targetUserId)
        .then((res) => {
          if (res.success) setFriendshipStatus(res.status);
        })
        .finally(() => setLoadingStatus(false));
    }
  }, [targetUserId, isSelf]);

  const handleFriendAction = async () => {
    if (actionLoading || isSelf || !targetUserId) return;
    setActionLoading(true);

    try {
      if (friendshipStatus === 'NONE') {
        setFriendshipStatus('PENDING_SENT');
        const res = await sendFriendRequestAction(targetUserId);
        if (!res.success) {
          setFriendshipStatus('NONE');
          alert(res.error || 'Gagal mengirim permintaan pertemanan');
        }
      } else if (friendshipStatus === 'PENDING_RECEIVED') {
        setFriendshipStatus('FRIENDS');
        const res = await respondFriendRequestAction(targetUserId, 'ACCEPT');
        if (!res.success) {
          setFriendshipStatus('PENDING_RECEIVED');
          alert(res.error || 'Gagal menerima pertemanan');
        }
      } else if (friendshipStatus === 'PENDING_SENT') {
        if (confirm(`Batalkan permintaan pertemanan ke ${targetUserName}?`)) {
          setFriendshipStatus('NONE');
          const res = await respondFriendRequestAction(targetUserId, 'CANCEL');
          if (!res.success) {
            setFriendshipStatus('PENDING_SENT');
          }
        }
      } else if (friendshipStatus === 'FRIENDS') {
        if (confirm(`Hapus pertemanan dengan ${targetUserName}?`)) {
          setFriendshipStatus('NONE');
          const res = await respondFriendRequestAction(targetUserId, 'UNFRIEND');
          if (!res.success) {
            setFriendshipStatus('FRIENDS');
          }
        }
      }
    } catch (err) {
      console.error('Friend action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto mt-3 sm:mt-0">
      {!isSelf && (
        <>
          {/* Personal DM Chat Button */}
          <button
            type="button"
            onClick={() => openChat(targetUserId, targetUserName, targetUserAvatar)}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-3.5 py-2 rounded-xl transition-all shadow-md shadow-purple-500/20 active:scale-95 cursor-pointer"
          >
            <span>💬</span>
            <span>Personal Chat</span>
          </button>

          {/* Add Friend / Friendship Status Button */}
          <button
            type="button"
            onClick={handleFriendAction}
            disabled={actionLoading || loadingStatus}
            className={`inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all active:scale-95 cursor-pointer disabled:opacity-60 ${
              friendshipStatus === 'FRIENDS'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                : friendshipStatus === 'PENDING_SENT'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                : friendshipStatus === 'PENDING_RECEIVED'
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <span>
              {friendshipStatus === 'FRIENDS'
                ? '✓'
                : friendshipStatus === 'PENDING_SENT'
                ? '⏳'
                : friendshipStatus === 'PENDING_RECEIVED'
                ? '📩'
                : '➕'}
            </span>
            <span>
              {friendshipStatus === 'FRIENDS'
                ? 'Teman'
                : friendshipStatus === 'PENDING_SENT'
                ? 'Menunggu'
                : friendshipStatus === 'PENDING_RECEIVED'
                ? 'Terima Pertemanan'
                : 'Tambah Teman'}
            </span>
          </button>
        </>
      )}

      {/* WhatsApp Link */}
      {whatsappNumber && normalizedWhatsapp && (
        <a
          href={`https://wa.me/${normalizedWhatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 px-3 py-2 rounded-xl transition-all shadow-xs active:scale-95"
        >
          <span>📱</span> WhatsApp
        </a>
      )}

      {/* Portfolio Link */}
      {portfolioUrl && (
        <a
          href={portfolioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 px-3 py-2 rounded-xl transition-all shadow-xs active:scale-95"
        >
          <span>🔗</span> Portfolio ↗
        </a>
      )}

      {/* For self profile: link to Friends list as shortcut */}
      {isSelf && (
        <Link
          href="/dashboard/friends"
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-2 rounded-xl transition-all shadow-xs"
        >
          <span>👥</span> Kelola Teman
        </Link>
      )}
    </div>
  );
}
