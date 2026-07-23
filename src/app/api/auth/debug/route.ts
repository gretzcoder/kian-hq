import { cookies } from 'next/headers';
import { getDB, getKV } from '@/db/client';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => ({ name: c.name, value: c.value }));
    const sessionId = cookieStore.get('session_id')?.value || null;

    const db = await getDB();
    const userCountResult = await db.prepare('SELECT COUNT(*) as count FROM users').first() as { count: number };

    const kv = await getKV();
    let sessionData = null;
    if (sessionId) {
      const val = await kv.get(`session:${sessionId}`);
      sessionData = val ? JSON.parse(val) : 'NOT_FOUND_IN_KV';
    }

    return NextResponse.json({
      success: true,
      cookies: allCookies,
      sessionId,
      sessionDataInKV: sessionData,
      d1UserCount: userCountResult.count,
      env: process.env.NODE_ENV,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || String(error),
      stack: error.stack,
    });
  }
}

export const dynamic = 'force-dynamic';
