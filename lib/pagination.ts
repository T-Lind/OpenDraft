export type Cursor = { value: number | string; id: string; rank?: number };
export function readCursor(value: string | null): Cursor | null {
  if (!value) return null;
  try {
    if (value.length > 600) throw new Error();
    const bytes = Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), char=>char.charCodeAt(0));
    const cursor = JSON.parse(new TextDecoder().decode(bytes));
    if (!cursor || !['number','string'].includes(typeof cursor.value) || typeof cursor.id !== 'string' || cursor.id.length > 200 || (typeof cursor.value === 'number' && !Number.isFinite(cursor.value)) || (cursor.rank !== undefined && !Number.isFinite(cursor.rank))) throw new Error();
    return cursor;
  } catch { throw Object.assign(new Error('This page cursor is invalid. Refresh the list.'),{status:400}); }
}
export function cursorFor(value: number|string,id:string,rank?:number): string { const bytes=new TextEncoder().encode(JSON.stringify({value,id,rank})); return btoa(Array.from(bytes,n=>String.fromCharCode(n)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }
export function limitFor(params: URLSearchParams, fallback = 20, maximum = 50): number {
  const size = Number(params.get('limit') || fallback);
  return Number.isFinite(size) ? Math.max(1,Math.min(maximum,Math.floor(size))) : fallback;
}
export function pageOf<T extends Record<string,unknown>>(rows:T[],limit:number,value:(row:T)=>number|string=(row)=>Number(row.created_at),id:(row:T)=>string=(row)=>String(row.id)) {
  const items=rows.slice(0,limit); const last=items.at(-1);
  return {items,nextCursor:rows.length>limit&&last?cursorFor(value(last),id(last)):null};
}
