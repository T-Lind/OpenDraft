import { googleConfigured, googleClientId, googleRedirectUri, beginOAuth, pkceChallenge, safeReturnTo, localPreviewAllowed } from '@/lib/auth';
import { requestRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try{await requestRateLimit(request,'login',20,600_000);}catch(error){const e=error as Error&{status?:number;retryAfter?:number};return Response.json({error:e.status?e.message:'Sign-in is temporarily unavailable.'},{status:e.status||503,headers:{'Cache-Control':'no-store',...(e.retryAfter?{'Retry-After':String(e.retryAfter)}:{})}});}
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get('return_to'));
  if (!googleConfigured()) {
    const location = localPreviewAllowed(url.origin)
      ? `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}` : '/?auth_error=not_configured';
    return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
  }
  const redirectUri = googleRedirectUri() || `${url.origin}/api/auth/callback`;
  const callbackOrigin = new URL(redirectUri).origin;
  // Localhost and 127.0.0.1 do not share cookies. Begin on the callback host.
  if (callbackOrigin !== url.origin) {
    const canonical = new URL('/api/auth/login', callbackOrigin);
    canonical.searchParams.set('return_to', returnTo);
    return new Response(null, { status: 302, headers: { Location: canonical.toString(), 'Cache-Control': 'no-store' } });
  }
  const attempt = await beginOAuth(returnTo, redirectUri);
  const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorize.search = new URLSearchParams({ client_id: googleClientId(), redirect_uri: attempt.redirectUri,
    response_type: 'code', scope: 'openid email profile', state: attempt.state, nonce: attempt.nonce,
    code_challenge: await pkceChallenge(attempt.verifier), code_challenge_method: 'S256', prompt: 'select_account' }).toString();
  return new Response(null, { status: 302, headers: { Location: authorize.toString(), 'Cache-Control': 'no-store' } });
}
