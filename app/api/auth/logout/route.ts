import { destroySession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  await destroySession();
  const response = new Response(null, { status: 302, headers: { Location: '/', 'Cache-Control': 'no-store' } });
  // Clear the local preview's mock-auth cookie too, so sign-out actually sticks
  // during development. This cookie does not exist in production.
  response.headers.append('Set-Cookie', '__sites_local_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  return response;
}
