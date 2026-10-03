import { database } from '@/db/storage';
import { avatarPng } from '@/lib/avatar';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id || id.length > 100) return new Response(null, { status: 404 });
  try {
    const photo = await database().prepare('SELECT image_data FROM profile_photos WHERE user_id=?').bind(id).first<{ image_data: string }>();
    if (!photo) return new Response(null, { status: 404 });
    const png = avatarPng(photo.image_data);
    return new Response(png.buffer as ArrayBuffer, { headers: { 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=300', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch { return new Response(null, { status: 503 }); }
}
