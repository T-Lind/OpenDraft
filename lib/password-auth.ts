const encoder=new TextEncoder();
const ITERATIONS=600_000;
const KEY_BYTES=32;
const bytesToBase64=(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64url');
const base64ToBytes=(value:string)=>new Uint8Array(Buffer.from(value,'base64url'));
const readEnv=(key:string)=>typeof process!=='undefined'?process.env?.[key]:undefined;

export function normalizeEmail(value:string):string{return value.trim().toLowerCase();}

export async function hashPassword(password:string):Promise<string>{
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},key,KEY_BYTES*8);
 return `pbkdf2-sha256$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password:string,stored:string):Promise<boolean>{
 try{
  const [scheme,iterationsText,saltText,expectedText]=stored.split('$');
  const iterations=Number(iterationsText);
  if(scheme!=='pbkdf2-sha256'||!Number.isInteger(iterations)||iterations<100_000||iterations>1_000_000)return false;
  const salt=base64ToBytes(saltText),expected=base64ToBytes(expectedText);
  if(salt.length<16||expected.length!==KEY_BYTES)return false;
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,expected.length*8));
  let difference=actual.length^expected.length;
  for(let i=0;i<actual.length;i++)difference|=actual[i]^(expected[i]||0);
  return difference===0;
 }catch{return false;}
}

export function newAuthToken():string{return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));}
export async function tokenHash(token:string):Promise<string>{return bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token))));}

export function emailPasswordConfigured():boolean{
 const core=!!readEnv('DATABASE_URL')&&!!readEnv('AUTH_SECRET')&&readEnv('AUTH_SECRET')!.length>=32;
 if(!core)return false;
 return readEnv('NODE_ENV')!=='production'||!!readEnv('RESEND_API_KEY')&&!!readEnv('AUTH_EMAIL_FROM');
}

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));

export async function sendAuthEmail(to:string,kind:'verify'|'reset',url:string):Promise<{devUrl?:string}>{
 const apiKey=readEnv('RESEND_API_KEY'),from=readEnv('AUTH_EMAIL_FROM');
 if(!apiKey||!from){
  if(readEnv('NODE_ENV')!=='production')return {devUrl:url};
  throw new Error('Email sign-in is not configured.');
 }
 const verify=kind==='verify';
 const title=verify?'Verify your OpenDraft email':'Reset your OpenDraft password';
 const action=verify?'Verify email':'Reset password';
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(12_000),body:JSON.stringify({from,to,subject:title,html:`<div style="font-family:system-ui,sans-serif;line-height:1.55;max-width:560px"><h1 style="font-size:24px">${title}</h1><p>${verify?'Confirm this address to finish creating your workshop account.':'Use this one-time link to choose a new password. If you did not request it, you can ignore this email.'}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 16px;background:#b64b2a;color:white;text-decoration:none;border-radius:7px">${action}</a></p><p style="color:#666;font-size:13px">This link expires soon and can be used once.</p></div>`})});
 if(!response.ok)throw new Error('The authentication email could not be sent.');
 return {};
}
