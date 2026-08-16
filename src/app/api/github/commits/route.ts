import { NextResponse } from 'next/server';
import { GIT_COMMIT_LOGS } from '@/lib/changelog';

export const revalidate = 60;

export async function GET() {
  try {
    const res = await fetch('https://api.github.com/repos/gretzcoder/kian-hq/commits?per_page=100', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'KIAN-HQ-App',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid GitHub response');
    }

    const commits = data.map((item: any) => {
      const fullMsg = item.commit?.message || '';
      const firstLine = fullMsg.split('\n')[0].trim();
      const rawDate = item.commit?.committer?.date || item.commit?.author?.date || '';
      const dateStr = rawDate ? new Date(rawDate).toISOString().split('T')[0] : '';

      return {
        id: item.sha,
        message: firstLine,
        date: dateStr,
      };
    });

    return NextResponse.json({
      success: true,
      commits,
      source: 'github_live',
      count: commits.length,
    });
  } catch (err: any) {
    console.warn('Fallback to local commit logs due to GitHub API error:', err.message);
    const fallbackCommits = GIT_COMMIT_LOGS.map((c) => ({
      id: c.hash,
      message: c.message,
      date: c.date,
    }));

    return NextResponse.json({
      success: true,
      commits: fallbackCommits,
      source: 'local_fallback',
      count: fallbackCommits.length,
    });
  }
}
