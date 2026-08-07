export interface SmartLinkMeta {
  url: string;
  platform: string;
  title: string;
  domain: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

/**
 * Extracts and categorizes external collaboration URLs (Drive, Figma, Canva, Loom, YouTube, Notion, GitHub, etc.)
 */
export function extractSmartLinks(text: string): SmartLinkMeta[] {
  if (!text) return [];

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];
  const uniqueUrls = Array.from(new Set(matches));

  return uniqueUrls.map((url) => parseSmartLink(url));
}

export function parseSmartLink(rawUrl: string): SmartLinkMeta {
  let url = rawUrl.trim();
  // Strip trailing punctuation like closing parenthesis or period if pasted in text
  url = url.replace(/[.,;)]+$/, '');

  let domain = '';
  try {
    const parsed = new URL(url);
    domain = parsed.hostname.replace(/^www\./, '');
  } catch {
    domain = 'external';
  }

  const d = domain.toLowerCase();

  if (d.includes('figma.com')) {
    const titleMatch = url.match(/\/file\/[^/]+\/([^/?]+)/i) || url.match(/\/design\/[^/]+\/([^/?]+)/i);
    const title = titleMatch ? decodeURIComponent(titleMatch[1]).replace(/[-_]/g, ' ') : 'Figma Design File';
    return {
      url,
      platform: 'Figma',
      title,
      domain: 'figma.com',
      icon: '🎨',
      badgeBg: 'bg-red-500/10 dark:bg-red-500/20',
      badgeText: 'text-red-600 dark:text-red-400',
      borderColor: 'border-red-500/30',
    };
  }

  if (d.includes('drive.google.com') || d.includes('docs.google.com')) {
    let title = 'Google Drive Document';
    if (url.includes('/document/')) title = 'Google Docs';
    else if (url.includes('/spreadsheets/')) title = 'Google Sheets';
    else if (url.includes('/presentation/')) title = 'Google Slides';
    else if (url.includes('/folders/')) title = 'Google Drive Folder';

    return {
      url,
      platform: 'Google Drive',
      title,
      domain: 'drive.google.com',
      icon: '📁',
      badgeBg: 'bg-blue-500/10 dark:bg-blue-500/20',
      badgeText: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-500/30',
    };
  }

  if (d.includes('canva.com')) {
    return {
      url,
      platform: 'Canva',
      title: 'Canva Design Presentation',
      domain: 'canva.com',
      icon: '🖌️',
      badgeBg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
      badgeText: 'text-cyan-600 dark:text-cyan-400',
      borderColor: 'border-cyan-500/30',
    };
  }

  if (d.includes('youtube.com') || d.includes('youtu.be')) {
    return {
      url,
      platform: 'YouTube',
      title: 'YouTube Video Resource',
      domain: 'youtube.com',
      icon: '▶️',
      badgeBg: 'bg-red-600/10 dark:bg-red-600/20',
      badgeText: 'text-red-700 dark:text-red-400',
      borderColor: 'border-red-600/30',
    };
  }

  if (d.includes('loom.com')) {
    return {
      url,
      platform: 'Loom',
      title: 'Loom Video Recording',
      domain: 'loom.com',
      icon: '📹',
      badgeBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      badgeText: 'text-indigo-600 dark:text-indigo-400',
      borderColor: 'border-indigo-500/30',
    };
  }

  if (d.includes('notion.so') || d.includes('notion.site')) {
    return {
      url,
      platform: 'Notion',
      title: 'Notion Workspace Page',
      domain: 'notion.so',
      icon: '📝',
      badgeBg: 'bg-zinc-800/10 dark:bg-zinc-200/10',
      badgeText: 'text-zinc-900 dark:text-zinc-100',
      borderColor: 'border-zinc-500/30',
    };
  }

  if (d.includes('github.com')) {
    const repoMatch = url.match(/github\.com\/([^/]+\/[^/]+)/i);
    const title = repoMatch ? repoMatch[1] : 'GitHub Repository';
    return {
      url,
      platform: 'GitHub',
      title,
      domain: 'github.com',
      icon: '🐙',
      badgeBg: 'bg-slate-800/10 dark:bg-slate-200/10',
      badgeText: 'text-slate-900 dark:text-slate-100',
      borderColor: 'border-slate-500/30',
    };
  }

  if (d.includes('onedrive') || d.includes('sharepoint.com')) {
    return {
      url,
      platform: 'OneDrive',
      title: 'Microsoft OneDrive File',
      domain: 'onedrive.com',
      icon: '☁️',
      badgeBg: 'bg-sky-500/10 dark:bg-sky-500/20',
      badgeText: 'text-sky-600 dark:text-sky-400',
      borderColor: 'border-sky-500/30',
    };
  }

  if (d.includes('dropbox.com')) {
    return {
      url,
      platform: 'Dropbox',
      title: 'Dropbox File Attachment',
      domain: 'dropbox.com',
      icon: '📦',
      badgeBg: 'bg-blue-600/10 dark:bg-blue-600/20',
      badgeText: 'text-blue-700 dark:text-blue-400',
      borderColor: 'border-blue-600/30',
    };
  }

  return {
    url,
    platform: 'Link Eksternal',
    title: domain,
    domain,
    icon: '🔗',
    badgeBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    badgeText: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-500/30',
  };
}
