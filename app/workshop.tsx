'use client';
import {TERMS_VERSION} from '@/lib/workshop-policy';
import {QueueProgress} from '@/components/queue-progress';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  BookOpen, Feather, LayoutGrid, Sparkles, FileText, MessageSquare, Users, User,
  Bookmark, CircleHelp, Plus, Search, SlidersHorizontal, ChevronRight, ChevronDown, BarChart3,
  CodeXml, LoaderCircle, Heart, X, MessageCircle, PenLine, Keyboard, Eye,
  Sun, Moon, Flame, ShieldCheck, Bug, Lightbulb, Trash2, CheckCircle2, RotateCcw, AlertCircle, LogOut, MoreHorizontal,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';
import { sampleWorks, sampleCircles, genres, formatCredits, readingTimeLabel, streakLabel, Work, Review, Circle, WorkAnnotation, WorkMessage, Analytics, SearchResults, AdminOverview } from './data';
import { Editor, Reader, Circles, Guide, Profile, FeedbackList, AuthorProfile, MessagesView, StoryPage } from './workshop-views';
import { FriendsView,LegalConsent } from '@/components/community';
import {ShowcaseCard,AdminCommunityPanel} from '@/components/showcase';
import { Onboarding } from './onboarding';
import { WriterAvatar } from '@/components/writer-avatar';
import { usePagedList,PageMore } from '@/components/paged-list';
import {AuthDialog} from '@/components/auth-dialog';
import { ReadingSettings, ReadingAccountBridge, useReadingPreferences, prefersReducedMotion } from '@/components/reading-preferences';
import { AccountReview } from '@/components/account-review';
import {AttachWork} from '@/components/work-parts';
import {CritiqueDrafts} from '@/components/critique-drafts';
import { CritiquePilotReview } from '@/components/critique-quality';

export type Snapshot = {
  user: { id: string; name: string; bio: string; credits: number; avatarUpdatedAt?: number; termsVersion?:string; friendsOnly?:boolean; onboardingCompleted?: boolean; age?: number | null; sex?: string; location?: string; interests?: string; currentStreak?: number; longestStreak?: number } | null;
  works: Work[];
  reviews: (Review & { helpful: number; reward: number })[];
  bookmarks: string[];
  circles: Circle[];
  posts: { id: string; circleId: string; userId: string; author: string; body: string; createdAt: number }[];
  events: { id: string; amount: number; reason: string; createdAt: number }[];
  annotations: (WorkAnnotation & { reviewId: string; startPos: number; endPos: number })[];
  analytics: Analytics | null;
  messages: WorkMessage[];
  isAdmin?: boolean;
  googleConfigured?: boolean;
  emailPasswordConfigured?:boolean;
  sourceRepositoryUrl?:string;
  stats?:{works:number;words:number;given:number;received:number};
  unreadMessages?:number;
  unreadUpdates?:number;
  revision?:number;
  actionNotice?:string;
};
export type Act = (body: Record<string, unknown>, message?: string, onError?: (error: string) => void) => Promise<boolean>;

const emptySearch: SearchResults = { works: [], authors: [], circles: [] };

const initial: Snapshot = { user: null, works: sampleWorks, reviews: [], bookmarks: [], circles: sampleCircles, posts: [], events: [], annotations: [], analytics: null, messages: [], isAdmin: false, googleConfigured: false,emailPasswordConfigured:false,sourceRepositoryUrl:'' };

const VIEW_COPY: Record<string, { title: string; sub: string }> = {
  Dashboard: { title: 'Dashboard', sub: 'Your writing, feedback, and credits at a glance.' },
};

const primaryNav: { icon: LucideIcon; label: string; view: string }[] = [
  { icon: LayoutGrid, label: 'Dashboard', view: 'Dashboard' },
  { icon: MessageSquare, label: 'Messages', view: 'Messages' },
  { icon: Users, label: 'Friends', view: 'Friends' },
  { icon: FileText, label: 'Your writing', view: 'My writing' },
  { icon: Users, label: 'Your groups', view: 'Writing circles' },
  { icon: User, label: 'Your account', view: 'Your profile' },
];
const secondaryNav: { icon: LucideIcon; label: string; view: string; cta?: boolean }[] = [
  { icon: Feather, label: 'Critique now', view: 'Explore', cta: true },
  { icon: MessageCircle, label: 'My critiques', view: 'My critiques' },
  { icon: Bookmark, label: 'Saved works', view: 'Saved works' },
  { icon: BarChart3, label: 'Analytics', view: 'Analytics' },
  { icon: CircleHelp, label: 'How it works', view: 'How it works' },
];

