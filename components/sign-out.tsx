'use client';
import type {ButtonHTMLAttributes,ReactNode} from 'react';

// Sign-out is a state-changing POST so a cross-site link cannot log a member out.
export function SignOutButton({children='Sign out',onClick,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{children?:ReactNode}){
 return <button {...props} type="button" onClick={async event=>{onClick?.(event);try{await fetch('/api/auth/logout',{method:'POST'});}catch{/* Clear locally even if the request failed. */}location.replace(location.origin+'/');}}>{children}</button>;
}
