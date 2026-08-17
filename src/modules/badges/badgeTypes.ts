export type BadgeCategory = 'TROOPER' | 'EVENT' | 'CLIENT' | 'EPIC' | 'LEGENDARY';
export type RequirementType = 'TASK' | 'WORKSPACE' | 'NONE';

export interface BadgeOwner {
  userId: string;
  userName: string;
  userEmail: string;
  userType: string | null;
  avatarUrl: string | null;
  awardedAt: number;
  awardedBy: string | null;
}

export interface RequirementItemProgress {
  id: string;
  title: string;
  type: 'TASK' | 'WORKSPACE';
  completed: boolean;
  statusText: string;
}

export interface BadgeItem {
  id: string;
  name: string;
  category: BadgeCategory;
  iconUrl: string | null;
  description: string | null;
  requirementType: RequirementType;
  requirementData: string[] | null; // Array of Task IDs or Workspace IDs
  createdBy: string;
  createdAt: number;
  isOwned: boolean;
  awardedAt: number | null;
  progressPercent: number;
  requirements: RequirementItemProgress[];
  owners: BadgeOwner[];
  totalOwners: number;
}

// ── Default Eye-Catching Category Icons ─────────────────────────────────────

export const CATEGORY_META: Record<BadgeCategory, { label: string; icon: string; bgGradient: string; textGradient: string; border: string }> = {
  TROOPER: {
    label: 'Trooper Badge',
    icon: '🛡️',
    bgGradient: 'from-blue-600/20 via-indigo-600/15 to-purple-600/10 dark:from-blue-900/40 dark:to-indigo-950/30',
    textGradient: 'from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-300',
    border: 'border-blue-500/20 dark:border-blue-500/30',
  },
  EVENT: {
    label: 'Event Badge',
    icon: '🎪',
    bgGradient: 'from-amber-500/20 via-orange-500/15 to-rose-500/10 dark:from-amber-900/40 dark:to-orange-950/30',
    textGradient: 'from-amber-600 to-orange-500 dark:from-amber-400 dark:to-orange-300',
    border: 'border-amber-500/20 dark:border-amber-500/30',
  },
  CLIENT: {
    label: 'Client Badge',
    icon: '💼',
    bgGradient: 'from-emerald-500/20 via-teal-500/15 to-cyan-500/10 dark:from-emerald-900/40 dark:to-teal-950/30',
    textGradient: 'from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300',
    border: 'border-emerald-500/20 dark:border-emerald-500/30',
  },
  EPIC: {
    label: 'Epic Badge',
    icon: '⚔️',
    bgGradient: 'from-purple-600/20 via-fuchsia-600/15 to-pink-600/10 dark:from-purple-900/40 dark:to-fuchsia-950/30',
    textGradient: 'from-purple-600 to-fuchsia-500 dark:from-purple-400 dark:to-fuchsia-300',
    border: 'border-purple-500/20 dark:border-purple-500/30',
  },
  LEGENDARY: {
    label: 'Legendary Badge',
    icon: '👑',
    bgGradient: 'from-amber-400/25 via-yellow-500/20 to-amber-600/15 dark:from-amber-900/50 dark:to-yellow-950/40',
    textGradient: 'from-amber-500 via-yellow-400 to-amber-600 dark:from-yellow-300 dark:to-amber-400',
    border: 'border-amber-400/40 dark:border-amber-400/50',
  },
};