export default function Workshop() {
  const [data, setData] = useState<Snapshot>(initial);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('Dashboard');
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Recommended');
  const [genreFilter, setGenreFilter] = useState('All genres');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const [toastPaused, setToastPaused] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { preferences } = useReadingPreferences();
  const [authError, setAuthError] = useState('');
  const [editor, setEditor] = useState<Work | null>(null);
  const [about, setAbout] = useState(false);
  const [login, setLogin] = useState(false);
  const [withdraw, setWithdraw] = useState<Work | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<'bug' | 'feature' | null>(null);
  const [revision,setRevision]=useState(0);
  const [detail,setDetail]=useState<{id:string;work:Work|null;loading:boolean;error:string}>({id:'',work:null,loading:false,error:''});
  const [workUnread,setWorkUnread]=useState(0);
  const [notificationCount,setNotificationCount]=useState<number|null>(null);
  const [friendRequests,setFriendRequests]=useState(0);
  const [adminRequests,setAdminRequests]=useState({cases:0,legal:0});
  const gPending = useRef(false);
  const moreOrigin = useRef('Dashboard');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const r = await fetch('/api/workshop', { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
      const d = await r.json() as Snapshot & { error?: string };
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setLoadError((e as Error).name === 'TimeoutError' ? 'The workshop is taking too long to respond. Please retry.' : (e as Error).message || 'The workshop could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the server snapshot while syncing the external browser route.
    void load();
    const params = new URLSearchParams(location.search);
    if (params.get('auth_error')) {
      const errors: Record<string, string> = {
        cancelled: 'Google sign-in was cancelled. You can try again whenever you’re ready.',
        invalid_state: 'Your sign-in attempt expired or belongs to another browser. Please start again.',
        not_configured: 'Sign-in is temporarily unavailable. Please try again later.',
      };
      setAuthError(errors[params.get('auth_error') || ''] || 'Sign in could not be completed. Please try again.');
      params.delete('auth_error');
      history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash);
    }
    const hash = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (h === 'main-content') return;
      if (h.startsWith('read/')) { setSelected(h.slice(5)); setView('Read & critique'); }
      else if (h.startsWith('story/')) { setSelected(h.slice(6)); setView('Story'); }
      else if (h.startsWith('author/')) { setSelected(h.slice(7)); setView('Author profile'); }
      else if(h.startsWith('message/')){setSelected(h.slice(8));setView('Messages');}
      else if (h.startsWith('circle/')) { setSelected(h.slice(7)); setView('Writing circles'); }
      else if (h) { setView(current => h === 'Editor' && current !== 'Editor' ? 'My writing' : h); setSelected(''); }
    };
    hash();
    window.addEventListener('hashchange', hash);
    return () => window.removeEventListener('hashchange', hash);
  }, [load]);

  useEffect(() => { if (!toast || toastError || toastPaused) return; const timer = setTimeout(() => setToast(''), 8000); return () => clearTimeout(timer); }, [toast, toastError, toastPaused]);

  const go = useCallback((v: string, id = '') => {
    setView(v);
    setSelected(id);
    location.hash = id ? (v === 'Author profile' ? 'author/' + id : v === 'Writing circles' ? 'circle/' + id : v === 'Story' ? 'story/' + id : v==='Messages'?'message/'+id:'read/' + id) : v;
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
    requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }));
  }, []);
  const openStory = useCallback((id: string) => go('Story', id), [go]);
  const openAuthor = useCallback((id: string) => { if (id) go('Author profile', id); }, [go]);

  useEffect(() => {
    const NAV: Record<string, string> = { d: 'Dashboard', e: 'Explore', w: 'My writing', m: 'Messages', a: 'Analytics', p: 'Your profile', s: 'Saved works', h: 'How it works' };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); return; }
      if (typing) return;
      if (!preferences.keyboardShortcuts || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(true); return; }
      if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey) { gPending.current = true; window.setTimeout(() => { gPending.current = false; }, 1300); return; }
      if (gPending.current && NAV[e.key.toLowerCase()]) { e.preventDefault(); gPending.current = false; go(NAV[e.key.toLowerCase()]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, preferences.keyboardShortcuts]);

  const act: Act = async (body, message, onError) => {
    if (!data.user) { setLogin(true); return false; }
    if (busy) return false;
    setBusy(true);
    try {
      const r = await fetch('/api/workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json() as Snapshot & { error?: string };
      if (!r.ok) { if (r.status === 401) setLogin(true); throw new Error(d.error); }
      setData(d);
      setRevision(n=>n+1);setNotificationCount(d.unreadMessages??null);
      if (d.actionNotice || message) { setToastError(false); setToast(d.actionNotice || message || 'Saved.'); }
      return true;
    } catch (e) {
      setToastError(true); setToast((e as Error).message || 'Could not save. Please try again.');
      onError?.((e as Error).message || 'Could not save. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const bookmark = useCallback(async (workId: string, savedNow: boolean) => {
    if (!data.user) { setLogin(true); return; }
    const previous = data.bookmarks;
    const next = savedNow ? previous.filter(id => id !== workId) : [...previous, workId];
    setData(d => ({ ...d, bookmarks: next }));
    try {
      const r = await fetch('/api/workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bookmark', workId, saved: !savedNow }) });
      if (!r.ok) { const err = await r.json().catch(() => ({})) as { error?: string }; throw new Error(err.error || 'Could not save.'); }
      const d = await r.json() as Snapshot;
      setData(d);
      setRevision(n=>n+1);
      setToastError(false); setToast(savedNow ? 'Bookmark removed.' : 'Work saved to your reading list.');
    } catch (e) {
      setData(d => ({ ...d, bookmarks: previous }));
      setToastError(true); setToast((e as Error).message || 'Could not save your bookmark. Please try again.');
    }
  }, [data.user, data.bookmarks]);

  const newDraft = () => {
    if (!data.user) { setLogin(true); return; }
    setEditor({ id: crypto.randomUUID(), authorId: data.user.id, author: data.user.name, title: '', genre: 'Literary fiction', kind: 'Short story', stage: 'First draft', content: '', request: '', status: 'draft', reviews: 0, version: 1, createdAt: Date.now(), words: 0, warning: '', mature: false, themes: '', targetReviews: 2, critiqueVisibility: 'public',aiProcess:'not-declared' });
    setView('Editor');
    location.hash = 'Editor';
  };
  const editDraft = async (work: Work,asRevision=false) => {
    try{let full=work;if(!full.content){const response=await fetch('/api/workshop?collection=work&id='+encodeURIComponent(work.id));const result=await response.json() as {work:Work;error?:string};if(!response.ok)throw new Error(result.error);full=result.work;}
      if(asRevision){const copy={...full,id:crypto.randomUUID(),status:'draft',title:full.title+' (revision)',reviews:0,revisionOf:full.id,version:full.version+1,showcaseOptIn:false,aiShowcaseConsent:false,jevReviewAvailable:false};const response=await fetch('/api/workshop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'autosaveDraft',work:copy,expectedSavedAt:0}),signal:AbortSignal.timeout(20000)});const saved=await response.json() as {savedAt:number;error?:string};if(!response.ok)throw new Error(saved.error);full={...copy,createdAt:saved.savedAt};setRevision(n=>n+1);}
      setEditor(full);go('Editor');
    }catch(error){setToast((error as Error).message||'This draft could not load.');}
  };

  const listMode=view==='My writing'?'mine':view==='Saved works'?'saved':'explore';
  const workPage=usePagedList<Work>('/api/workshop?collection=works&'+new URLSearchParams({mode:listMode,q:search,genre:view==='Explore'?genreFilter:'All genres',sort:view==='My writing'?'Newest first':sort}),!!data.user&&['Explore','Saved works','My writing'].includes(view),revision);
  const givenPage=usePagedList<Snapshot['reviews'][number]>('/api/workshop?collection=reviews&mode=given',!!data.user&&view==='My critiques',revision);
  const eventPage=usePagedList<Snapshot['events'][number]>('/api/workshop?collection=events',!!data.user&&view==='Credit history',revision);
  const analyticsPage=usePagedList<Analytics['works'][number]&{id:string}>('/api/workshop?collection=analytics',!!data.user&&view==='Analytics',revision);
  const reading=!!data.user&&!!selected&&['Story','Read & critique'].includes(view);
  const reviewPage=usePagedList<Snapshot['reviews'][number]>('/api/workshop?collection=reviews&id='+encodeURIComponent(selected),reading,revision);
  const annotationPage=usePagedList<Snapshot['annotations'][number]>('/api/workshop?collection=annotations&limit=50&id='+encodeURIComponent(selected),reading,revision);
  useEffect(()=>{
    if(!reading)return;const controller=new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset while loading a new manuscript from the server.
    setDetail({id:selected,work:null,loading:true,error:''});
    fetch('/api/workshop?collection=work&id='+encodeURIComponent(selected),{signal:controller.signal}).then(async response=>{const result=await response.json() as {work:Work;error?:string};if(!response.ok)throw new Error(result.error);if(!controller.signal.aborted)setDetail({id:selected,work:result.work,loading:false,error:''});}).catch(error=>{if(!controller.signal.aborted)setDetail({id:selected,work:null,loading:false,error:error.message});});return()=>controller.abort();
  },[reading,selected,revision]);
  const notificationUserId=data.user?.id;
  useEffect(()=>{
    if(!notificationUserId)return;let stopped=false;let lastCheck=0;let previous:string|null|undefined;let previousWork:string|null|undefined;const controller=new AbortController();
    const check=async()=>{if(document.hidden||Date.now()-lastCheck<15_000)return;lastCheck=Date.now();try{const response=await fetch('/api/notifications',{signal:controller.signal,cache:'no-store'});if(!response.ok)return;const status=await response.json() as {friendRequests:number;adminRequests?:{cases:number;legal:number};unread:number;updatesUnread?:number;latestWorkUpdate?:string|null;latest:{id:string;sender:string}|null};if(stopped)return;setNotificationCount(status.unread);setWorkUnread(status.updatesUnread||0);
      if(previousWork!==undefined&&previousWork!==status.latestWorkUpdate)setRevision(n=>n+1);previousWork=status.latestWorkUpdate||null;setFriendRequests(status.friendRequests||0);setAdminRequests(status.adminRequests||{cases:0,legal:0});
      if(previous!==undefined&&status.latest?.id&&previous!==status.latest.id&&status.unread){setToast('New message from '+status.latest.sender+'.');setRevision(n=>n+1);}previous=status.latest?.id||null;
    }catch{/* Keep the last badge during a temporary connection failure. */}};
    void check();const timer=setInterval(()=>void check(),60_000);const focus=()=>void check();const friendChanged=()=>{lastCheck=0;void check();};window.addEventListener('opendraft:friends',friendChanged);window.addEventListener('opendraft:requests',friendChanged);window.addEventListener('opendraft:updates',friendChanged);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
    return()=>{stopped=true;controller.abort();clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);window.removeEventListener('opendraft:friends',friendChanged);window.removeEventListener('opendraft:requests',friendChanged);window.removeEventListener('opendraft:updates',friendChanged);};
  },[notificationUserId]);

  const uid = data.user?.id;
  const credits = data.user?.credits ?? 5;
  const streak = data.user?.currentStreak ?? 0;
  const longestStreak = data.user?.longestStreak ?? 0;
  const own = (view==='My writing'?workPage.items:data.works).filter(w => w.authorId === uid && w.status !== 'withdrawn');
  const received = data.reviews.filter(r => data.works.some(w => w.id === r.workId && w.authorId === uid));
  const given = view==='My critiques'?givenPage.items:data.reviews.filter(r => r.userId === uid);
  const wordsWritten = data.stats?.words??own.reduce((sum, w) => sum + w.words, 0);
  const unreadMessages = notificationCount??data.unreadMessages??0;

  const works = workPage.items;
  const savedIds=[...new Set([...data.bookmarks,...works.filter(work=>work.bookmarked).map(work=>work.id)])];

  const selectedWork = detail.id===selected?detail.work:null;
  const readerData={...data,revision,reviews:reviewPage.items,annotations:annotationPage.items,works:selectedWork?[selectedWork,...data.works.filter(work=>work.id!==selectedWork.id)]:data.works};
  const readingRoom = data.works.filter(w => w.status === 'spotlight');
  const isNav = (v: string) => view === v;

  if (loading) {
    return <div className="boot-splash"><span className="app-brand">Open<em>Draft</em><b>.</b></span><div className="loading-indicator" role="status"><LoaderCircle size={14} className="animate-spin" />Connecting to the workshop…</div></div>;
  }

  if (loadError) {
    return <div className="boot-splash"><span className="app-brand">Open<em>Draft</em><b>.</b></span><p role="alert">{loadError}</p><Button className="primary-button" onClick={() => { setLoading(true); void load(); }}>Retry connection</Button><a href="/api/auth/logout">Sign out</a></div>;
  }

  if (!data.user) {
    return <Landing googleConfigured={!!data.googleConfigured} emailPasswordConfigured={!!data.emailPasswordConfigured} sourceRepositoryUrl={data.sourceRepositoryUrl||''} error={authError || loadError} />;
  }

  if (data.user.onboardingCompleted === false) {
    return <Onboarding user={data.user} act={act} busy={busy} error={toast} onComplete={() => go('Dashboard')} />;
  }

  if(data.user.termsVersion!==TERMS_VERSION)return <LegalConsent uid={data.user.id} onAccepted={()=>void load()}/>;

  return (
    <div className="app-shell">
      <ReadingAccountBridge id={data.user.id}/>
      <a href="#main-content" className="skip-link">Skip to content</a>

      <header className="app-topbar">
        <Link href="/#Dashboard" className="app-brand" aria-label="OpenDraft home">Open<em>Draft</em><b>.</b></Link>
        <div className="topbar-search"><Search size={14} /><input aria-label="Search writing, writers, circles" placeholder="Search writing, writers, circles…" value={searchQuery} onClick={() => setSearchOpen(true)} onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }} onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); setSearchOpen(true); } }} /><button className="topbar-search-open" aria-label="Open search" onClick={() => setSearchOpen(true)}><Search size={16} /></button><Kbd>⌘</Kbd><Kbd>K</Kbd></div>
        <div className="topbar-actions">
          <button className="topbar-chip" onClick={() => go('Credit history')} title="Your credits"><Sparkles size={13} />{formatCredits(credits)}</button>
          <ThemeToggle />
          <ReadingSettings compact />
          <button className="topbar-chip shortcuts-trigger" title="Keyboard shortcuts" aria-label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)}><Keyboard size={15} /></button>
        </div>
      </header>

      <aside className="sidebar" aria-label="Workshop navigation">
        <div className="user-card">
          <button className="user-avatar" title={data.user ? 'Your account' : 'Sign in'} aria-label="Your account" onClick={() => data.user ? go('Your profile') : setLogin(true)}><WriterAvatar name={data.user?.name || 'Writer'} userId={data.user?.avatarUpdatedAt ? data.user.id : undefined} version={data.user?.avatarUpdatedAt} /></button>
          <div className="user-stats">
            <span className="user-name">{data.user?.name || 'Your writing space'}</span>
            <span className="stat-pills">
              <span className="stat-pill green" title="Critique credits">{formatCredits(credits)} cr</span>
              <span className="stat-pill gold" title="Words written">{wordsWritten.toLocaleString()} words</span>
              <span className="stat-pill streak" title={streakLabel(streak, longestStreak) + ' · longest ' + longestStreak + ' days'}><Flame size={11} />{streak}</span>
            </span>
          </div>
        </div>
        <button className="warm-link" onClick={() => go('How it works')}><Heart size={13} fill="currentColor" /> How the workshop works</button>
        <nav className="side-nav">
          {primaryNav.map(({ icon: Icon, label, view: v }) => (
            <button key={label} className={'side-link' + (isNav(v) ? ' active' : '')} aria-current={isNav(v) ? 'page' : undefined} onClick={() => go(v)}>
              <Icon /><span>{label}</span>
              {v === 'Messages' && unreadMessages+workUnread > 0 && <span className="nav-badge">{unreadMessages+workUnread}</span>}
              {v==='Friends'&&friendRequests>0&&<span className="nav-badge">{friendRequests}</span>}
              {v === 'Your account' && <ChevronRight className="side-caret" width={14} height={14} />}
            </button>
          ))}
        </nav>
        <div className="side-divider" />
        <nav className="side-nav">
          {secondaryNav.map(({ icon: Icon, label, view: v, cta }) => (
            <button key={label} className={(cta ? 'side-cta' : 'side-link') + (isNav(v) ? ' active' : '')} aria-current={isNav(v) ? 'page' : undefined} onClick={() => go(v)}><Icon /><span>{label}</span></button>
          ))}
          {data.isAdmin && <button className={'side-link admin-link' + (isNav('Admin') ? ' active' : '')} aria-current={isNav('Admin') ? 'page' : undefined} onClick={() => go('Admin')}><ShieldCheck /><span>Admin dashboard</span>{adminRequests.cases+adminRequests.legal>0&&<span className="nav-badge">{adminRequests.cases+adminRequests.legal}</span>}</button>}
        </nav>
        <div className="sidebar-footer"><p className="side-foot"><button onClick={() => setAbout(true)}>Open source &amp; free</button> — a workshop that belongs to its writers.</p><a href="/api/auth/logout" className="sidebar-signout" title="Sign out" aria-label="Sign out"><LogOut size={17} /><span>Sign out</span></a></div>
      </aside>

      <div className="main-shell">
        <main id="main-content" tabIndex={-1}>
          {loadError && <div className="error-banner" role="alert"><span>{loadError} Showing example stories until the workshop reconnects.</span><Button variant="outline" onClick={() => void load()}>Try again</Button></div>}
          {loading && <div className="loading-indicator" role="status"><LoaderCircle size={14} className="animate-spin" />Connecting to the workshop…</div>}

          {view === 'Dashboard' && (
            <>
              <div className="page-heading">
                <div><h1>Dashboard</h1><p className="page-sub">{VIEW_COPY.Dashboard.sub}</p></div>
                <div className="heading-actions">
                  <Button variant="outline" onClick={() => go('Explore')}><Feather size={14} />Critique now</Button>
                  <Button className="primary-button" onClick={newDraft}><Plus size={14} />Share your writing</Button>
                </div>
              </div>
              <div className="sheet">
                <div className="sheet-body">
                  <div className="stat-row">
                    <div className="stat-card"><strong>{formatCredits(credits)}</strong><span>credits available</span></div>
                    <div className="stat-card"><strong>{data.stats?.works??own.length}</strong><span>works written</span></div>
                    <div className="stat-card"><strong>{data.stats?.given??given.length}</strong><span>critiques given</span></div>
                    <div className="stat-card"><strong>{data.stats?.received??received.length}</strong><span>critiques received</span></div>
                    <div className="stat-card streak-card"><strong><Flame size={15} />{streak}</strong><span>day streak</span></div>
                  </div>
                  <ShowcaseCard onRead={openStory} onAuthor={openAuthor}/>
                  <div className="dash-grid">
                    <div>
                      <div className="dash-section">
                        <h2 className="section-title">The reading room <span className="tab-count">{readingRoom.length}</span></h2>
                        <div className="work-list" style={{ borderTop: '1px solid #ededed' }}>
                          {readingRoom.slice(0, 4).map(w => <WorkRow key={w.id} compact work={w} saved={data.bookmarks.includes(w.id)} busy={busy} onSave={() => void bookmark(w.id, data.bookmarks.includes(w.id))} onRead={() => openStory(w.id)} onAuthor={openAuthor} />)}
                          {!readingRoom.length && <p className="example-note">The reading room is empty right now. Check the queue for what is next.</p>}
                        </div>
                        <div style={{ paddingTop: 12 }}><button className="text-link" onClick={() => go('Explore')}>See all works to critique <ChevronRight size={13} /></button></div>
                      </div>
                      <div className="dash-section">
                        <h2 className="section-title">Your writing</h2>
                        {own.length ? (
                          <div className="work-list" style={{ borderTop: '1px solid #ededed' }}>
                            {own.slice(0, 4).map(w => (
                              <div className="work-row" key={w.id}>
                                <span className="work-thumb"><FileText size={18} /></span>
                                <div className="work-body">
                                  <button className="work-title" onClick={() => openStory(w.id)}>{w.title || 'Untitled draft'}</button>
                                  <div className="work-byline"><span className="status-label" style={{ marginRight: 6 }}>{w.status === 'spotlight' ? 'Reading room' : w.status === 'queued' ? 'In queue' : w.status === 'open' ? 'Open for feedback' : 'Private draft'}</span>{w.genre} · {w.words} words · {readingTimeLabel(w.words)} · {w.reviews} critiques</div><QueueProgress work={w}/>
                                </div>
                                <div className="work-stats"><button className="row-action" onClick={() => w.status === 'draft' ? editDraft(w) : openStory(w.id)}>{w.status === 'draft' ? 'Keep writing' : 'Read feedback'}</button></div>
                              </div>
                            ))}
                          </div>
                        ) : <p className="example-note">Every story starts somewhere. Save a private draft for free, or share your writing for five credits.</p>}
                        <div style={{ paddingTop: 12 }}><button className="text-link" onClick={() => go('My writing')}>Go to your writing <ChevronRight size={13} /></button></div>
                      </div>
                    </div>
                    <aside>
                      <section className="credit-card">
                        <span className="section-title tight" style={{ display: 'block' }}>Your critique credits</span>
                        <div className="credit-number">{formatCredits(credits)}<span>credits</span></div>
                        <p className="fine-print">A thoughtful critique goes a long way — for their draft, and for yours.</p>
                        <div className="credit-rule"><Sparkles size={14} /><span>Eligible critiques earn <strong>1 credit</strong> at 175 words, then <strong>0.5 per extra 100 words</strong>. All reading checks must be green. The OpenDraft quality average must exceed 2/4, with every category at least 2/4. Shorter critiques are welcome without credits.</span></div>
                        <div className="credit-rule"><Feather size={14} /><span>Share a draft for <strong>5 credits</strong></span></div>
                        <button className="text-link" style={{ marginTop: 10 }} onClick={() => go('Credit history')}>A fair exchange <ChevronRight size={13} /></button>
                      </section>
                      {data.analytics && data.analytics.totalReads > 0 && (
                        <section className="credit-card" style={{ marginTop: 16 }}>
                          <h2 className="section-title tight">Reader analytics</h2>
                          <div className="mini-stats"><div><strong>{data.analytics.totalReads}</strong><span>reads</span></div><div><strong>{data.analytics.uniqueReaders}</strong><span>readers</span></div></div>
                          <button className="text-link" style={{ marginTop: 10 }} onClick={() => go('Analytics')}>View analytics <ChevronRight size={13} /></button>
                        </section>
                      )}
                      <section className="credit-card" style={{ marginTop: 16 }}>
                        <h2 className="section-title tight">Messages</h2>
                        {unreadMessages ? <p className="fine-print">{unreadMessages} unread message{unreadMessages === 1 ? '' : 's'}.</p> : <p className="fine-print">No unread messages.</p>}
                        <button className="text-link" style={{ marginTop: 8 }} onClick={() => go('Messages')}>Open messages <ChevronRight size={13} /></button>
                      </section>
                    </aside>
                  </div>
                </div>
              </div>
            </>
          )}

          {(view === 'Explore' || view === 'Saved works') && (
            <div className="sheet">
              <div className="sheet-head"><h1>{view === 'Explore' ? 'Critique now' : 'Saved works'}</h1></div>
              <div style={{ padding: '14px 24px 0' }}>
                <div className="filters">
                  <div className="search-box" style={{ flex: 1 }}><Search size={15} /><Input aria-label="Search writing" placeholder="Find a story or a writer…" value={search} onChange={e => setSearch(e.target.value)} /></div>
                  {view === 'Explore' && <div className="filter-select"><BookOpen size={14} /><select aria-label="Filter by genre" value={genreFilter} onChange={e => setGenreFilter(e.target.value)}>{genres.map(g => <option key={g}>{g}</option>)}</select></div>}
                  <div className="filter-select"><SlidersHorizontal size={14} /><select aria-label="Sort works" value={sort} onChange={e => setSort(e.target.value)}>{['Recommended', 'Needs feedback', 'Newest first', 'Shortest first', 'Longest first'].map(s => <option key={s}>{s}</option>)}</select></div>
                </div>
              </div>
              <div className="result-toolbar">
                <span>{works.length} {works.length === 1 ? 'work' : 'works'}{genreFilter !== 'All genres' && view === 'Explore' ? ` in ${genreFilter}` : ''}{search ? ` for “${search}”` : ''}</span>
                <span className="result-tools">
                  {(search || (genreFilter !== 'All genres' && view === 'Explore')) && <button className="text-link" onClick={() => { setSearch(''); setGenreFilter('All genres'); }}><X size={12} />Clear filters</button>}
                  <span className="fine-print"><span className="room-dot inline">◆</span> reading room (full credit) · outside reading room (zero credits)</span>
                </span>
              </div>
              {view === 'Explore'
                ? <GenreBoard works={works} saved={savedIds} busy={busy} onSave={bookmark} onRead={openStory} onAuthor={openAuthor} />
                : <FlatWorkList works={works} saved={savedIds} busy={busy} onSave={bookmark} onRead={openStory} onAuthor={openAuthor} onReset={() => setSearch('')} empty="Bookmark a story and it will wait for you here." />}
              <PageMore page={workPage} label="More writing" />
              <p className="example-note">Stories labeled “Example” are original starter pieces for exploring the workshop.</p>
            </div>
          )}

          {view === 'Story' && (selectedWork ? <StoryPage onRead={openStory} work={selectedWork} data={readerData} act={act} busy={busy} onCritique={() => go('Read & critique', selectedWork.id)} onAuthor={openAuthor} analytics={data.analytics} onAnalytics={() => go('Analytics')} onChanged={()=>{void load();setRevision(n=>n+1);}} /> : <div className="sheet"><div className="sheet-body">{detail.loading||detail.id!==selected?<p role="status">Loading this work…</p>:<Empty title="This story isn’t available." description={detail.error||'It may have been withdrawn by its writer.'} label="Back to the workshop" action={() => go('Explore')} />}</div></div>)}

          {view === 'Read & critique' && (selectedWork
            ? <Reader key={selectedWork.id+':'+selectedWork.version} onRead={id=>go('Read & critique',id)} work={selectedWork} data={readerData} act={act} busy={busy} back={() => go('Story', selectedWork.id)} onSignIn={() => setLogin(true)} onAuthor={openAuthor} />
            : <div className="sheet"><div className="sheet-body">{detail.loading||detail.id!==selected?<p role="status">Loading this work…</p>:<Empty title="This story isn’t available." description={detail.error||'It may have been withdrawn by its writer.'} label="Back to the workshop" action={() => go('Explore')} />}</div></div>)}
          {reading&&selectedWork&&<><PageMore page={reviewPage} label="More critiques" /><PageMore page={annotationPage} label="More line notes" /></>}

          {view === 'Author profile' && <AuthorProfile uid={uid||''} onMessage={id=>go('Messages',id)} id={selected} onBack={() => go('Explore')} onOpenStory={openStory} />}

          {view === 'Editor' && editor && (
            <div className="sheet">
              <div className="sheet-toolbar"><span className="fine-print"><PenLine size={13} /> Private draft · Your writing stays yours</span></div>
              <div className="sheet-head"><h1>{editor.title ? 'Edit your work' : 'A new draft'}</h1></div>
              <div className="sheet-body"><Editor key={editor.id} initial={editor} credits={credits} act={act} busy={busy} revisionAnnotations={editor.revisionOf?data.annotations.filter(note=>note.workId===editor.revisionOf):[]} onSaved={() => setRevision(n=>n+1)} close={() => { setEditor(null); go('My writing'); void load(); }} onDone={() => { setEditor(null); go('My writing'); }} /></div>
            </div>
          )}

          {view === 'My writing' && (
            <div className="sheet">
              <div className="sheet-toolbar">
                <Button className="primary-button" onClick={newDraft}><PenLine size={14} />Post a work for critique</Button>
                <Button variant="outline" onClick={() => go('Explore')}><Feather size={14} />Critique other work</Button>
                <span className="toolbar-spacer" />
                <span className="fine-print">{own.length} {own.length === 1 ? 'work' : 'works'} · {wordsWritten.toLocaleString()} words written</span>
              </div>
              <div className="sheet-head"><h1>Your writing</h1></div>
              {own.length ? (
                <div className="writing-list">
                  {own.map(w => (
                    <article className="writing-row" key={w.id}>
                      <span className="writing-icon"><FileText size={20} /></span>
                      <div className="writing-main">
                        <span className={'status-label ' + w.status}>{w.status === 'spotlight' ? `Reading room · ${w.genre}` : w.status === 'queued' ? 'In queue' : w.status === 'open' ? 'Open for feedback' : 'Private draft'}</span>
                        <h2>{w.title || 'Untitled draft'}</h2>
                        <p>{w.genre} · {w.words} words · {readingTimeLabel(w.words)} · {w.reviews} critiques</p>
                        <QueueProgress work={w}/>
                      </div>
                      <div className="writing-actions">
                        <button className="row-action" onClick={() => w.status === 'draft' ? editDraft(w) : openStory(w.id)}><PenLine size={13} />{w.status === 'draft' ? 'Edit & publish' : 'Read feedback'}</button>
                        {w.largerWork&&<span className="fine-print">{w.largerWork} · Part {w.partNumber||1}</span>}<AttachWork work={w} act={act} busy={busy}/>{w.status !== 'draft' && <button className="row-action" onClick={() => go('Analytics')}><Eye size={13} />Reader stats</button>}
                        {w.status !== 'draft' && <button className="row-action" onClick={() => void editDraft(w,true)}><FileText size={13} />New revision</button>}
                        {w.status !== 'draft' && <button className="row-action danger" title="Withdraw work" aria-label={'Withdraw ' + w.title} onClick={() => setWithdraw(w)}><X size={13} />Withdraw</button>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : <div className="sheet-body"><Empty title="Every story starts somewhere." description="Save a private draft for free, or share your writing with the workshop for five credits." label="Start a draft" action={newDraft} /></div>}
              <PageMore page={workPage} label="More of your writing" />
            </div>
          )}

          {view==='Friends'&&<FriendsView incomingRequests={friendRequests} onAuthor={openAuthor} onMessage={id=>go('Messages',id)}/>}
          {view === 'Messages' && <MessagesView initialWith={selected} data={{...data,revision,unreadMessages,unreadUpdates:workUnread}} act={act} busy={busy} onAuthor={openAuthor} onOpenStory={openStory} onUnreadChange={setNotificationCount} />}
          {view === 'My critiques' && <>{uid&&<CritiqueDrafts uid={uid} onRead={id=>go('Read & critique',id)}/>}<FeedbackList reviews={given} data={data} act={act} busy={busy} onRead={openStory} received={false} onExplore={() => go('Explore')} onAuthor={openAuthor} /><PageMore page={givenPage} label="More critiques" /></>}
          {view === 'Analytics' && <><AnalyticsView analytics={data.analytics?{...data.analytics,works:analyticsPage.items}:null} own={own} onRead={openStory} onWrite={newDraft} /><PageMore page={analyticsPage} label="More reader stats" /></>}
          {view === 'Writing circles' && <div className="sheet"><div className="sheet-head"><h1>Writing circles</h1></div><div className="sheet-body"><Circles key={selected||'all'} initialSelected={selected} data={{...data,revision}} act={act} busy={busy} onOpenStory={openStory} onVisit={id=>go('Writing circles',id)}/></div></div>}
          {view === 'How it works' && <div className="sheet"><div className="sheet-head"><h1>How it works</h1></div><div className="sheet-body"><Guide onExplore={() => go('Explore')} onWrite={newDraft} onAbout={() => setAbout(true)} /></div></div>}
          {view === 'Your profile' && <div className="sheet"><div className="sheet-head"><h1>Your account</h1></div><div className="sheet-body"><Profile data={data} act={act} busy={busy} onSignIn={() => setLogin(true)} /></div></div>}
          {view === 'Admin' && data.isAdmin && <AdminView requestCounts={adminRequests} onOpenStory={openStory} onAuthor={openAuthor} />}

          {view === 'Credit history' && (
            <div className="sheet"><div className="sheet-head"><h1>Credit history</h1></div><div className="sheet-body">
              <div className="credit-history">
                <div className="balance-card"><Sparkles size={24} /><h2>{formatCredits(credits)} credits</h2><p>You start with five. Thoughtful critiques keep the exchange going.</p></div>
                <div className="history-row"><span>Welcome to OpenDraft</span><strong>+5</strong></div>
                {eventPage.items.map(e => <div className="history-row" key={e.id}><span>{e.reason}<small>{new Date(e.createdAt).toLocaleDateString()}</small></span><strong className={e.amount < 0 ? 'spent' : ''}>{e.amount > 0 ? '+' : ''}{formatCredits(e.amount)}</strong></div>)}
                <PageMore page={eventPage} label="Earlier credit activity" />
                <div style={{ marginTop: 16 }}><Button variant="outline" onClick={() => go('Explore')}>Find a work to critique</Button></div>
              </div>
            </div></div>
          )}

          <footer className="site-footer"><span>Made for the messy, wonderful process of writing.</span><Link href="/rights">Your writing &amp; your rights</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link>{data.sourceRepositoryUrl&&<a href={data.sourceRepositoryUrl} target="_blank" rel="noreferrer">Source code</a>}<button onClick={() => setAbout(true)}>Always free. Always open.</button></footer>
        </main>
      </div>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
      <nav className="mobile-nav" aria-label="Mobile workshop navigation">
        {[{ label: 'Home', view: 'Dashboard', icon: LayoutGrid, active: view === 'Dashboard' }, { label: 'Read', view: 'Explore', icon: BookOpen, active: ['Explore', 'Story', 'Read & critique'].includes(view) }, { label: 'Write', view: 'My writing', icon: FileText, active: ['My writing', 'Editor'].includes(view) }, { label: 'Inbox', view: 'Messages', icon: MessageSquare, active: view === 'Messages' }].map(({ label, view: destination, icon: Icon, active }) => <button key={label} type="button" className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={() => go(destination)}><span className="mobile-nav-icon"><Icon size={21}/>{destination === 'Messages' && unreadMessages+workUnread > 0 && <span className="nav-badge" aria-label={`${unreadMessages+workUnread} unread messages and work updates`}>{unreadMessages+workUnread > 99 ? '99+' : unreadMessages+workUnread}</span>}</span><span>{label}</span></button>)}
        <DialogTrigger asChild><button type="button" aria-label="More destinations" className={!['Dashboard', 'Explore', 'Story', 'Read & critique', 'My writing', 'Editor', 'Messages'].includes(view) ? 'active' : ''} onClick={() => { moreOrigin.current = view; }}><MoreHorizontal size={21}/><span>More</span></button></DialogTrigger>
      </nav>
        <DialogContent className="compact-dialog mobile-more-dialog" onCloseAutoFocus={event => { if (moreOrigin.current !== view) { event.preventDefault(); document.getElementById('main-content')?.focus({ preventScroll: true }); } }}>
          <DialogTitle>Your workshop</DialogTitle><DialogDescription>Circles, saved reading, account settings, and help.</DialogDescription>
          <nav className="more-destinations" aria-label="More workshop destinations">
            {[primaryNav[4], primaryNav[2], secondaryNav[2], secondaryNav[1], primaryNav[5], secondaryNav[3], secondaryNav[4], ...(data.isAdmin ? [{ icon: ShieldCheck, label: 'Admin dashboard', view: 'Admin' }] : [])].map(({ icon: Icon, label, view: destination }) => <button key={destination} type="button" onClick={() => go(destination)}><Icon size={20}/><span>{label}</span>{destination === 'Friends' && friendRequests > 0 && <span className="nav-badge">{friendRequests}</span>}<ChevronRight size={16}/></button>)}
          </nav>
          <ReadingSettings/>
          <div className="more-help"><button type="button" className="text-link" onClick={() => { setMoreOpen(false); setFeedbackKind('bug'); }}><Bug size={16}/>Report a bug</button><button type="button" className="text-link" onClick={() => { setMoreOpen(false); setFeedbackKind('feature'); }}><Lightbulb size={16}/>Suggest a feature</button><a className="text-link" href="/api/auth/logout"><LogOut size={16}/>Sign out</a></div>
        </DialogContent>
      </Dialog>

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} q={searchQuery} setQ={setSearchQuery} onSearch={q => { setSearch(q); setSearchOpen(false); go('Explore'); }} onRead={id => { setSearchOpen(false); openStory(id); }} onAuthor={id => { setSearchOpen(false); openAuthor(id); }} onCircle={id=>{setSearchOpen(false);go('Writing circles',id);}} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <AuthDialog open={login} onOpenChange={setLogin} googleConfigured={!!data.googleConfigured} emailPasswordConfigured={!!data.emailPasswordConfigured} returnTo={typeof window!=='undefined'?location.pathname+location.search+location.hash:'/'} />

      <Dialog open={about} onOpenChange={setAbout}>
        <DialogContent className="compact-dialog">
          <DialogTitle>A workshop that belongs to its writers.</DialogTitle>
          <DialogDescription>OpenDraft is free software under the MIT license. Anyone can use, study, modify, and self-host it.</DialogDescription>
          <div className="about-copy">
            <p>Credits are a way of exchanging attention. They’re earned through critique, never sold. Drafts are private until you publish them to the workshop.</p>
            <p>You keep ownership of your stories and can export your writing and feedback from your account.</p>
            <span className="license-label"><CodeXml size={15} />MIT licensed · Built for community</span>
            {data.sourceRepositoryUrl&&<a className="text-link" href={data.sourceRepositoryUrl} target="_blank" rel="noreferrer">View the OpenDraft source repository</a>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!withdraw} onOpenChange={open => { if (!open) setWithdraw(null); }}>
        <DialogContent className="compact-dialog">
          <DialogTitle>Withdraw “{withdraw?.title}”?</DialogTitle>
          <DialogDescription>This removes the work from workshop listings. Your existing feedback is preserved in your account. Spent credits aren’t refunded.</DialogDescription>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setWithdraw(null)}>Keep it here</Button>
            <Button disabled={busy} onClick={async () => { if (await act({ action: 'withdraw', workId: withdraw?.id }, 'Work withdrawn from the workshop.')) setWithdraw(null); }}>Withdraw work</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="toast-announcer" role="status" aria-live="polite" aria-atomic="true">{!toastError ? toast : ''}</div>
      <div className="toast-announcer" role="alert" aria-atomic="true">{toastError ? toast : ''}</div>
      {toast && <div className={'toast' + (toastError ? ' toast-error' : '')} onMouseEnter={() => setToastPaused(true)} onMouseLeave={() => setToastPaused(false)} onFocus={() => setToastPaused(true)} onBlur={() => setToastPaused(false)}>{toastError ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}<span>{toast}</span><button aria-label="Dismiss notification" onClick={() => { setToast(''); setToastPaused(false); }}><X size={16} /></button></div>}

      <div className="feedback-fab" role="group" aria-label="Report a bug or request a feature">
        <button className="fab-button" onClick={() => setFeedbackKind('bug')} title="Report a bug"><Bug size={15} /><span>Report a bug</span></button>
        <button className="fab-button" onClick={() => setFeedbackKind('feature')} title="Request a feature"><Lightbulb size={15} /><span>Request a feature</span></button>
      </div>

      <FeedbackDialog key={feedbackKind || 'closed'} kind={feedbackKind} onOpenChange={open => { if (!open) setFeedbackKind(null); }} act={act} busy={busy} page={view} />
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <button className="topbar-chip" title={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

function FeedbackDialog({ kind, onOpenChange, act, busy, page }: { kind: 'bug' | 'feature' | null; onOpenChange: (v: boolean) => void; act: Act; busy: boolean; page: string }) {
  const [body, setBody] = useState('');
  const label = kind === 'feature' ? 'Request a feature' : 'Report a bug';
  return (
    <Dialog open={!!kind} onOpenChange={onOpenChange}>
      <DialogContent className="compact-dialog">
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>
          {kind === 'feature'
            ? 'Tell us what would make the workshop better. Be as specific as you can about the problem you are trying to solve.'
            : 'Describe what went wrong and what you expected to happen. Include the page you were on if it helps.'}
        </DialogDescription>
        <label className="field-label">{kind === 'feature' ? 'Your idea' : 'What happened?'}
          <textarea className="form-textarea" rows={6} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} placeholder={kind === 'feature' ? 'It would help if…' : 'When I clicked…'} />
        </label>
        <p className="fine-print">Sent to the workshop operator{page ? ` from the ${page} page` : ''}. No account details are shared beyond your email.</p>
        <div className="form-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="primary-button" disabled={busy || body.trim().length < 5} onClick={async () => { if (await act({ action: 'feedback', kind: kind || 'bug', body: body.trim(), page }, 'Thank you — your note has been sent to the operator.')) onOpenChange(false); }}>Send {kind === 'feature' ? 'request' : 'report'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnalyticsView({ analytics, own, onRead, onWrite }: { analytics: Analytics | null; own: Work[]; onRead: (id: string) => void; onWrite: () => void }) {
  if (!analytics) {
    return <div className="sheet"><div className="sheet-head"><h1>Reader analytics</h1></div><div className="sheet-body"><Empty title="No reader data yet." description="Analytics appear once people open your published work. Add age, sex, and interests to your profile to help the community understand who is reading." label="Share your writing" action={onWrite} /></div></div>;
  }
  const ageOrder = ['Under 18', '18–24', '25–34', '35–44', '45–54', '55–64', '65+', 'Unknown'];
  return (
    <div className="sheet wide">
      <div className="sheet-head"><h1>Reader analytics</h1></div>
      <div className="sheet-body">
        <div className="stat-row">
          <div className="stat-card"><strong>{analytics.totalReads}</strong><span>total reads</span></div>
          <div className="stat-card"><strong>{analytics.uniqueReaders}</strong><span>unique readers</span></div>
          <div className="stat-card"><strong>{own.length}</strong><span>published works</span></div>
          <div className="stat-card"><strong>{analytics.works.reduce((s, w) => s + w.views, 0)}</strong><span>reads across works</span></div>
        </div>
        <div className="dash-grid">
          <div>
            <section className="dash-section">
              <h2 className="section-title">Reads by work</h2>
              {analytics.works.length ? (
                <table className="analytics-table"><thead><tr><th>Work</th><th>Reads</th><th>Readers</th></tr></thead><tbody>
                  {analytics.works.map(w => <tr key={w.workId}><td><button className="text-link" onClick={() => onRead(w.workId)}>{w.title}</button></td><td>{w.views}</td><td>{w.readers}</td></tr>)}
                </tbody></table>
              ) : <p className="fine-print">No published work yet.</p>}
            </section>
            <section className="dash-section">
              <h2 className="section-title">Age of readers <span className="chart-note">histogram</span></h2>
              {analytics.uniqueReaders ? <Histogram data={analytics.age} order={ageOrder} /> : <p className="fine-print">Not enough reader data yet. Readers can add their age to their profile.</p>}
            </section>
          </div>
          <aside>
            <section className="credit-card">
              <h2 className="section-title tight">Sex of readers <span className="chart-note">pie</span></h2>
              <DonutChart data={Object.entries(analytics.sex).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} />
            </section>
            <section className="credit-card" style={{ marginTop: 16 }}>
              <h2 className="section-title tight">Where readers are <span className="chart-note">pie</span></h2>
              <DonutChart data={Object.entries(analytics.locations).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

const DONUT_COLORS = ['#9d1c1c', '#c9772f', '#5c9e3d', '#3d6fa0', '#8a5cc0', '#b0805a', '#767676', '#e8b923'];

function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="fine-print">No data yet.</p>;
  const r = 42, c = 2 * Math.PI * r;
  const segments = data.map((d, i) => {
    const before = data.slice(0, i).reduce((sum, x) => sum + x.value, 0);
    const len = (d.value / total) * c;
    return <circle key={d.label} cx="60" cy="60" r={r} className="donut-seg" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-(before / total) * c} />;
  });
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" className="donut" role="img" aria-label="Distribution chart">
        <circle cx="60" cy="60" r={r} className="donut-track" />
        <g transform="rotate(-90 60 60)">{segments}</g>
        <text x="60" y="57" className="donut-total">{total}</text>
        <text x="60" y="71" className="donut-total-label">readers</text>
      </svg>
      <ul className="donut-legend">
        {data.map((d, i) => <li key={d.label}><span className="donut-swatch" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />{d.label}<b>{d.value}</b></li>)}
      </ul>
    </div>
  );
}

function Histogram({ data, order }: { data: Record<string, number>; order: string[] }) {
  const max = Math.max(1, ...order.map(k => data[k] || 0));
  return (
    <div className="histogram" role="img" aria-label="Age histogram">
      {order.map(k => {
        const v = data[k] || 0;
        return <div className="hist-col" key={k}><span className="hist-value">{v}</span><span className="hist-bar" style={{ height: `${Math.max(2, (v / max) * 100)}%` }} title={`${k}: ${v}`} /><span className="hist-label">{k}</span></div>;
      })}
    </div>
  );
}

function AdminView({ onOpenStory,onAuthor,requestCounts }: { requestCounts:{cases:number;legal:number};onOpenStory: (id: string) => void; onAuthor: (id: string) => void }) {
  const [reportFilter,setReportFilter]=useState('open'),[feedbackFilter,setFeedbackFilter]=useState('open');
  const reportsPage=usePagedList<AdminOverview['reports'][number]>('/api/admin?collection=reports&status='+reportFilter);
  const feedbackPage=usePagedList<AdminOverview['feedback'][number]>('/api/admin?collection=feedback&status='+feedbackFilter);
  const auditPage=usePagedList<{id:string;adminName:string;action:string;targetId:string;reason:string;details:string;createdAt:number}>('/api/admin?collection=audit');
  const worksPage=usePagedList<AdminOverview['works'][number]>('/api/admin?collection=works');
  const flaggedPage=usePagedList<AdminOverview['flaggedMessages'][number]>('/api/admin?collection=flaggedMessages');
  const [state, setState] = useState<{ loading: boolean; error: string; data: AdminOverview | null }>({ loading: true, error: '', data: null });
  const [pending, setPending] = useState('');
  const [note, setNote] = useState('');
  const [reload, setReload] = useState(0);
  const [decision,setDecision]=useState<{body:Record<string,unknown>;key:string}|null>(null);
  const [reason,setReason]=useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/admin')
      .then(async r => { const d = await r.json() as AdminOverview & { error?: string }; if (!r.ok) throw new Error(d.error || 'Unavailable'); return d; })
      .then(d => { if (active) setState({ loading: false, error: '', data: d }); })
      .catch(e => { if (active) setState({ loading: false, error: (e as Error).message, data: null }); });
    return () => { active = false; };
  }, [reload]);
  const run = async (body: Record<string, unknown>, key: string) => {
    if(['dismissReport','withdrawWork','restoreWork','clearMessageFlag','deleteMessage','deleteFeedback','grantCredits'].includes(String(body.action))&&!body.reason){setReason('');setNote('');setDecision({body,key});return;}
    setPending(key); setNote('');
    try {
      const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json() as AdminOverview & { error?: string };
      if (!r.ok) throw new Error(d.error || 'Could not complete that action.');
      setState({ loading: false, error: '', data: d });
      setNote('Done.');
      setDecision(null);reportsPage.refresh();feedbackPage.refresh();worksPage.refresh();flaggedPage.refresh();auditPage.refresh();
    } catch (e) { setNote((e as Error).message); } finally { setPending(''); }
  };
  if (state.loading) return <div className="sheet"><div className="sheet-body"><div className="loading-indicator"><LoaderCircle size={14} className="animate-spin" />Loading admin dashboard…</div></div></div>;
  if (state.error || !state.data) return <div className="sheet"><div className="sheet-body"><Empty title="Admin dashboard unavailable." description={state.error || 'Administrator access is required.'} label="Try again" action={() => { setState(s => ({ ...s, loading: true })); setReload(n => n + 1); }} /></div></div>;
  const { counts, queues } = state.data;
  const feedback=feedbackPage.items,reports=reportsPage.items,works=worksPage.items,flaggedMessages=flaggedPage.items;
  return (
    <div className="sheet wide">
      <div className="sheet-head"><h1>Admin dashboard</h1></div>
      <div className="sheet-toolbar"><span className="fine-print">Operator tools for {counts.members.toLocaleString()} members. Actions here affect the whole workshop.</span><span className="toolbar-spacer" />{note && <span className="fine-print">{note}</span>}</div>
      <div className="sheet-body">
        <div className="stat-row">
          <div className="stat-card"><strong>{counts.members}</strong><span>members</span></div>
          <div className="stat-card"><strong>{counts.works}</strong><span>works</span></div>
          <div className="stat-card"><strong>{counts.readingRoom}</strong><span>in reading rooms</span></div>
          <div className="stat-card"><strong>{counts.queued}</strong><span>in queues</span></div>
          <div className="stat-card"><strong>{counts.reviews}</strong><span>critiques</span></div>
          <div className="stat-card"><strong>{counts.reports}</strong><span>reports</span></div>
          <div className="stat-card"><strong>{counts.openFeedback}</strong><span>open feedback</span></div>
          <div className="stat-card"><strong>{counts.flaggedMessages}</strong><span>flagged messages</span></div>
        </div>

        <section className="dash-section">
          <h2 className="section-title">Reading room &amp; queue by genre</h2>
          {queues.length ? (
            <table className="analytics-table"><thead><tr><th>Genre</th><th>Reading room</th><th>Queue</th><th>Waiting</th></tr></thead><tbody>
              {queues.map(q => <tr key={q.genre}><td>{q.genre}</td><td>{q.readingRoom} / 4</td><td>{q.queue}</td><td>{q.queue > 0 ? 'Yes' : '—'}</td></tr>)}
            </tbody></table>
          ) : <p className="fine-print">No works in the reading room or queue yet.</p>}
        </section>

        <AccountReview onRead={onOpenStory} onAuthor={onAuthor}/>
        <CritiquePilotReview onRead={onOpenStory}/>
        <section className="dash-section">
          <h2 className="section-title">Bug reports &amp; feature requests <span className="tab-count">{feedback.length}</span></h2>
          <label className="admin-filter">Show feedback<select className="form-select" value={feedbackFilter} onChange={event=>setFeedbackFilter(event.target.value)}><option value="open">Open</option><option value="resolved">Resolved</option><option value="archived">Archived</option><option value="all">All statuses</option></select></label>
          {feedback.length ? (
            <div className="admin-list">
              {feedback.map(f => (
                <article className={'admin-row kind-' + f.kind} key={f.id}>
                  <span className="admin-tag">{f.kind === 'feature' ? 'Feature' : 'Bug'}</span>
                  <div className="admin-body"><p>{f.body}</p><small>{f.email || 'Unknown'} · {new Date(f.createdAt).toLocaleString()} · {f.page || 'unknown page'} · {f.status}</small></div>
                  <div className="admin-actions">
                    {f.status !== 'resolved' && <button className="row-action" disabled={pending === f.id} onClick={() => void run({ action: 'setFeedbackStatus', id: f.id, status: 'resolved' }, f.id)}><CheckCircle2 size={13} />Resolve</button>}
                    {f.status!=='open'&&<button className="row-action" disabled={pending===f.id} onClick={()=>void run({action:'setFeedbackStatus',id:f.id,status:'open'},f.id)}>Reopen</button>}
                    {f.status!=='archived'&&<button className="row-action" disabled={pending === f.id} onClick={() => void run({ action: 'setFeedbackStatus', id: f.id,status:'archived' }, f.id)}>Archive</button>}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="fine-print">No feedback submitted yet.</p>}
          <PageMore page={feedbackPage} label="Earlier feedback" />
        </section>

        <section className="dash-section">
          <h2 className="section-title">Community reports <span className="tab-count">{reports.length}</span></h2>
          <label className="admin-filter">Show reports<select className="form-select" value={reportFilter} onChange={event=>setReportFilter(event.target.value)}><option value="open">Open</option><option value="dismissed">Decision history</option><option value="all">All reports</option></select></label>
          {reports.length ? (
            <div className="admin-list">
              {reports.map(r => (
                <article className="admin-row" key={r.id}>
                  <span className="admin-tag danger">Report</span>
                  <div className="admin-body"><p>{r.reason}</p><small>{r.workTitle ? `On “${r.workTitle}” by ${r.workAuthor || 'unknown'}` : 'Work removed'} · {new Date(r.createdAt).toLocaleString()} · {r.status||'open'}</small>{r.resolution&&<p className="admin-resolution">Decision: {r.resolution}</p>}</div>
                  <div className="admin-actions">
                    {r.workId && <button className="row-action" onClick={() => onOpenStory(r.workId)}>View work</button>}
                    {r.workId && <button className="row-action danger" disabled={pending === r.id} onClick={() => void run({ action: 'withdrawWork', id: r.workId }, r.id)}><Trash2 size={13} />Withdraw</button>}
                    {r.status!=='dismissed'&&<button className="row-action" disabled={pending === r.id} onClick={() => void run({ action: 'dismissReport', id: r.id }, r.id)}><CheckCircle2 size={13} />Dismiss with reason</button>}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="fine-print">No community reports.</p>}
          <PageMore page={reportsPage} label="Earlier reports" />
        </section>

        <section className="dash-section">
          <h2 className="section-title">Flagged messages <span className="tab-count">{flaggedMessages.length}</span></h2>
          {flaggedMessages.length ? (
            <div className="admin-list">
              {flaggedMessages.map(m => (
                <article className="admin-row" key={m.id}>
                  <span className="admin-tag danger">Flagged</span>
                  <div className="admin-body"><p>{m.body}</p><small>{m.sender} → {m.recipient} · {new Date(m.createdAt).toLocaleString()}</small></div>
                  <div className="admin-actions">
                    <button className="row-action" disabled={pending === m.id} onClick={() => void run({ action: 'clearMessageFlag', id: m.id }, m.id)}><CheckCircle2 size={13} />Clear flag</button>
                    <button className="row-action danger" disabled={pending === m.id} onClick={() => void run({ action: 'deleteMessage', id: m.id }, m.id)}><Trash2 size={13} />Delete</button>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="fine-print">No flagged messages.</p>}
          <PageMore page={flaggedPage} label="More flagged messages" />
        </section>

        <section className="dash-section">
          <h2 className="section-title">Recent works <span className="tab-count">{works.length}</span></h2>
          <table className="analytics-table"><thead><tr><th>Work</th><th>Writer</th><th>Status</th><th>Critiques</th><th></th></tr></thead><tbody>
            {works.map(w => (
              <tr key={w.id}>
                <td><button className="text-link" onClick={() => onOpenStory(w.id)}>{w.title}</button></td>
                <td>{w.author}</td>
                <td>{w.status}</td>
                <td>{w.reviews}</td>
                <td className="admin-actions">
                  {w.status !== 'withdrawn' ? <button className="row-action danger" disabled={pending === w.id} onClick={() => void run({ action: 'withdrawWork', id: w.id }, w.id)}><Trash2 size={13} />Withdraw</button>
                    : <button className="row-action" disabled={pending === w.id} onClick={() => void run({ action: 'restoreWork', id: w.id }, w.id)}><RotateCcw size={13} />Restore</button>}
                </td>
              </tr>
            ))}
          </tbody></table>
          <PageMore page={worksPage} label="More works" />
        </section>
        <AdminCommunityPanel requestCounts={requestCounts} onRead={onOpenStory} onChanged={auditPage.refresh}/>
        <section className="dash-section"><h2 className="section-title">Admin action history</h2><p className="fine-print">Recorded action requests, including reasons and targets. Message bodies and manuscript text are not copied into this log.</p>{auditPage.items.length?<div className="admin-list">{auditPage.items.map(item=><article className="admin-row" key={item.id}><span className="admin-tag">{item.action.replace(/([A-Z])/g,' $1').toLowerCase()}</span><div className="admin-body"><p>{item.reason||item.details||'Status updated'}</p><small>{item.adminName} · {new Date(item.createdAt).toLocaleString()} · {item.targetId}</small></div></article>)}</div>:!auditPage.loading&&!auditPage.error?<p className="fine-print">No admin actions recorded yet.</p>:null}<PageMore page={auditPage} label="Earlier admin actions"/></section>
      </div>
      <Dialog open={!!decision} onOpenChange={value=>{if(!value&&!pending)setDecision(null);}}><DialogContent className="compact-dialog"><DialogTitle>Record this decision</DialogTitle><DialogDescription>{String(decision?.body.action||'').replace(/([A-Z])/g,' $1')} affects this member’s content. Explain why so the decision can be reviewed later.</DialogDescription><label className="field-label">Reason<Textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={5} maxLength={800} rows={4} disabled={!!pending}/></label>{note&&<p className="form-error" role="alert">{note}</p>}<div className="form-actions"><Button variant="outline" disabled={!!pending} onClick={()=>setDecision(null)}>Cancel</Button><Button disabled={!!pending||reason.trim().length<5} onClick={()=>{if(decision)void run({...decision.body,reason:reason.trim()},decision.key);}}>{pending?'Applying…':'Apply decision'}</Button></div></DialogContent></Dialog>
    </div>
  );
}

function SearchPalette({ open, onOpenChange, q, setQ, onSearch, onRead, onAuthor,onCircle }: { open: boolean; onOpenChange: (v: boolean) => void; q:string; setQ:(q:string)=>void; onSearch: (q: string) => void; onRead: (id: string) => void; onAuthor: (id: string) => void;onCircle:(id:string)=>void }) {
  const [result, setResult] = useState({ query: '', data: emptySearch });
  const [error,setError]=useState('');const [more,setMore]=useState('');
  useEffect(() => {
    if (!open || !q.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { fetch('/api/search?q=' + encodeURIComponent(q), { signal: controller.signal }).then(async r => {const d=await r.json() as SearchResults&{error?:string};if(!r.ok)throw new Error(d.error||'Search could not load.');return d;}).then((d) => {if(!controller.signal.aborted){setError('');setResult({ query: q.trim(), data: d as SearchResults });}}).catch(e => { if (!controller.signal.aborted){setError(e.message);setResult({ query: q.trim(), data: emptySearch });} }); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, open]);
  const res = result.query === q.trim() ? result.data : emptySearch;
  const searching = !!q.trim() && result.query !== q.trim();
  const hasResults = res.works.length || res.authors.length || res.circles.length;
  const moreResults=async(section:'works'|'authors'|'circles')=>{const cursor=res.nextCursors?.[section];if(!cursor||more)return;setMore(section);try{const r=await fetch('/api/search?'+new URLSearchParams({q,section,cursor}));const page=await r.json() as {items:SearchResults["works"]|SearchResults["authors"]|SearchResults["circles"];nextCursor:string|null;error?:string};if(!r.ok)throw new Error(page.error);setResult(old=>old.query!==q.trim()?old:{...old,data:{...old.data,[section]:[...old.data[section],...page.items],nextCursors:{...old.data.nextCursors,[section]:page.nextCursor}}});}catch(e){setError((e as Error).message);}finally{setMore('');}};
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="search-dialog" placement="top" showCloseButton={false}>
        <DialogTitle className="sr-only">Search OpenDraft</DialogTitle>
        <DialogDescription className="sr-only">Search writing, writers, and circles</DialogDescription>
        <Command key={q.trim() && result.query === q.trim() ? q.trim() : 'pending'} shouldFilter={false} loop>
          <CommandInput autoFocus aria-label="Search OpenDraft" value={q} onValueChange={setQ} placeholder="Search writing, writers, circles…" />
          <CommandList>
            {!q.trim() && <div className="search-hint"><Search size={22} /><p>Search for a story to critique, a writer to follow, or a circle to join.</p><span className="fine-print">Try a title, a pen name, or a genre.</span></div>}
            {error&&result.query===q.trim()&&<p className="form-error" role="alert">{error}</p>}
            {q.trim() && !hasResults && !searching && !error && <CommandEmpty>{q.trim().length<2?'Type at least two characters.':`No results for “${q}”.`}</CommandEmpty>}
            {searching && !hasResults && <CommandEmpty>Searching…</CommandEmpty>}
            {res.works.length > 0 && <CommandGroup heading="Writing">{res.works.map(w => <CommandItem key={w.id} value={'work-' + w.id} onSelect={() => onRead(w.id)}><FileText size={14} /><span className="cmdk-title">{w.title}</span><span className="cmdk-meta">{w.author} · {readingTimeLabel(w.words)}</span></CommandItem>)}</CommandGroup>}
            {res.authors.length > 0 && <CommandGroup heading="Writers">{res.authors.map(a => <CommandItem key={a.id} value={'author-' + a.id} onSelect={() => onAuthor(a.id)}><User size={14} /><span className="cmdk-title">{a.name}</span>{a.location && <span className="cmdk-meta">{a.location}</span>}</CommandItem>)}</CommandGroup>}
            {res.circles.length > 0 && <><CommandSeparator /><CommandGroup heading="Circles">{res.circles.map(c => <CommandItem key={c.id} value={'circle-' + c.id} onSelect={() => onCircle(c.id)}><Users size={14} /><span className="cmdk-title">{c.name}</span><span className="cmdk-meta">{c.members} members · {c.genre}</span></CommandItem>)}</CommandGroup></>}
            {(['works','authors','circles'] as const).filter(section=>res.nextCursors?.[section]).map(section=><CommandItem key={'more-'+section} value={'more-'+section} disabled={!!more} onSelect={()=>void moreResults(section)}><ChevronDown size={14} /><span>More {section==='authors'?'writers':section==='works'?'writing':'circles'}{more===section?'…':''}</span></CommandItem>)}
            {!!q.trim() && <><CommandSeparator /><CommandGroup heading="Search"><CommandItem value="see-all" onSelect={() => onSearch(q)}><Search size={14} /><span className="cmdk-title">See all results for “{q}”</span></CommandItem></CommandGroup></>}
          </CommandList>
        </Command>
        <div className="search-footer"><span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span><span><Kbd>↵</Kbd> open</span><span><Kbd>Esc</Kbd> close</span></div>
      </DialogContent>
    </Dialog>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['⌘', 'K'], label: 'Open search' },
  { keys: ['H'], label: 'Highlight the selected text' },
  { keys: ['C'], label: 'Comment on the selected text' },
  { keys: ['D'], label: 'Suggest deleting the selected text' },
  { keys: ['I'], label: 'Add an inline addition' },
  { keys: ['⌘', '↵'], label: 'Save an inline comment or addition' },
  { keys: ['Esc'], label: 'Dismiss the inline toolbar' },
  { keys: ['G', 'D'], label: 'Go to Dashboard' },
  { keys: ['G', 'E'], label: 'Go to Critique now' },
  { keys: ['G', 'W'], label: 'Go to Your writing' },
  { keys: ['G', 'M'], label: 'Go to Messages' },
  { keys: ['G', 'A'], label: 'Go to Analytics' },
  { keys: ['G', 'P'], label: 'Go to Your account' },
  { keys: ['?'], label: 'Show this help' },
];

function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="compact-dialog">
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Move quickly through the workshop and critique inline without leaving the page.</DialogDescription>
        <ul className="shortcut-list">{SHORTCUTS.map(s => <li key={s.label}><span className="shortcut-keys">{s.keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</span><span>{s.label}</span></li>)}</ul>
      </DialogContent>
    </Dialog>
  );
}

function GenreBoard({ works, saved, busy, onSave, onRead, onAuthor }: {
  works: Work[]; saved: string[]; busy: boolean;
  onSave: (id: string, savedNow: boolean) => void; onRead: (id: string) => void; onAuthor: (id: string) => void;
}) {
  if (!works.length) return <div className="sheet-body"><Empty title="Nothing here yet." description="Try another search, or check back soon for new work." label="Clear search" action={() => undefined} /></div>;
  const order = genres.slice(1);
  const groups: { genre: string; items: Work[] }[] = [];
  for (const w of works) { const g = groups.find(x => x.genre === w.genre); if (g) g.items.push(w); else groups.push({ genre: w.genre, items: [w] }); }
  groups.sort((a, b) => { const ia = order.indexOf(a.genre), ib = order.indexOf(b.genre); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  return (
    <>
      {groups.map((g, gi) => {
        const featured = g.items.filter(w => w.status === 'spotlight');
        const queue = g.items.filter(w => w.status !== 'spotlight');
        return (
          <section className="genre-section" key={g.genre}>
            <h2 className="group-heading"><span className={'genre-dot tone-' + (gi % 4)} />{g.genre}<span className="group-count">{g.items.length}</span></h2>
            {featured.length > 0 && <div className="work-list" style={{ borderTop: 0 }}>{featured.map(w => <WorkRow key={w.id} featured work={w} saved={saved.includes(w.id)} busy={busy} onSave={() => onSave(w.id, saved.includes(w.id))} onRead={() => onRead(w.id)} onAuthor={onAuthor} />)}</div>}
            {!!queue.length && <QueueBlock items={queue} saved={saved} busy={busy} onSave={onSave} onRead={onRead} onAuthor={onAuthor} />}
          </section>
        );
      })}
    </>
  );
}

function QueueBlock({ items, saved, busy, onSave, onRead, onAuthor }: {
  items: Work[]; saved: string[]; busy: boolean;
  onSave: (id: string, savedNow: boolean) => void; onRead: (id: string) => void; onAuthor: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="queue-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />{open ? 'Hide' : 'See'} {items.length} in queue <span className="half-note">zero credits</span>
      </button>
      {open && <div className="work-list" style={{ borderTop: 0 }}>{items.map(w => <WorkRow key={w.id} work={w} saved={saved.includes(w.id)} busy={busy} onSave={() => onSave(w.id, saved.includes(w.id))} onRead={() => onRead(w.id)} onAuthor={onAuthor} />)}</div>}
    </>
  );
}

function FlatWorkList({ works, saved, busy, onSave, onRead, onAuthor, onReset, empty }: {
  works: Work[]; saved: string[]; busy: boolean; empty: string;
  onSave: (id: string, savedNow: boolean) => void; onRead: (id: string) => void; onAuthor: (id: string) => void; onReset: () => void;
}) {
  if (!works.length) return <div className="sheet-body"><Empty title="Keep a good read for later." description={empty} label="Explore writing" action={onReset} /></div>;
  return <div className="work-list">{works.map(w => <WorkRow key={w.id} work={w} saved={saved.includes(w.id)} busy={busy} onSave={() => onSave(w.id, saved.includes(w.id))} onRead={() => onRead(w.id)} onAuthor={onAuthor} />)}</div>;
}

function WorkRow({ work: w, saved, busy, onSave, onRead, onAuthor, compact, featured }: { work: Work; saved: boolean; busy: boolean; onSave: () => void; onRead: () => void; onAuthor: (id: string) => void; compact?: boolean; featured?: boolean }) {
  const initials = w.author.split(' ').slice(0, 2).map(s => s[0]).join('');
  return (
    <article className={'work-row' + (compact ? ' compact' : '')}>
      <span className="work-thumb">{initials}</span>
      <div className="work-body">
        <button className="work-title" onClick={onRead}>{featured && <span className="room-dot" title="In the reading room">◆</span>}{w.title}</button>
        <div className="work-byline">by <button className="author-link" onClick={() => onAuthor(w.authorId)}>{w.author}</button>{w.authorId.startsWith('sample-') && <span className="tag" style={{ marginLeft: 6 }}>Example</span>}</div>
      </div>
      <div className="work-stats">
        <span className="crit-count"><span className="crit-mark" />{w.reviews}{w.targetReviews ? ` of ${w.targetReviews}` : ''} {w.reviews === 1 && !w.targetReviews ? 'critique' : 'critiques'}</span>
        <span className="words" title="Estimated reading time">{w.words.toLocaleString()} words · {readingTimeLabel(w.words)}</span>
        <span className="tag-row">
          {w.reviews === 0 && w.status === 'spotlight' && <span className="tag first-post">first post!</span>}
          <span className="tag">{w.kind.toLowerCase()}</span>
        </span>
      </div>
      <button disabled={busy} className={'flag-btn' + (saved ? ' is-saved' : '')} aria-label={(saved ? 'Unsave ' : 'Save ') + w.title} aria-pressed={saved} onClick={onSave}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button>
    </article>
  );
}

function Landing({ googleConfigured,emailPasswordConfigured,sourceRepositoryUrl,error }: { googleConfigured: boolean;emailPasswordConfigured:boolean;sourceRepositoryUrl:string; error: string }) {
  const [authOpen,setAuthOpen]=useState(false);
  return (
    <div className="landing">
      <header className="landing-top">
        <span className="app-brand landing-brand">Open<em>Draft</em><b>.</b></span>
        <div className="landing-nav">
          <button className="landing-link" onClick={()=>setAuthOpen(true)}>Sign in</button>
          <Button className="primary-button" onClick={()=>setAuthOpen(true)}>Join OpenDraft</Button>
        </div>
      </header>
      <section className="landing-hero">
        <div className="landing-copy">
          <div className="eyebrow">A LITTLE FEEDBACK. A BETTER NEXT DRAFT.</div>
          <h1>Write. Read. Help someone’s next draft.</h1>
          <p>OpenDraft is a free, open-source writing workshop. Exchange thoughtful, line-level critiques with other writers, earn credits for the feedback you give, and spend them on your own work.</p>
          <div className="landing-actions">
            <Button className="primary-button landing-cta" onClick={()=>setAuthOpen(true)}>Start writing</Button>
            <span className="fine-print">Free with Google or a verified email account.</span>
          </div>
          {error && <p className="auth-setup-note" role="alert"><AlertCircle size={13} />{error}</p>}
          {!googleConfigured && <p className="auth-setup-note"><AlertCircle size={13} />{emailPasswordConfigured?'Google sign-in is unavailable; verified email accounts still work.':'Sign-in is unavailable on this deployment. Local development may use the shared preview account.'}</p>}
          <p className="fine-print">Your first sign-in creates your account with five free credits.</p>
          <p className="fine-print">No subscriptions. No paid credits. Your words are yours.</p>
        </div>
        <div className="landing-card">
          <div className="landing-card-head">The last light in the house</div>
          <p className="landing-card-body">The light in my mother’s kitchen had been on for <mark className="anno anno-highlight">eleven days</mark><ins className="anno anno-insert">, an act of stubborn hope</ins>.</p>
          <p className="landing-card-body">My sister was standing at the sink when I arrived. She had washed the same cup so many times that the painted bird on its side had lost a wing.</p>
          <span className="anno-bubble">This opening image does so much work — I’d keep it.</span>
        </div>
      </section>
      <section className="landing-features">
        <article><h3>Critique inline</h3><p>Highlight a passage, leave a comment, suggest a deletion, or add words directly in the text. Line notes count toward your critique.</p></article>
        <article><h3>A fair exchange</h3><p>Earn credits by giving feedback, then spend them to put your own work in the reading room and find your readers.</p></article>
        <article><h3>Open and free</h3><p>MIT licensed, self-hostable, and built for writers. No ads or paid shortcuts. You keep ownership of your writing.</p></article>
      </section>
      <footer className="landing-foot">OpenDraft · MIT licensed software · <Link href="/rights">Your writing remains yours</Link> · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/contact">Contact</Link>{sourceRepositoryUrl&&<> · <a href={sourceRepositoryUrl} target="_blank" rel="noreferrer">Source code</a></>}</footer>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} googleConfigured={googleConfigured} emailPasswordConfigured={emailPasswordConfigured} returnTo="/#Dashboard"/>
    </div>
  );
}

export function Empty({ title, description, label, action }: { title: string; description: string; label?: string; action?: () => void }) {
  return <div className="empty-state"><BookOpen size={30} /><h2>{title}</h2><p>{description}</p>{label && <Button variant="outline" onClick={action}>{label}</Button>}</div>;
}
