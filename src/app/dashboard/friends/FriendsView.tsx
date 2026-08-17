'use client';

import React, { useState, useEffect } from 'react';
import {
  getFriendsDataAction,
  respondFriendRequestAction,
  sendFriendRequestAction,
  FriendsSummary,
  FriendUser,
} from '@/modules/friends/friendActions';
import { useFloatingMessenger } from '@/modules/direct-messages/components/FloatingMessengerContext';
import UserAvatar from '@/components/ui/UserAvatar';

export function FriendsView() {
  const { openChat } = useFloatingMessenger();
  const [data, setData] = useState<FriendsSummary>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    suggestions: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'FRIENDS' | 'REQUESTS' | 'SUGGESTIONS'>('FRIENDS');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const res = await getFriendsDataAction();
      if (res.success && res.data) {
        setData(res.data);
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-zinc-900 border border-purple-500/20 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full inline-block">
            👥 Friendships & Contacts
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Daftar Teman & Kontak
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-xl leading-relaxed">
            Kelola daftar pertemanan, kirim pesan personal langsung (DM), serta temukan anggota tim & Trooper lainnya di KIAN HQ.
          </p>
        </div>

        {/* Stats Pill */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/10 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl p-4 text-center min-w-[110px]">
            <p className="text-2xl font-black text-white font-mono">{data.friends.length}</p>
            <p className="text-[10px] font-bold text-zinc-300 uppercase">Teman</p>
          </div>
          <div className="bg-white/10 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl p-4 text-center min-w-[110px]">
            <p className="text-2xl font-black text-amber-400 font-mono">{data.incomingRequests.length}</p>
            <p className="text-[10px] font-bold text-zinc-300 uppercase">Permintaan</p>
          </div>
        </div>
      </div>

      {/* Tabs & Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('FRIENDS')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all ${
              activeTab === 'FRIENDS' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-500'
            }`}
          >
            👥 Daftar Teman ({data.friends.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('REQUESTS')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all relative ${
              activeTab === 'REQUESTS' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-500'
            }`}
          >
            📩 Permintaan
            {data.incomingRequests.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-mono">
                {data.incomingRequests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SUGGESTIONS')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all ${
              activeTab === 'SUGGESTIONS' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-500'
            }`}
          >
            ✨ Cari Trooper
          </button>
        </div>

        {activeTab === 'FRIENDS' && (
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Cari nama atau email teman..."
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 w-full sm:w-64"
          />
        )}
      </div>

      {/* Tab 1: Friends List */}
      {activeTab === 'FRIENDS' && (
        <div>
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400 font-bold animate-pulse">
              Memuat daftar teman...
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="p-12 text-center bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-3">
              <span className="text-4xl opacity-50">👥</span>
              <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-300">
                Belum Ada Teman
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'Tidak ada teman yang cocok dengan kata kunci pencarian.'
                  : 'Tambahkan anggota tim atau Trooper lainnya ke daftar pertemanan Anda.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('SUGGESTIONS')}
                className="px-4 py-2 text-xs font-bold bg-purple-600 text-white rounded-xl shadow-md hover:bg-purple-500 transition-all inline-flex items-center gap-1.5"
              >
                <span>✨ Temukan Trooper</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredFriends.map((f) => (
                <div
                  key={f.id}
                  className="p-4 rounded-3xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar src={f.avatarUrl} name={f.name} size="md" square className="rounded-2xl shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{f.name}</h4>
                      <p className="text-[10px] text-zinc-400 truncate">{f.userType || 'Trooper'} • {f.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => openChat(f.id, f.name, f.avatarUrl)}
                      className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>💬</span> Chat DM
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespond(f.id, 'UNFRIEND')}
                      title="Hapus Pertemanan"
                      className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-500 rounded-xl text-xs transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Incoming & Outgoing Requests */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-6">
          {/* Incoming Requests */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <span>📩 Permintaan Pertemanan Masuk</span>
              <span className="text-xs font-mono bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full">
                {data.incomingRequests.length}
              </span>
            </h3>

            {data.incomingRequests.length === 0 ? (
              <p className="text-xs text-zinc-400 p-4 bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                Tidak ada permintaan pertemanan yang pending.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {data.incomingRequests.map((req) => (
                  <div key={req.id} className="p-4 rounded-3xl bg-white dark:bg-[#09090b] border border-amber-500/20 shadow-sm space-y-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={req.avatarUrl} name={req.name} size="md" square className="rounded-2xl shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{req.name}</h4>
                        <p className="text-[10px] text-zinc-400 truncate">{req.email}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleRespond(req.id, 'ACCEPT')}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                      >
                        ✓ Terima
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespond(req.id, 'REJECT')}
                        className="flex-1 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-500 font-bold text-xs rounded-xl transition-all"
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
            <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <span>📤 Permintaan Terkirim</span>
              <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                {data.outgoingRequests.length}
              </span>
            </h3>

            {data.outgoingRequests.length === 0 ? (
              <p className="text-xs text-zinc-400 p-4 bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                Belum ada permintaan pertemanan yang Anda kirimkan.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {data.outgoingRequests.map((req) => (
                  <div key={req.id} className="p-4 rounded-3xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar src={req.avatarUrl} name={req.name} size="sm" square className="rounded-xl shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{req.name}</h4>
                        <p className="text-[9px] text-zinc-400 truncate">Menunggu konfirmasi...</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRespond(req.id, 'CANCEL')}
                      className="px-2.5 py-1 text-[10px] font-bold text-rose-500 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 transition-all shrink-0"
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

      {/* Tab 3: Suggestions */}
      {activeTab === 'SUGGESTIONS' && (
        <div className="space-y-4">
          <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            ✨ Rekomendasi Trooper & Anggota Tim
          </h3>

          {data.suggestions.length === 0 ? (
            <p className="text-xs text-zinc-400 p-4 bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              Semua user aktif sudah berada di dalam daftar pertemanan Anda.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {data.suggestions.map((u) => (
                <div key={u.id} className="p-4 rounded-3xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar src={u.avatarUrl} name={u.name} size="md" square className="rounded-2xl shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{u.name}</h4>
                      <p className="text-[10px] text-zinc-400 truncate">{u.userType || 'Trooper'} • {u.email}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendRequest(u.id)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                  >
                    + Teman
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
