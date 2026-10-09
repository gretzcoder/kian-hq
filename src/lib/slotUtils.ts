/**
 * Utilities for Direct Brief slots and category parsing
 */

export interface DirectBriefOutputSlot {
  id: string;
  name: string;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  deadline?: string | null;
  specificBrief?: string | null;
  sparksMultiplier?: number | null;
}

export function parseDirectBriefSlots(description: string | null | undefined): DirectBriefOutputSlot[] {
  if (!description || !description.includes('[DIRECT_BRIEF_CATEGORIES:')) return [];
  const match =
    description.match(/\[DIRECT_BRIEF_CATEGORIES:\s*(\[[\s\S]*?\])\s*\]/i) ||
    description.match(/\[DIRECT_BRIEF_CATEGORIES:\s*(\[[\s\S]*?\])/i) ||
    description.match(/\[DIRECT_BRIEF_CATEGORIES:\s*([\s\S]*?)\]\]/i);
  if (match && match[1]) {
    try {
      let raw = match[1]
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/<[^>]*>/g, '')
        .trim();
      if (!raw.startsWith('[')) raw = `[${raw}`;
      if (!raw.endsWith(']')) raw = `${raw}]`;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => {
          if (typeof item === 'string') {
            return {
              id: `slot_${idx + 1}`,
              name: item.trim(),
            };
          }
          return {
            id: item.id || `slot_${idx + 1}`,
            name: (item.name || '').trim(),
            assignedUserId: item.assignedUserId || null,
            assignedUserName: item.assignedUserName || null,
            deadline: item.deadline || null,
            specificBrief: item.specificBrief || null,
            sparksMultiplier:
              item.sparksMultiplier !== undefined && item.sparksMultiplier !== null
                ? Number(item.sparksMultiplier)
                : item.multiplier !== undefined && item.multiplier !== null
                ? Number(item.multiplier)
                : null,
          };
        }).filter((s) => s.name.length > 0);
      }
    } catch {}
  }
  return [];
}

export const parseSlotsFromDescription = parseDirectBriefSlots;

export function parseAssignedTrooperIds(description: string | null | undefined): string[] {
  if (!description || !description.includes('[ASSIGNED_TROOPERS:')) return [];
  const match =
    description.match(/\[ASSIGNED_TROOPERS:\s*(\[[\s\S]*?\])\s*\]/i) ||
    description.match(/\[ASSIGNED_TROOPERS:\s*([\s\S]*?)\]/i);
  if (!match || !match[1]) return [];

  const raw = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/<[^>]*>/g, ' ');

  try {
    const arrayMatch = raw.match(/\[[\s\S]*?\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map((x) => String(x).trim()).filter(Boolean);
        if (cleaned.length > 0) return cleaned;
      }
    }
  } catch {}

  // Fallback: match any usr_ tokens (e.g. usr_a1ee332af8a54bf8aee3a4123f1dc2da)
  const ids = raw.match(/usr_[a-zA-Z0-9_-]+/g) || [];
  if (ids.length > 0) {
    return Array.from(new Set(ids));
  }

  return [];
}

export function stripMetadataTags(description: string | null | undefined): string {
  if (!description) return '';
  return description
    .replace(/<p>\s*\[ASSIGNED_TROOPERS:[\s\S]*?\]\s*<\/p>/gi, '')
    .replace(/\[ASSIGNED_TROOPERS:\s*\[[\s\S]*?\]\s*\]/gi, '')
    .replace(/\[ASSIGNED_TROOPERS:[\s\S]*?\]/gi, '')
    .replace(/<p>\s*\[DIRECT_BRIEF_CATEGORIES:[\s\S]*?\]\s*<\/p>/gi, '')
    .replace(/\[DIRECT_BRIEF_CATEGORIES:\s*\[[\s\S]*?\]\s*\]/gi, '')
    .replace(/\[DIRECT_BRIEF_CATEGORIES:[\s\S]*?\]\]/gi, '')
    .replace(/\[DIRECT_BRIEF_CATEGORIES:[\s\S]*?\]/gi, '')
    .replace(/<p>\s*\[DIRECT_BRIEF\]\s*<\/p>/gi, '')
    .replace(/\[DIRECT_BRIEF\]/gi, '')
    .replace(/^\s*\]+\s*/, '')
    .replace(/\s*\]+\s*$/, '')
    .trim();
}

export function getDirectBriefCategories(description: string | null | undefined): string[] {
  return parseDirectBriefSlots(description).map((s) => s.name);
}

/**
 * Accurately resolves whether a task is DESIGN, VIDEO, or OTHER output type.
 * Checks required_outputs, task_type, and intelligent keyword patterns.
 */
export function getTaskOutputType(task: {
  task_type?: string | null;
  required_outputs?: string | null;
  title?: string | null;
  description?: string | null;
}): 'DESIGN' | 'VIDEO' | 'OTHER' {
  const req = (task.required_outputs || '').toUpperCase().trim();
  if (req === 'VIDEO') return 'VIDEO';
  if (req === 'OTHER') return 'OTHER';
  if (req === 'DESIGN') return 'DESIGN';

  const tType = (task.task_type || '').toUpperCase().trim();
  if (tType === 'VIDEO') return 'VIDEO';
  if (tType === 'OTHER') return 'OTHER';
  if (tType === 'DESIGN') return 'DESIGN';

  // Smart fallback: check keywords in title or brief description
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
  if (/video|reels|tiktok|shorts|youtube|animasi|motion|footage/i.test(text)) return 'VIDEO';
  if (/dokumen|copywriting|admin|naskah|skrip|proposal|laporan|notulensi/i.test(text)) return 'OTHER';

  return 'DESIGN';
}

