import { NextResponse } from 'next/server';
import { getKV } from '@/db/client';

export async function GET(request: Request) {
  const kv = await getKV();

  // 1. Read cookies to find session_id
  const cookiesHeader = request.headers.get('cookie') || '';
  const parsedCookies = Object.fromEntries(
    cookiesHeader.split(';').map((c) => c.trim().split('='))
  );
  const sessionId = parsedCookies['session_id'];

  // 2. Delete session from KV if it exists
  if (sessionId) {
    try {
      await kv.delete(`session:${sessionId}`);
    } catch (error) {
      console.error('Failed to delete session from KV:', error);
    }
  }

  // 3. Construct response redirecting to home/login page
  const appUrl = request.headers.get('origin') || new URL(request.url).origin;
  const response = NextResponse.redirect(new URL('/', appUrl));

  // 4. Delete the session cookie
  response.cookies.delete('session_id');

  return response;
}
export const dynamic = 'force-dynamic';
