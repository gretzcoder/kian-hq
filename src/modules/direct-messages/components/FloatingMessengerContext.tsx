'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getRecentConversationsAction } from '../dmActions';

export interface ActiveChatSession {
  partnerId: string;
  partnerName?: string;
  partnerAvatar?: string | null;
  isMinimized: boolean;
}

interface FloatingMessengerContextType {
  activeChats: ActiveChatSession[];
  focusedChatId: string | null;
  openChat: (partnerUserId: string, partnerName?: string, partnerAvatar?: string | null) => void;
  closeChat: (partnerUserId: string) => void;
  toggleMinimize: (partnerUserId: string, minimizeState?: boolean) => void;
  unreadCount: number;
  refreshUnread: () => void;
}

const FloatingMessengerContext = createContext<FloatingMessengerContextType>({
  activeChats: [],
  focusedChatId: null,
  openChat: () => {},
  closeChat: () => {},
  toggleMinimize: () => {},
  unreadCount: 0,
  refreshUnread: () => {},
});

export function FloatingMessengerProvider({ children }: { children: React.ReactNode }) {
  const [activeChats, setActiveChats] = useState<ActiveChatSession[]>([]);
  const [focusedChatId, setFocusedChatId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = async () => {
    try {
      const res = await getRecentConversationsAction('ALL');
      if (res.success && typeof res.totalUnread === 'number') {
        setUnreadCount(res.totalUnread);
      }
    } catch {}
  };

  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, 8000);
    return () => clearInterval(interval);
  }, []);

  const openChat = (partnerUserId: string, partnerName?: string, partnerAvatar?: string | null) => {
    setActiveChats((prev) => {
      const existingIndex = prev.findIndex((c) => c.partnerId === partnerUserId);
      if (existingIndex !== -1) {
        // Chat already exists, un-minimize & bring to front
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          partnerName: partnerName || updated[existingIndex].partnerName,
          partnerAvatar: partnerAvatar !== undefined ? partnerAvatar : updated[existingIndex].partnerAvatar,
          isMinimized: false,
        };
        return updated;
      }

      // Limit active floating chats to max 3 items
      let updatedList = [...prev];
      if (updatedList.length >= 3) {
        // Auto-minimize older open chats if adding a 4th
        updatedList = updatedList.map((c) => ({ ...c, isMinimized: true }));
        // If still > 3, remove the oldest minimized one
        if (updatedList.length >= 4) {
          updatedList.shift();
        }
      }

      return [
        ...updatedList,
        {
          partnerId: partnerUserId,
          partnerName,
          partnerAvatar,
          isMinimized: false,
        },
      ];
    });

    setFocusedChatId(partnerUserId);
  };

  const closeChat = (partnerUserId: string) => {
    setActiveChats((prev) => prev.filter((c) => c.partnerId !== partnerUserId));
    if (focusedChatId === partnerUserId) {
      setFocusedChatId(null);
    }
    refreshUnread();
  };

  const toggleMinimize = (partnerUserId: string, minimizeState?: boolean) => {
    setActiveChats((prev) =>
      prev.map((c) => {
        if (c.partnerId === partnerUserId) {
          const nextState = minimizeState !== undefined ? minimizeState : !c.isMinimized;
          return { ...c, isMinimized: nextState };
        }
        return c;
      })
    );
  };

  return (
    <FloatingMessengerContext.Provider
      value={{
        activeChats,
        focusedChatId,
        openChat,
        closeChat,
        toggleMinimize,
        unreadCount,
        refreshUnread,
      }}
    >
      {children}
    </FloatingMessengerContext.Provider>
  );
}

export function useFloatingMessenger() {
  return useContext(FloatingMessengerContext);
}
