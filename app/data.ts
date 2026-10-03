export const genres = ['All genres', 'Literary fiction', 'Contemporary fiction', 'Fantasy', 'Science fiction', 'Mystery', 'Thriller & horror', 'Romance', 'Historical fiction', 'Poetry', 'Creative nonfiction', 'Drama & screenwriting', 'Other writing'];
export const wordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
export const workKinds = ['Short story', 'Novel excerpt', 'Chapter', 'Poem', 'Flash fiction', 'Vignette', 'Personal essay', 'Creative nonfiction', 'Screenplay', 'Stage play', 'Fanfiction'];
export const workStages = ['First draft', 'Second draft', 'Revision', 'Ready for a final look'];
export const matureThemes = ['Violence', 'Sexual content', 'Strong language', 'Substance use', 'Mental health', 'Death or grief', 'Trauma', 'Discrimination'];
export const writingProcessValues = ['human-only', 'ai-edited', 'ai-collaborative', 'mostly-ai', 'ai-written', 'not-declared'] as const;
export const acceptedWritingProcessValues = [...writingProcessValues, 'ai-assisted'] as const;
export const writingProcessOptions = [
  { value: 'human-only', label: '1 · Human-written', description: 'No generative AI was used to write or rewrite the manuscript.' },
  { value: 'ai-edited', label: '2 · Human-written, AI-edited', description: 'The manuscript is human-written; generative AI helped polish, rephrase, or copyedit it.' },
  { value: 'ai-collaborative', label: '3 · Human-led, AI-assisted', description: 'The writer led the work, with generative AI contributing ideas, passages, or structural help.' },
  { value: 'mostly-ai', label: '4 · Mostly AI-written, human-edited', description: 'Generative AI produced most of the draft, and a person substantially selected, revised, or shaped it.' },
  { value: 'ai-written', label: '5 · AI-written', description: 'Generative AI produced essentially all of the manuscript.' },
  { value: 'not-declared', label: 'Not declared', description: 'The writer has chosen not to describe the manuscript’s writing process.' },
] as const satisfies ReadonlyArray<{ value: typeof writingProcessValues[number]; label: string; description: string }>;
export type WritingProcess = typeof acceptedWritingProcessValues[number];
export const writingProcessDescription = (value?: WritingProcess) => {
  if (value === 'ai-assisted') return 'Writer disclosed generative-AI assistance in this manuscript.';
  const option = writingProcessOptions.find(item => item.value === (value || 'not-declared')) || writingProcessOptions.at(-1)!;
  return value === 'human-only' ? 'Writer says this manuscript was written without generative AI.' : option.description;
};
export const formatCredits = (n: number) => { const v = Math.round(n * 1000) / 1000; return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))); };
export const readingTime = (words: number) => Math.max(1, Math.ceil((words || 0) / 225));
export const readingTimeLabel = (words: number) => `${readingTime(words)} min read`;
export const streakLabel = (current: number, longest: number) => current > 0 ? `${current}-day streak` : longest > 0 ? `Best: ${longest} days` : 'No streak yet';
export type Work = {revisionOf?:string|null;showcaseOptIn?:boolean;aiShowcaseConsent?:boolean;aiProcess?:WritingProcess;id:string; authorId:string; author:string; title:string; genre:string; kind:string; stage:string; content:string; request:string; status:string; reviews:number; version:number; createdAt:number; words:number; warning:string; mature?:boolean; themes?:string; targetReviews?:number; critiqueVisibility?:string;bookmarked?:boolean;hasReviewed?:boolean;queuePosition?:number};
export type Review = {id:string;workId:string;userId:string;author:string;strengths:string;suggestions:string;overall:string;annotation:string;quote:string;processDisclosure?:'human-only'|'assistive-tools'|'not-declared';attested?:boolean;createdAt:number;version:number};
export type Circle = {id:string;name:string;description:string;genre:string;members:number;joined?:boolean;ownerId?:string};
export type AnnotationKind = 'delete' | 'insert' | 'highlight' | 'comment';
export type WorkAnnotation = {id:string;reviewId?:string;workId:string;userId:string;author:string;kind:AnnotationKind;quote:string;body:string;para:number;start:number;end:number;writerStatus?:'open'|'resolved'|'kept'|'not-this-draft';writerResponse?:string;createdAt:number};
export type Analytics = {totalReads:number;uniqueReaders:number;works:{workId:string;title:string;words:number;views:number;readers:number}[];age:Record<string,number>;sex:Record<string,number>;locations:Record<string,number>;recentReaders:{name:string;age:number|null;sex:string;location:string;views:number;lastViewedAt:number}[]};
export type AuthorProfileData = {profile:{avatarUpdatedAt?:number;id:string;name:string;bio:string;credits:number;createdAt:number;age:number|null;sex:string;location:string;interests:string;currentStreak?:number;longestStreak?:number};stats:{works:number;words:number;critiquesGiven:number;helpfulReceived:number;readers:number;currentStreak?:number;longestStreak?:number};works:{id:string;title:string;genre:string;kind:string;stage:string;words:number;status:string;createdAt:number;reviews:number}[];circles:{id:string;name:string;description:string;genre:string;members:number}[]};
export type AdminFeedback = {id:string;userId:string;email:string;kind:string;body:string;page:string;status:string;createdAt:number};
export type AdminReport = {id:string;userId:string;workId:string;reason:string;status?:string;resolution?:string;resolvedAt?:number;createdAt:number;workTitle?:string;workAuthor?:string};
export type AdminOverview = {counts:{members:number;works:number;worksByStatus:Record<string,number>;readingRoom:number;queued:number;reviews:number;messages:number;flaggedMessages:number;reports:number;openFeedback:number};reports:AdminReport[];feedback:AdminFeedback[];works:{id:string;title:string;author:string;status:string;words:number;createdAt:number;reviews:number}[];flaggedMessages:{id:string;sender:string;recipient:string;body:string;flagged:number;createdAt:number}[];queues:{genre:string;readingRoom:number;queue:number}[]};
export type SearchResults = {works:{id:string;title:string;author:string;authorId:string;genre:string;kind:string;words:number;status:string;reviews:number}[];authors:{id:string;name:string;bio?:string;location?:string;interests?:string}[];circles:{id:string;name:string;description:string;genre:string;members:number}[];nextCursors?:Partial<Record<'works'|'authors'|'circles',string|null>>};
export type WorkMessage = {id:string;senderId:string;sender:string;recipientId:string;recipient:string;body:string;flagged:number;readAt:number|null;createdAt:number;kind?:'direct'|'bulletin';circleId?:string;circleName?:string;conversationId?:string;name?:string;unread?:number};
const stories = [
 {id:'the-last-light',author:'Clara Bennett',title:'The last light in the house',genre:'Literary fiction',kind:'Short story',stage:'Second draft',request:'Does the opening pull you in? I’m especially interested in pacing and the relationship between the sisters.',content:`The light in my mother's kitchen had been on for eleven days. From the road it looked like a promise, small and yellow and impossible to keep.

My sister was standing at the sink when I arrived. She had washed the same cup so many times that the painted bird on its side had lost a wing. We had not spoken since the funeral, which meant we had not spoken properly in three years.

"You're late," she said.

I put my suitcase by the radiator. It was October, but the house still held the summer in its walls. Our mother had always said that old houses remembered the weather. I used to think this was something people said when they could not afford insulation.

"The train stopped outside Newark."

She turned the tap off. In the sudden quiet, I could hear the refrigerator starting up, the old loose rattle that had accompanied every breakfast of our childhood.

"I didn't mean today."

There were boxes on the table, labeled in her careful hand. KEEP. DONATE. ASK ELLIE. My name was written on the smallest box. Inside were three photographs, a ceramic dog with one ear missing, and an envelope that had been sealed and opened and sealed again.

"What's this?"

"She wanted you to have it."

I held the envelope against the kitchen light. There was something inside besides paper, something with a hard edge. A key, perhaps. Our mother had collected keys to places that no longer existed: the flat above the bakery, a storage locker in Providence, the office where she had worked before either of us was born.

"Did you read it?"

My sister picked up the cup. "She wanted you to have it," she repeated.

Outside, the neighbor's dog began its evening argument with the dark. I sat in my mother's chair and put the envelope on the table. For the first time since I had arrived, my sister sat down too.

Neither of us reached for the light.`},
 {id:'atlas-of-elsewhere',author:'Julian Park',title:'An atlas of elsewhere',genre:'Fantasy',kind:'Novel excerpt',stage:'First draft',request:'Is the magic clear without too much explanation? I’d love thoughts on voice and worldbuilding.',content:`Every map in the shop was wrong. This was the first thing Mara learned on her first morning, and the second was that she must never correct one.

"The city moves," said the cartographer, measuring a street that had not existed yesterday. "Our customers prefer not to think about it."

Mara glanced at the window. Outside, a woman was arguing with a bridge. The bridge seemed to be winning.

Her apprenticeship contract had promised reasonable hours, a hot lunch, and instruction in the noble art of geography. It had said nothing about streets that sulked or bridges that insisted on being addressed as Your Grace. She had signed anyway. The alternative was her father's tannery, where even the lunch smelled of skins.

The cartographer slid a blank sheet toward her. "Draw the way you came."

She drew the station, the square, the narrow passage behind the fish market. She drew the steps she had climbed and the green door she had knocked upon. When she finished, the ink began to crawl.

"Don't touch it."

The passage straightened. The square became a circle. The station folded itself neatly into the corner of the page, as if embarrassed to be noticed.

"What did I do wrong?"

"You remembered honestly. Most people improve things in the telling. A wider street. A shorter walk. You gave the city nothing to argue with."

He looked at her then, really looked, and Mara felt the peculiar discomfort of becoming interesting to someone who had not expected her to be.

The ink stopped moving. On the page, where she had drawn the shop, there was now a small black lake.

The cartographer locked the door.

"I think," he said, "we shall have lunch early."`},
 {id:'between-stations',author:'Amara Okafor',title:'Between stations',genre:'Poetry',kind:'Poem',stage:'Revision',request:'Looking for feedback on imagery and line breaks. Does the final stanza earn its place?',content:`My father carried silence
in the pocket of his coat,
next to the folded timetable
for a train he never took.

At dinner we passed the salt
and the weather between us.
I learned to ask small questions,
ones that fit inside a yes.

Once, on the platform,
he pointed to a bird
balancing on a wire.
He said nothing about balance.

The train came like a long breath.
He pressed a ticket into my hand.
I kept it after the journey,
after the coat was given away.

Now when the house goes quiet
I listen for the platform,
for the small bright weight
of something almost said.`},
 {id:'things-we-carried',author:'Sofia Reyes',title:'The things we carried home',genre:'Creative nonfiction',kind:'Personal essay',stage:'Second draft',request:'Is the emotional arc clear? I want this to feel specific, without needing to explain my entire family history.',content:`We packed the oranges first. My grandmother wrapped each one in newspaper, turning it slowly in her hands as though she were dressing a child for cold weather. We were flying home in the morning. She knew we could not bring fruit across the border. She packed them anyway.

The kitchen smelled of coffee and the small wood stove she still used, even though my uncle had bought her a gas range the previous Christmas. The new stove stood in the corner with a lace cloth over it. On top she had arranged the photographs of all the grandchildren who lived somewhere else.

I was twenty-three and impatient with the practical difficulties of love. I explained the rules. I explained customs. I explained that there were oranges in Chicago.

"These are from the tree," she said.

The tree was older than my mother. It grew at an angle over the courtyard, giving shade to the place where we washed clothes, peeled potatoes, celebrated birthdays. As a child I had thought every house contained a tree at its center. I did not know this was a kind of wealth.

She tucked a final orange into my suitcase between two sweaters. The newspaper was dated three months earlier. An election had happened, a bridge had opened, a man had been found alive after being missing for seventeen years. The world had been busy while this orange grew.

At the airport I removed the fruit before the inspection. I found a bin near the entrance and stood there with the suitcase open, feeling absurdly like someone who had lost an argument she had won.

I kept the newspaper. For years, folded between the pages of a book I never finished, it smelled faintly of home.`},
 {id:'signal-delay',author:'Theo Morgan',title:'A reasonable signal delay',genre:'Science fiction',kind:'Short story',stage:'First draft',request:'Does the concept make sense? I’m working on making the technical details feel natural.',content:`The message from Earth arrived six minutes after Lena's birthday ended. She watched the little notification pulse on the console and let it pulse. For nine years the delay had been growing. At first it was a few seconds, easy to mistake for hesitation. Now it was twenty-three days.

Her brother's face appeared against the old wallpaper of their mother's sitting room. He had cut his hair. Behind him there was a lamp she did not recognize.

"Happy birthday," he said. "I think this should get there in time."

It had not, but she smiled anyway. The ship maintained its own calendar, adjusted for acceleration and the stubborn requirements of payroll. She was thirty-four according to the navigation computer and thirty-seven according to the pension office. Her brother was aging at a third rate, the uninteresting one imposed by Earth.

He talked about the garden. A fox had moved under the shed. Their mother had named it Bernard and was leaving out leftovers, which he said was inadvisable, but he looked happy saying it.

Lena recorded her reply with the observation shutter closed. She had stopped sending views of space. At first the darkness had looked impressive, then lonely, then merely the same. You could only show people the same emptiness so many times before they started seeing you in it.

"The birthday was good," she said. "We had cake."

They had not had cake. Someone had made a protein bar round and stuck a light in it. It had been a kind gesture, and Lena was tired of translating kindness into accurate terms.

She told him to say hello to Bernard. By the time the message arrived, the fox would have a new litter, or the shed would have fallen down, or their mother would have found something else to love.

She pressed send. The console calculated the distance. For a moment, before the estimate appeared, her brother felt close.`},
 {id:'room-number-four',author:'Ellis Hart',title:'The occupant of room four',genre:'Mystery',kind:'Novel excerpt',stage:'Second draft',request:'Are the clues subtle enough? Please tell me when you first begin to suspect the narrator.',content:`The guest in room four asked for an extra towel on Tuesday. On Wednesday he asked for a second glass. On Thursday he disappeared, leaving both items folded neatly on the bed.

I know a glass cannot be folded. This is the part of the statement the officer keeps returning to. It was wrapped in the towel, I explain, and the towel was folded. We all take shortcuts when we tell stories. Apparently the police prefer the scenic route.

The boarding house has seven rooms and six keys. Room four's lock was broken when my father bought the place, and he never repaired it. He said people would behave better if they knew they could not lock a door. My father was wrong about many things, but I kept this one out of sentiment.

The officer wants to know who else was staying that week. I give her the names from the book. She wants to know who was in the building on Thursday morning. I tell her what I remember. She asks if those are different questions.

"Of course," I say. "Some people write down the names they wish they had."

She looks at the registration book again. The guest in room four wrote William Price, in blue ink. He paid in cash and asked no questions about breakfast. When I showed him upstairs, he looked at the unpainted patch above the landing and said he liked what we had done with the place.

He had never been here before. That is what I told the officer, and that is what she wrote down.

Outside, a car door closes. The officer pauses. I notice she has brought two glasses of water, though only one of us has been drinking.

"Let's go over Thursday again," she says.`}
];
export const sampleWorks:Work[] = stories.map((s,i)=>({...s,authorId:`sample-${i}`,status:i<4?'spotlight':'queued',reviews:0,version:1,createdAt:Date.UTC(2026,9,2)-i*3600000,words:wordCount(s.content),warning:''}));
export const sampleCircles:Circle[]=[{id:'fiction-room',name:'The Fiction Room',description:'Characters that stay with you. Sentences that do the same. A circle for literary fiction.',genre:'Literary fiction',members:0},{id:'worldbuilders',name:'Worldbuilders’ Corner',description:'For impossible worlds and the people who make them believable.',genre:'Fantasy',members:0},{id:'poetry-table',name:'The Poetry Table',description:'A little space for close reading, surprising images, and finding the right line.',genre:'Poetry',members:0}];
