'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Feather, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { genres } from './data';
import type { Act, Snapshot } from './workshop';
import { AvatarUpload } from '@/components/avatar-upload';

export function Onboarding({ user, act, busy, error, onComplete }: {
  user: NonNullable<Snapshot['user']>; act: Act; busy: boolean; error: string; onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [acceptedTerms,setAcceptedTerms]=useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState(user.bio || '');
  const [location, setLocation] = useState(user.location || '');
  const [interests, setInterests] = useState(user.interests || '');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const titles = ['What should we call you?', 'What do you love to write?', 'Your next draft starts here.'];
  const toggleGenre = (genre: string) => setSelectedGenres(current => current.includes(genre)
    ? current.filter(g => g !== genre) : current.length < 5 ? [...current, genre] : current);
  async function finish() {
    const saved = await act({ action: 'completeOnboarding', acceptedTerms, termsVersion:'2026-10-03', name: name.trim(), bio, location,
      age: user.age ?? '', sex: user.sex || '', interests: [interests.trim(), ...selectedGenres].filter(Boolean).join(', ') }, 'Welcome to OpenDraft. Your profile is ready.');
    if (saved) onComplete();
  }
  return <main className="onboarding-shell">
    <header className="onboarding-top"><span className="app-brand">Open<em>Draft</em><b>.</b></span><a href="/api/auth/logout">Sign out</a></header>
    <section className="onboarding-card" aria-labelledby="onboarding-title">
      <ol className="onboarding-progress" aria-label="Profile setup progress">
        {['Your name', 'Your writing', 'Welcome'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={index <= step ? 'active' : ''}>
          <span>{index < step ? <Check size={14} /> : index + 1}</span>{label}
        </li>)}
      </ol>
      <p className="eyebrow">MAKE YOURSELF AT HOME · STEP {step + 1} OF 3</p>
      <h1 id="onboarding-title">{titles[step]}</h1>
      <form onSubmit={e => { e.preventDefault(); if (step < 2) setStep(step + 1); else void finish(); }}>
        {step === 0 && <div className="onboarding-fields">
          <p>You’re signed in. Let’s introduce you to the workshop.</p>
          <label htmlFor="welcome-name">Pen name</label>
          <Input id="welcome-name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={60} autoComplete="nickname" />
          <p className="fine-print">Choose the name you want other writers to see. We don’t use your Google name automatically. You can use your real name if you choose.</p>
          <AvatarUpload user={{ ...user, name: name || 'Writer' }} act={act} busy={busy} />
          <label htmlFor="welcome-bio">A little about you <span className="fine-print">(optional)</span></label>
          <Textarea id="welcome-bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={1000} rows={3} placeholder="What brings you to the writing table?" />
          <label htmlFor="welcome-location">Location <span className="fine-print">(optional)</span></label>
          <Input id="welcome-location" value={location} onChange={e => setLocation(e.target.value)} maxLength={80} placeholder="A city, a country, or somewhere imaginary" />
          <p className="fine-print">Your introduction and location are public on your writer profile. Leave them blank if you prefer.</p>
        </div>}
        {step === 1 && <div className="onboarding-fields">
          <p>Pick up to five genres you enjoy writing or reading. Everything here is optional.</p>
          <div className="onboarding-genres" role="group" aria-label="Writing genres">
            {genres.slice(1).map(genre => <button key={genre} type="button" aria-pressed={selectedGenres.includes(genre)} onClick={() => toggleGenre(genre)}>{genre}</button>)}
          </div>
          <label htmlFor="welcome-interests">Other writing interests <span className="fine-print">(optional)</span></label>
          <Textarea id="welcome-interests" value={interests} onChange={e => setInterests(e.target.value)} maxLength={200} rows={3} placeholder="Character-driven stories, nature poetry, building new worlds…" />
          <p className="fine-print">These interests are shared on your profile. You can edit them in Your account.</p>
        </div>}
        {step === 2 && <div className="onboarding-fields">
          <div className="onboarding-welcome"><Feather size={26} /><p>Welcome, <strong>{name.trim()}</strong>. You have <strong>{user.credits} free credits</strong> to get started.</p></div>
          <p>Save a private draft, explore the reading room, or give another writer thoughtful feedback. Your writing stays private until you publish it.</p>
          <p className="fine-print">Five credits publish a piece for two reviewers. A 175-word reading-room critique earns one credit, with more for extra feedback. Credits are earned, never sold.</p>
        </div>}
        {step===2&&<label className="settings-check"><input type="checkbox" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)}/>I am at least 13, meet local age requirements, and have parent or guardian permission if under 18. I agree to the <a href="/terms" target="_blank" rel="noreferrer">terms</a> and have read the <a href="/privacy" target="_blank" rel="noreferrer">privacy policy</a>.</label>}
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        <div className="onboarding-actions">
          {step > 0 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={15} />Back</Button>}
          <Button type="submit" className="primary-button" disabled={busy || name.trim().length < 2 || (step===2&&!acceptedTerms)}>
            {busy ? <><LoaderCircle size={15} className="animate-spin" />Saving your profile…</> : step === 2 ? <>Go to my dashboard<ArrowRight size={15} /></> : <>Continue<ArrowRight size={15} /></>}
          </Button>
        </div>
      </form>
    </section>
    <p className="onboarding-foot">Your words are yours. Your feedback makes the workshop.</p>
  </main>;
}
