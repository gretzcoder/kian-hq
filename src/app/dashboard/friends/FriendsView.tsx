'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getFriendsDataAction,
  respondFriendRequestAction,
  sendFriendRequestAction,
  FriendsSummary,
  FriendUser,
} from '@/modules/friends/friendActions';
import { getRecentConversationsAction, ConversationItem } from '@/modules/direct-messages/dmActions';
import { useFloatingMessenger } from '@/modules/direct-messages/components/FloatingMessengerContext';
import UserAvatar from '@/components/ui/UserAvatar';

export function FriendsView() {
  const router = useRouter();
  const { openChat } = useFloatingMessenger();
  const [data, setData] = useState<FriendsSummary>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    suggestions: [],
  });
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'MESSENGER' | 'FRIENDS' | 'REQUESTS' | 'SUGGESTIONS'>('MESSENGER');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const [friendsRes, convRes] = await Promise.all([
        getFriendsDataAction(),
        getRecentConversationsAction('ALL'),
      ]);
      if (friendsRes.success && friendsRes.data) {
        setData(friendsRes.data);
      }
      if (convRes.success && convRes.conversations) {
        setConversations(convRes.conversations);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleRespond = async (userId: string, action: 'ACCEPT' | 'REJECT' | 'CANCEL' | 'UNFRIEND') => {
    await respondFriendRequestAction(userId, action);
    fetchFriends();
  };

  const handleSendRequest = async (userId: string) => {
    await sendFriendRequestAction(userId);
    fetchFriends();
  };

  const filteredFriends = data.friends.filter(
    (f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConversations = conversations.filter(
    (c) =>
      c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.partnerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-zinc-900 border border-purple-500/20 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full inline-block">
            💬 Messenger Hub & Contacts
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Messenger & Pusat Kontak
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-xl leading-relaxed">
            Kelola percakapan personal (DM), grup chat workspace, channel community, serta berteman dengan Trooper lainnya di KIAN HQ.
          </p>
        </div>

        {/* Stats Pill */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/10 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl p-4 text-center min-w-[110px]">
            <p className="text-2xl font-black text-white font-mono">{conversations.length}</p>
            <p className="text-[10px] font-bold text-zinc-300 uppercase">Chat Aktif</p>
          </div>
          <div className="bg-white/10 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl p-4 text-center min-w-[110px]">
            <p className="text-2xl font-black text-purple-400 font-mono">{data.friends.length}</p>
            <p className="text-[10px] font-bold text-zinc-300 uppercase">Teman</p>
          </div>
        </div>
      </div>

      {/* Tabs & Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold w-full sm:w-auto overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('MESSENGER')}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'MESSENGER' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-500'
            }`}
          >
            💬 Messenger Hub ({conversations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FRIENDS')}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'FRIENDS' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-500'
            }`}
          >
            👥 Daftar Teman ({data.friends.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('REQUESTS')}
            className={`px-4 py-2 rounded-xl transition-all relative whitespace-nowrap ${
              activeTab === 'REQUESTS' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-500'
            }`}
          >
            📩 Permintaan
            {data.incomingRequests.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-mono">
                {data.incomingRequests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SUGGESTIONS')}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'SUGGESTIONS' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-500'
            }`}
          >
            ✨ Cari Trooper
          </button>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Cari nama, email, pesan..."
          className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2 text-xs focus:outline-none focus:border-purple-500 w-full sm:w-64"
        />
      </div>

      {/* Tab Content 0: Messenger Hub */}
      {activeTab === 'MESSENGER' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full py-12 text-center text-xs text-zinc-400 font-bold animate-pulse">
                Memuat percakapan...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <span className="text-4xl opacity-50">💬</span>
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Belum Ada Percakapan</p>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Mulai percakapan dengan memilih teman dari tab &quot;Daftar Teman&quot; atau &quot;Cari Trooper&quot;.
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => (
                <div
                  key={c.id}
                  className="p-4 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between hover:border-purple-500/40 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar src={c.partnerAvatar} name={c.partnerName} size="md" square className="rounded-2xl shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-500 transition-colors">
                          {c.partnerName}
                        </h4>
                        <span className="text-[9px] font-mono text-zinc-400 shrink-0">
                          {new Date(c.lastMessageTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">{c.partnerEmail}</p>
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 line-clamp-2 mt-2 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                        {c.lastMessage}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                      {c.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (c.targetUrl) {
                          router.push(c.targetUrl);
                        } else {
                          openChat(c.partnerId, c.partnerName, c.partnerAvatar);
                        }
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>💬</span> Buka Chat
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Content 1: Daftar Teman */}
      {activeTab === 'FRIENDS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-12 text-center text-xs text-zinc-400 font-bold animate-pulse">
              Memuat daftar teman...
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-2">
              <span className="text-4xl opacity-50">👥</span>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Belum Ada Teman</p>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Cari anggota tim di tab &quot;Cari Trooper&quot; dan kirim permintaan pertemanan.
              </p>
            </div>
          ) : (
            filteredFriends.map((friend) => (
              <div
                key={friend.id}
                className="p-4 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between hover:border-purple-500/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar src={friend.avatarUrl} name={friend.name} size="md" square className="rounded-2xl" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{friend.name}</h4>
                    <p className="text-[10px] text-zinc-400 truncate">{friend.userType || 'Trooper'} • {friend.email}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openChat(friend.id, friend.name, friend.avatarUrl)}
                    className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    💬 Chat DM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespond(friend.id, 'UNFRIEND')}
                    title="Hapus Pertemanan"
                    className="p-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-500 text-zinc-400 rounded-xl transition-colors cursor-pointer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 2: Permintaan Pertemanan */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-6">
          {/* Incoming Requests */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Permintaan Masuk ({data.incomingRequests.length})
            </h3>
            {data.incomingRequests.length === 0 ? (
              <p className="text-xs text-zinc-400 py-3">Tidak ada permintaan pertemanan masuk.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {data.incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-white dark:bg-zinc-900 rounded-3xl border border-amber-500/30 shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar src={req.avatarUrl} name={req.name} size="md" square className="rounded-2xl" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{req.name}</h4>
                        <p className="text-[10px] text-zinc-400 truncate">{req.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRespond(req.id, 'ACCEPT')}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        ✓ Terima
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespond(req.id, 'REJECT')}
                        className="flex-1 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-xs rounded-xl hover:bg-rose-500/20 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        ✕ Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests */}
          <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Permintaan Terkirim ({data.outgoingRequests.length})
            </h3>
            {data.outgoingRequests.length === 0 ? (
              <p className="text-xs text-zinc-400 py-3">Tidak ada permintaan terkirim yang pending.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {data.outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar src={req.avatarUrl} name={req.name} size="sm" square className="rounded-xl shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{req.name}</h4>
                        <p className="text-[9px] text-zinc-400">Menunggu tanggapan...</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRespond(req.id, 'CANCEL')}
                      className="px-2.5 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl hover:bg-rose-500/20 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 3: Rekomendasi Trooper */}
      {activeTab === 'SUGGESTIONS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {data.suggestions.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-2">
              <span className="text-4xl opacity-50">✨</span>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Semua User Sudah Berteman</p>
            </div>
          ) : (
            data.suggestions.map((sug) => (
              <div
                key={sug.id}
                className="p-4 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center justify-between gap-3 hover:border-purple-500/40 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar src={sug.avatarUrl} name={sug.name} size="md" square className="rounded-2xl shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{sug.name}</h4>
                    <p className="text-[10px] text-zinc-400 truncate">{sug.userType || 'Trooper'} • {sug.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSendRequest(sug.id)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                >
                  + Teman
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
