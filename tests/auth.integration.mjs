import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

// No live credentials or Google accounts are used by these tests.
Object.assign(process.env, { NODE_ENV: 'production', AUTH_SECRET: 'test-secret-'.repeat(4),
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'https://opendraft.test/api/auth/callback' });
const jar = new Map();
globalThis.__authTest = { jar, headers: new Headers({ host: 'opendraft.test',
  'oai-authenticated-user-id': 'attacker', 'oai-authenticated-user-email': 'admin@example.com' }) };
mkdirSync('.sites-runtime/tests/auth', { recursive: true });
await build({ entryPoints: { auth: 'lib/auth.ts', login: 'app/api/auth/login/route.ts',
  callback: 'app/api/auth/callback/route.ts', logout: 'app/api/auth/logout/route.ts', legacy: 'app/chatgpt-auth.ts',passwordHash:'lib/password-auth.ts' },
  outdir: '.sites-runtime/tests/auth', outExtension: { '.js': '.mjs' }, bundle: true, format: 'esm',
  platform: 'node', packages: 'external', plugins: [{ name: 'request-cookies', setup(b) {
    b.onResolve({filter:/^@\/lib\/rate-limit$/},()=>({path:'limiter',namespace:'mock-limiter'}));
    b.onLoad({filter:/.*/,namespace:'mock-limiter'},()=>({contents:'export async function requestRateLimit(){}',loader:'js'}));
    b.onResolve({filter:/^@\/lib\/auth-account$/},()=>({path:'auth-account',namespace:'mock-auth-account'}));
    b.onLoad({filter:/.*/,namespace:'mock-auth-account'},()=>({contents:'export async function resolveGoogleAccount(_db,user){return user}',loader:'js'}));
    b.onResolve({filter:/^@\/db\/storage$/},()=>({path:'storage',namespace:'mock-storage'}));
    b.onLoad({filter:/.*/,namespace:'mock-storage'},()=>({contents:'export function database(){return {}}',loader:'js'}));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'mock-navigation' }));
    b.onLoad({ filter: /.*/, namespace: 'mock-navigation' }, () => ({ contents: 'export function redirect(url) { throw new Error(url); }', loader: 'js' }));
    b.onResolve({ filter: /^next\/headers$/ }, () => ({ path: 'headers', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `
      export async function cookies() { return {
        get(name) { return globalThis.__authTest.jar.get(name); },
        set(name, value, options) {
          if (options.maxAge === 0) globalThis.__authTest.jar.delete(name);
          else globalThis.__authTest.jar.set(name, { value, ...options });
        }
      }; }
      export async function headers() { return globalThis.__authTest.headers; }`, loader: 'js' }));
    b.onResolve({ filter: /^@\// }, args => ({ path: resolve(args.path.slice(2) + '.ts') }));
  } }] });
