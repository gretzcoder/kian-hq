'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getRecentConversationsAction } from '../dmActions';

interface FloatingMessengerContextType {
  activePartnerId: string | null;
  activePartnerName?: string;
  activePartnerAvatar?: string | null;
  openChat: (partnerUserId: string, partnerName?: string, partnerAvatar?: string | null) => void;
  closeChat: () => void;
  unreadCount: number;
  refreshUnread: () => void;
}

const FloatingMessengerContext = createContext<FloatingMessengerContextType>({
  activePartnerId: null,
  openChat: () => {},
  closeChat: () => {},
  unreadCount: 0,
  refreshUnread: () => {},
});

export function FloatingMessengerProvider({ children }: { children: React.ReactNode }) {
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [activePartnerName, setActivePartnerName] = useState<string | undefined>(undefined);
  const [activePartnerAvatar, setActivePartnerAvatar] = useState<string | null | undefined>(undefined);
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
    const interval = setInterval(refreshUnread, 8000); // 8s polling for unread badge
    return () => clearInterval(interval);
  }, []);

  const openChat = (partnerUserId: string, partnerName?: string, partnerAvatar?: string | null) => {
    setActivePartnerId(partnerUserId);
    if (partnerName) setActivePartnerName(partnerName);
    if (partnerAvatar !== undefined) setActivePartnerAvatar(partnerAvatar);
  };

  const closeChat = () => {
    setActivePartnerId(null);
    setActivePartnerName(undefined);
    setActivePartnerAvatar(undefined);
    refreshUnread();
  };

  return (
    <FloatingMessengerContext.Provider
      value={{
        activePartnerId,
        activePartnerName,
        activePartnerAvatar,
        openChat,
        closeChat,
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
