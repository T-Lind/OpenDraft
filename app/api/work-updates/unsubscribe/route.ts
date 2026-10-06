import {database} from '@/db/storage';
import {verifyUnsubscribeToken,unsubscribeWorkEmail} from '@/lib/work-updates';
export const dynamic='force-dynamic';
const html=(text:string,status=200)=>new Response(text,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",'Referrer-Policy':'no-referrer'}});
export async function GET(request:Request){try{
 const token=new URL(request.url).searchParams.get('token')||'';await verifyUnsubscribeToken(token);
 return html('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email updates | OpenDraft</title></head><body style="font:18px system-ui;max-width:600px;margin:60px auto;padding:20px"><h1>Turn off email updates for this work?</h1><p>Your feed updates and reading preferences will stay the same.</p><form method="post"><button type="submit">Turn off email updates</button></form></body></html>');
 }catch{return html('<h1>This link is invalid or expired.</h1><p>Sign in and turn off email updates on the work page.</p>',400);}}
export async function POST(request:Request){try{
 await unsubscribeWorkEmail(database(),new URL(request.url).searchParams.get('token')||'');return html('<h1>Email updates are off for this work.</h1><p>You can turn them on again from its reading options.</p>');
 }catch{return html('<h1>This link is invalid or expired.</h1><p>Sign in and turn off email updates on the work page.</p>',400);}}