const auth = await import('../.sites-runtime/tests/auth/auth.mjs');
const login = await import('../.sites-runtime/tests/auth/login.mjs');
const callback = await import('../.sites-runtime/tests/auth/callback.mjs');
const logout = await import('../.sites-runtime/tests/auth/logout.mjs');
const legacy = await import('../.sites-runtime/tests/auth/legacy.mjs');
const passwordHash = await import('../.sites-runtime/tests/auth/passwordHash.mjs');
let assertions = 0;
const ok = (condition, message) => { assert.ok(condition, message); assertions++; };
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
const claims = { email: 'writer@example.com', email_verified: true, name: 'A Writer', picture: 'https://example.test/google-account-picture.png' };
async function idToken(nonce, overrides = {}) {
  return new SignJWT({ ...claims, nonce, ...overrides }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer('https://accounts.google.com').setAudience('test-client').setSubject('stable-google-id')
    .setIssuedAt().setExpirationTime('5m').sign(privateKey);
}
const request = path => new Request('https://opendraft.test' + path);
let exchangeCount = 0;
let tokenForExchange = '';
let submitted;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url) === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json({ keys: [jwk] });
  assert.equal(String(url), 'https://oauth2.googleapis.com/token');
  exchangeCount++;
  submitted = new URLSearchParams(options.body);
  return Response.json({ id_token: tokenForExchange });
};
try {
  const firstHash=await passwordHash.hashPassword('a long unique passphrase');
  const secondHash=await passwordHash.hashPassword('a long unique passphrase');
  ok(firstHash!==secondHash,'password hashes use unique salts');
  ok(await passwordHash.verifyPassword('a long unique passphrase',firstHash),'password hash verifies the original password');
  ok(!await passwordHash.verifyPassword('the wrong passphrase',firstHash),'password hash rejects a different password');
  for (const path of ['//evil.test', '/\\evil.test', '/api/auth/login', '/api/auth/logout', '/signin-with-chatgpt', '/\n/evil.test']) {
    ok(auth.safeReturnTo(path) === '/', 'unsafe return path rejected');
  }
  ok(auth.safeReturnTo('/#read/story') === '/#read/story', 'deep link preserved');
  ok(await legacy.getChatGPTUser() === null, 'caller-supplied production identity headers rejected');
  const canonical = await login.GET(new Request('http://localhost:5173/api/auth/login'));
  ok(canonical.headers.get('Location') === 'https://opendraft.test/api/auth/login?return_to=%2F' && !jar.has(auth.OAUTH_COOKIE), 'login canonicalizes hostname before setting cookies');
  let response = await callback.GET(request('/api/auth/callback?code=attack&state=unknown'));
  ok(response.headers.get('Location') === '/?auth_error=invalid_state' && exchangeCount === 0, 'unsolicited callback rejected before exchange');
  response = await login.GET(request('/api/auth/login?return_to=' + encodeURIComponent('/#Your profile')));
  const authorize = new URL(response.headers.get('Location'));
  const attemptCookie = jar.get(auth.OAUTH_COOKIE);
  ok(authorize.origin === 'https://accounts.google.com' && authorize.searchParams.get('client_id') === 'test-client', 'login redirects to Google');
  ok(attemptCookie.httpOnly && attemptCookie.secure && attemptCookie.sameSite === 'lax', 'OAuth cookie protected');
  ok(authorize.searchParams.get('code_challenge_method') === 'S256' && !!authorize.searchParams.get('nonce'), 'PKCE and nonce sent');
  response = await callback.GET(request('/api/auth/callback?code=attack&state=wrong'));
  ok(response.headers.get('Location') === '/?auth_error=invalid_state' && exchangeCount === 0, 'wrong browser state rejected');
  jar.set(auth.OAUTH_COOKIE, attemptCookie);
  tokenForExchange = await idToken(authorize.searchParams.get('nonce'));
  response = await callback.GET(request('/api/auth/callback?code=valid&state=' + authorize.searchParams.get('state')));
  ok(response.headers.get('Location') === '/#Your%20profile', 'successful callback preserves requested view');
  ok(submitted.get('redirect_uri') === process.env.GOOGLE_REDIRECT_URI, 'exchange uses original redirect URI');
  ok(await auth.pkceChallenge(submitted.get('code_verifier')) === authorize.searchParams.get('code_challenge'), 'PKCE verifier matches authorization');
  const user = await auth.getSessionUser();
  ok(user?.id === 'google_stable-google-id' && user.email === claims.email, 'verified Google identity creates session');
  ok(user.name === 'Writer' && !user.avatarUrl, 'Google real name and photo are not copied into public identity');
  ok(!jar.has(auth.OAUTH_COOKIE), 'OAuth attempt consumed');
  response = await callback.GET(request('/api/auth/callback?code=valid&state=' + authorize.searchParams.get('state')));
  ok(response.headers.get('Location') === '/?auth_error=invalid_state' && exchangeCount === 1, 'callback replay rejected');
  await assert.rejects(auth.verifyGoogleToken(await idToken('wrong'), 'expected', () => publicKey)); assertions++;
  await assert.rejects(auth.verifyGoogleToken(await idToken('nonce', { email_verified: false }), 'nonce', () => publicKey)); assertions++;
  const wrongAudience = await new SignJWT({ ...claims, nonce: 'nonce' }).setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://accounts.google.com').setAudience('another-client').setSubject('user').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  await assert.rejects(auth.verifyGoogleToken(wrongAudience, 'nonce', () => publicKey)); assertions++;
  const wrongIssuer = await new SignJWT({ ...claims, nonce: 'nonce' }).setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://attacker.test').setAudience('test-client').setSubject('user').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  await assert.rejects(auth.verifyGoogleToken(wrongIssuer, 'nonce', () => publicKey)); assertions++;
  const expiredAttempt = await new SignJWT({ state: 'expired', nonce: 'nonce', verifier: 'verifier', returnTo: '/', redirectUri: process.env.GOOGLE_REDIRECT_URI })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('opendraft').setAudience('oauth').setExpirationTime(1)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  jar.set(auth.OAUTH_COOKIE, { value: expiredAttempt });
  ok(await auth.consumeOAuth('expired') === null, 'expired attempt rejected');
  jar.set(auth.SESSION_COOKIE, { value: jar.get(auth.SESSION_COOKIE).value + 'tampered' });
  ok(await auth.getSessionUser() === null, 'tampered session rejected');
   const replacementIssuedAt = Math.floor(Date.now() / 1000) + 1;
   await auth.createSession({ ...user, issuedAt: replacementIssuedAt });
   ok((await auth.getSessionUser())?.issuedAt === replacementIssuedAt, 'replacement session honors the post-revocation validity timestamp');
  jar.set('__sites_local_auth', { value: '1' });
  await logout.GET();
  ok(jar.size === 0 && await auth.getSessionUser() === null, 'logout clears sessions and preview identity');
  response = await login.GET(request('/api/auth/login'));
  const cancelledState = new URL(response.headers.get('Location')).searchParams.get('state');
  response = await callback.GET(request('/api/auth/callback?error=access_denied&state=' + cancelledState));
  ok(response.headers.get('Location') === '/?auth_error=cancelled' && !jar.has(auth.SESSION_COOKIE), 'cancelled consent creates no session');
  response = await login.GET(request('/api/auth/login'));
  const dashboardAuthorization = new URL(response.headers.get('Location'));
  tokenForExchange = await idToken(dashboardAuthorization.searchParams.get('nonce'));
  response = await callback.GET(request('/api/auth/callback?code=valid&state=' + dashboardAuthorization.searchParams.get('state')));
  ok(response.headers.get('Location') === '/#Dashboard' && !!await auth.getSessionUser(), 'successful sign-in opens dashboard');
  delete process.env.GOOGLE_CLIENT_SECRET;
  response = await login.GET(request('/api/auth/login'));
  ok(response.headers.get('Location') === '/?auth_error=not_configured', 'production never falls back to preview identity');
  console.log(`${assertions} authentication assertions passed.`);
} finally {
  globalThis.fetch = realFetch;
  delete globalThis.__authTest;
}
