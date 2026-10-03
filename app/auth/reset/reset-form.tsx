'use client';
import {FormEvent,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';

export function ResetPasswordForm({token}:{token:string}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const router=useRouter();
 async function submit(event:FormEvent){event.preventDefault();setMessage('');if(password!==confirm){setMessage('The passwords do not match.');return;}setBusy(true);try{const response=await fetch('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reset',token,password})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Could not reset the password.');router.push('/#Dashboard');router.refresh();}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 return <main className="auth-page"><Link className="wordmark" href="/">Open<span>Draft</span></Link><form className="auth-card" onSubmit={submit}><p className="eyebrow">Account security</p><h1>Choose a new password</h1><p>Use at least 12 characters. A password manager can make and remember a strong one for you.</p><label className="field-label">New password<input className="input" type="password" minLength={12} maxLength={256} autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} required/></label><label className="field-label">Confirm password<input className="input" type="password" minLength={12} maxLength={256} autoComplete="new-password" value={confirm} onChange={event=>setConfirm(event.target.value)} required/></label>{message&&<p className="form-error" role="alert">{message}</p>}<button className="button primary" disabled={busy||!token}>{busy?'Saving…':'Save password'}</button><Link className="text-link" href="/">Back to OpenDraft</Link></form></main>;
}
