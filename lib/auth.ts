import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, createRemoteJWKSet, base64url, type JWTVerifyGetKey } from 'jose';

export const SESSION_COOKIE = 'opendraft_session';
export const OAUTH_COOKIE = 'opendraft_oauth';
export type SessionUser = { id: string; email: string; name: string; avatarUrl?: string; issuedAt?:number };
export type OAuthAttempt = { state: string; nonce: string; verifier: string; returnTo: string; redirectUri: string };
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export function readEnv(key: string): string | undefined {
  return typeof process !== 'undefined' ? process.env?.[key] : undefined;
}
export function authSecret(): string { return readEnv('AUTH_SECRET') || readEnv('SESSION_SECRET') || ''; }
export function googleClientId(): string { return readEnv('GOOGLE_CLIENT_ID') || ''; }
export function googleClientSecret(): string { return readEnv('GOOGLE_CLIENT_SECRET') || ''; }
export function googleRedirectUri(): string { return readEnv('GOOGLE_REDIRECT_URI') || ''; }
export function googleConfigured(): boolean {
  return !!googleClientId() && !!googleClientSecret() && authSecret().length >= 32;
}
export function localPreviewAllowed(origin: string): boolean {
  return readEnv('NODE_ENV') === 'development' && !googleClientId() && !googleClientSecret()
    && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname);
}
function secretKey(): Uint8Array {
  if (authSecret().length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters.');
  return new TextEncoder().encode(authSecret());
}
function cookieOptions(secure: boolean, maxAge: number) {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge };
}
export function secureCookies(): boolean {
  return googleRedirectUri().startsWith('https:') || readEnv('NODE_ENV') === 'production';
}
export function safeReturnTo(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    if (url.origin !== 'https://app.local' || /^\/(api\/auth(?:\/|$)|signin-with-chatgpt|signout-with-chatgpt|callback)/.test(url.pathname)) return '/';
    return url.pathname + url.search + url.hash;
  } catch { return '/'; }
}
const randomToken = () => base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
export async function pkceChallenge(verifier: string): Promise<string> {
  return base64url.encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}
export async function beginOAuth(returnTo: string, redirectUri: string): Promise<OAuthAttempt> {
  const attempt = { state: randomToken(), nonce: randomToken(), verifier: randomToken(), returnTo: safeReturnTo(returnTo), redirectUri };
  const token = await new SignJWT(attempt).setProtectedHeader({ alg: 'HS256' })
    .setIssuer('opendraft').setAudience('oauth').setIssuedAt().setExpirationTime('10m').sign(secretKey());
  (await cookies()).set(OAUTH_COOKIE, token, cookieOptions(secureCookies(), 600));
  return attempt;
}
export async function consumeOAuth(state: string): Promise<OAuthAttempt | null> {
  const jar = await cookies();
  const token = jar.get(OAUTH_COOKIE)?.value;
  jar.set(OAUTH_COOKIE, '', cookieOptions(secureCookies(), 0));
  if (!state || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'], issuer: 'opendraft', audience: 'oauth' });
    if (payload.state !== state || !['nonce', 'verifier', 'returnTo', 'redirectUri'].every(k => typeof payload[k] === 'string')) return null;
    return { state, nonce: payload.nonce as string, verifier: payload.verifier as string,
      returnTo: safeReturnTo(payload.returnTo as string), redirectUri: payload.redirectUri as string };
  } catch { return null; }
}
export async function verifyGoogleToken(token: string, nonce: string, keys: JWTVerifyGetKey = googleKeys): Promise<SessionUser> {
  const { payload } = await jwtVerify(token, keys, { algorithms: ['RS256'],
    issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: googleClientId(), requiredClaims: ['sub', 'exp', 'iat', 'nonce'] });
  if (payload.nonce !== nonce || !payload.sub || payload.email_verified !== true || typeof payload.email !== 'string' || !payload.email) {
    throw new Error('Google identity could not be verified.');
  }
  if (payload.azp !== undefined && payload.azp !== googleClientId()) throw new Error('Unexpected authorized party.');
  return { id: `google_${payload.sub}`, email: payload.email,
    name: 'Writer' };
}
export async function createSession(user: SessionUser): Promise<void> {
  const issuedAt = Math.max(Math.floor(Date.now() / 1000), Math.floor(user.issuedAt || 0));
  const token = await new SignJWT({ email: user.email, name: user.name, avatarUrl: user.avatarUrl || '' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('opendraft').setAudience('session').setSubject(user.id)
    .setIssuedAt(issuedAt).setExpirationTime(issuedAt + 60 * 60 * 24 * 30).sign(secretKey());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(secureCookies(), 60 * 60 * 24 * 30));
  jar.set('__sites_local_auth', '', cookieOptions(secureCookies(), 0));
}
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  for (const name of [SESSION_COOKIE, OAUTH_COOKIE, '__sites_local_auth']) jar.set(name, '', cookieOptions(secureCookies(), 0));
}
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'], issuer: 'opendraft', audience: 'session' });
    if (!payload.sub || typeof payload.email !== 'string' || !payload.email || typeof payload.name !== 'string') return null;
    return { id: payload.sub, email: payload.email, name: payload.name, issuedAt:payload.iat,
      avatarUrl: typeof payload.avatarUrl === 'string' && payload.avatarUrl ? payload.avatarUrl : undefined };
  } catch { return null; }
}
