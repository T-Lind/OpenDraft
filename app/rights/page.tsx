import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {title:'Your writing and your rights · OpenDraft',description:'Writers keep ownership of their work. The MIT software license does not apply to workshop submissions.'};

export default function RightsPage() {
  return <main className="rights-page sheet">
    <Link href="/" className="text-link">← Back to OpenDraft</Link>
    <h1>Your writing. Your rights.</h1>
    <p className="rights-lead">You keep ownership of the writing, critiques, and images you contribute. OpenDraft claims no copyright in your submissions.</p>
    <section><h2>The code is open source; your work is yours</h2><p>The MIT license covers OpenDraft’s software. It does not license your stories, poems, critiques, messages, or profile pictures to the public. Reading a work here does not grant permission to republish, sell, or train a model on it. Authors may separately choose a license for their own work.</p></section>
    <section><h2>Permission to run the workshop</h2><p>The permission OpenDraft needs is limited and nonexclusive: storing your contributions, displaying them to the audience you choose, and processing them to provide the workshop. You remain free to revise, publish, sell, or license your writing elsewhere.</p><p>OpenDraft does not use manuscript or critique text to train AI models. Optional, separately consented showcase evaluation sends a published manuscript and writer’s request through Vercel AI Gateway to TypeSafe AI; it is disabled by default and does not change ownership or public reviewer ratings. Profile pictures go through Google Cloud Vision SafeSearch before appearing; this screening is separate from your writing.</p></section>
    <section><h2>Choose what you share</h2><p>Private drafts are available only to their author. Publishing makes a work available to workshop members for reading and critique. Choose public or private critiques before publishing. Shared writing can be copied by a reader; access controls cannot guarantee that another person will respect your rights.</p><p>Withdrawn work disappears from other members’ reading lists. Withdrawal preserves your work and received feedback for you; it is not account deletion. You can export your writing and workshop data from Your account.</p></section>
    <section><h2>Copyright notices</h2><p>In the United States, copyright generally begins when original writing is fixed in a tangible form. A notice is optional. If you want one, use your chosen rights holder and the appropriate first-publication year, for example: © 2026 Your Name. A copyright notice is not a substitute for registration or permission when using someone else’s work.</p><p><a className="text-link" href="https://www.copyright.gov/help/faq/faq-general.html">U.S. Copyright Office guidance ↗</a></p></section>
    <section><h2>Respect other writers</h2><p>Share work you own or have permission to share. Quote only what is appropriate for a critique, credit the author, and ask before reusing another writer’s work. Use Report on a work to raise a concern with the workshop operator.</p></section>
    <p className="fine-print">Operator: Tiernan Lindauer, an individual in Texas, United States. Read the <a className="text-link" href="/terms">terms</a> and <a className="text-link" href="/privacy">privacy policy</a>, or submit a private <a className="text-link" href="/contact">contact / copyright request</a>.</p>
  </main>;
}
