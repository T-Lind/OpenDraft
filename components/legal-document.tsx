import Link from 'next/link';
import type {ReactNode} from 'react';
export function LegalDocument({title,children}:{title:string;children:ReactNode}){
 return <main className="rights-page sheet"><Link className="text-link" href="/">← Back to OpenDraft</Link><h1>{title}</h1><p className="fine-print">Effective October 3, 2026 · Operator: Tiernan Lindauer, an individual in Texas, United States.</p>{children}<nav className="legal-links" aria-label="Policies"><Link href="/rights">Writer rights</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact &amp; copyright complaints</Link></nav></main>;
}
