export const MAX_AVATAR_BYTES = 300_000;

export function avatarPng(dataUrl: string): Uint8Array {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[1].length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4) throw new Error('Choose a PNG profile picture under 300 KB.');
  const bytes = Uint8Array.from(atob(match[1]), c => c.charCodeAt(0));
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || !signature.every((n, i) => bytes[i] === n) || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') throw new Error('That picture is not a valid PNG.');
  const view = new DataView(bytes.buffer);
  const width = view.getUint32(16), height = view.getUint32(20);
  if (!width || !height || width > 512 || height > 512) throw new Error('Profile pictures must be 512 pixels or smaller.');
  return bytes;
}

export async function screenAvatar(dataUrl: string): Promise<void> {
  avatarPng(dataUrl);
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) throw Object.assign(new Error('Picture uploads are unavailable until image screening is configured. Your initials will stay visible.'), { status: 503 });
  let response: Response;
  try {
    response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ requests: [{ image: { content: dataUrl.split(',')[1] }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] }] }),
    });
  } catch { throw Object.assign(new Error('Picture screening is temporarily unavailable. Please try again later.'), { status: 503 }); }
  if (!response.ok) throw Object.assign(new Error('Picture screening is temporarily unavailable. Please try again later.'), { status: 503 });
  let data: { responses?: { error?: unknown; safeSearchAnnotation?: Record<string, string> }[] };
  try { data = await response.json(); } catch { throw Object.assign(new Error('Picture screening is temporarily unavailable. Please try again later.'), { status: 503 }); }
  const result = data.responses?.[0];
  const likelihood = result?.safeSearchAnnotation;
  if (result?.error || !likelihood || !['adult', 'violence', 'racy'].every(k => ['VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'].includes(likelihood[k]))) {
    throw Object.assign(new Error('This picture could not be screened. Please choose another image.'), { status: 422 });
  }
  if (['adult', 'violence', 'racy'].some(k => ['LIKELY', 'VERY_LIKELY'].includes(likelihood[k]))) {
    throw Object.assign(new Error('This picture did not pass the content check. Choose a picture suitable for the workshop.'), { status: 422 });
  }
}
