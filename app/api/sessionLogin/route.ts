// app/api/sessionLogin/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

type SessionLoginBody = { idToken: string; rememberMe?: boolean };

export async function POST(req: Request) {
  try {
    const { idToken, rememberMe } = (await req.json()) as SessionLoginBody;
    if (!idToken) return NextResponse.json({ error: 'Missing ID token' }, { status: 400 });

    const auth = getAdminAuth();
    await auth.verifyIdToken(idToken, true);

    const expiresIn = (rememberMe ? 30 : 5) * 24 * 60 * 60 * 1000;
    const cookie = await auth.createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({ ok: true });
    res.cookies.set('__session', cookie, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: Math.floor(expiresIn / 1000),
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
