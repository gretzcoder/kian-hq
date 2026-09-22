'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserProfileSnapshot } from './availabilityTypes';

export interface ExclusionSettings {
  excludedRoles: string[];
  excludedUserIds: string[];
}

export const STORAGE_KEY_EXCLUSIONS = 'kian_availability_exclusions_v1';
export const EVENT_EXCLUSIONS_UPDATED = 'kian_availability_exclusions_changed';

export function useAvailabilityExclusions() {
  const [exclusionSettings, setExclusionSettings] = useState<ExclusionSettings>({
    excludedRoles: [],
    excludedUserIds: [],
  });

  const loadFromStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXCLUSIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.excludedRoles) || Array.isArray(parsed?.excludedUserIds)) {
          setExclusionSettings({
            excludedRoles: Array.isArray(parsed.excludedRoles) ? parsed.excludedRoles : [],
            excludedUserIds: Array.isArray(parsed.excludedUserIds) ? parsed.excludedUserIds : [],
          });
          return;
        }
      }
      setExclusionSettings({ excludedRoles: [], excludedUserIds: [] });
    } catch {
      setExclusionSettings({ excludedRoles: [], excludedUserIds: [] });
    }
  }, []);

  useEffect(() => {
    loadFromStorage();

    const handleCustomEvent = () => loadFromStorage();
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_EXCLUSIONS) {
        loadFromStorage();
      }
    };

    window.addEventListener(EVENT_EXCLUSIONS_UPDATED, handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener(EVENT_EXCLUSIONS_UPDATED, handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [loadFromStorage]);

  const saveExclusions = useCallback((newSettings: ExclusionSettings) => {
    setExclusionSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY_EXCLUSIONS, JSON.stringify(newSettings));
      window.dispatchEvent(new CustomEvent(EVENT_EXCLUSIONS_UPDATED));
    } catch (err) {
      console.error('Failed to save exclusions:', err);
    }
  }, []);

  const resetExclusions = useCallback(() => {
    const emptySettings: ExclusionSettings = { excludedRoles: [], excludedUserIds: [] };
    setExclusionSettings(emptySettings);
    try {
      localStorage.removeItem(STORAGE_KEY_EXCLUSIONS);
      window.dispatchEvent(new CustomEvent(EVENT_EXCLUSIONS_UPDATED));
    } catch (err) {
      console.error('Failed to reset exclusions:', err);
    }
  }, []);

  // Filter helper for user objects
  const filterUsers = useCallback(
    <T extends { user: UserProfileSnapshot } | UserProfileSnapshot>(items: T[]): T[] => {
      const { excludedRoles, excludedUserIds } = exclusionSettings;
      const excludedRoleSet = new Set(excludedRoles.map((r) => r.toLowerCase().trim()));
      const excludedUserSet = new Set(excludedUserIds);

      return items.filter((item) => {
        const u = 'user' in item ? (item.user as UserProfileSnapshot) : (item as UserProfileSnapshot);
        if (!u || !u.id) return true;
        if (excludedUserSet.has(u.id)) return false;
        const role = (u.roleName || 'Trooper').toLowerCase().trim();
        if (excludedRoleSet.has(role)) return false;
        return true;
      });
    },
    [exclusionSettings]
  );

  return {
    exclusionSettings,
    saveExclusions,
    resetExclusions,
    filterUsers,
    hasActiveExclusions: exclusionSettings.excludedRoles.length > 0 || exclusionSettings.excludedUserIds.length > 0,
  };
}
