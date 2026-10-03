import { createSession, consumeOAuth, googleConfigured, googleClientId, googleClientSecret, verifyGoogleToken } from '@/lib/auth';
import {resolveGoogleAccount} from '@/lib/auth-account';
import {database} from '@/db/storage';

export const dynamic = 'force-dynamic';
const redirectTo = (location: string) => new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!googleConfigured()) return redirectTo('/?auth_error=not_configured');
  const attempt = await consumeOAuth(url.searchParams.get('state') || '');
  if (!attempt) return redirectTo('/?auth_error=invalid_state');
  if (url.searchParams.has('error')) return redirectTo('/?auth_error=cancelled');
  const code = url.searchParams.get('code');
  if (!code) return redirectTo('/?auth_error=missing_code');
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(15_000),
      body: new URLSearchParams({ client_id: googleClientId(), client_secret: googleClientSecret(), code,
        grant_type: 'authorization_code', redirect_uri: attempt.redirectUri, code_verifier: attempt.verifier }),
    });
    if (!response.ok) {
      console.error('Google token exchange failed:', response.status);
      return redirectTo('/?auth_error=exchange_failed');
    }
    const data = await response.json() as { id_token?: string };
    if (!data.id_token) return redirectTo('/?auth_error=no_user');
    const verified=await verifyGoogleToken(data.id_token, attempt.nonce);
    await createSession(await resolveGoogleAccount(database(),verified));
    return redirectTo(attempt.returnTo === '/' ? '/#Dashboard' : attempt.returnTo);
  } catch {
    console.error('Google sign-in failed during token verification or session creation.');
    return redirectTo('/?auth_error=callback_failed');
  }
}
