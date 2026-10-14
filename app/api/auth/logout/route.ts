import { destroySession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Logout changes state, so it is POST-only with a same-origin check. A cross-site
// top-level GET navigation must not be able to end a member's session.
export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  await destroySession();
  const response = new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  // Clear the local preview's mock-auth cookie too, so sign-out actually sticks
  // during development. This cookie does not exist in production.
  response.headers.append('Set-Cookie', '__sites_local_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  return response;
}
