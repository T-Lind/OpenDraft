// Isolated UI fixture: no real accounts, database writes, or external requests.
import {build} from 'esbuild';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
const directory='.sites-runtime/ui-fixture';mkdirSync(directory,{recursive:true});
writeFileSync(`${directory}/entry.tsx`, `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AnnotatedManuscript} from '../../app/workshop-views';
import {Onboarding} from '../../app/onboarding';
import {WriterAvatar} from '../../components/writer-avatar';
import {annotationHistory,editAnnotations,undoAnnotations,redoAnnotations} from '../../lib/annotation-history';
function Fixture(){
 const [history,setHistory]=useState(()=>annotationHistory<any>()),[setup,setSetup]=useState(false);
 const user={id:'ui-fixture',name:'Google Real Name',credits:5,bio:'',onboardingCompleted:false};
 return <main style={{maxWidth:850,margin:'40px auto',padding:20}}><h1>Isolated workshop UI check</h1><p>No live accounts or database writes.</p><button onClick={()=>setSetup(!setup)}>{setup?'Line notes':'Profile setup'}</button><WriterAvatar name="Theo Morgan" />
 {setup?<Onboarding user={user} busy={false} error="" onComplete={()=>{}} act={async()=>true}/>:<AnnotatedManuscript content="A quiet blue morning waits beyond the window. The writer takes a breath and begins again." isPoem={false} annotations={history.present} canAnnotate onAdd={a=>setHistory(h=>editAnnotations(h,[...h.present,{...a,id:'local-'+crypto.randomUUID(),author:'Test Writer',userId:user.id,workId:'fixture',createdAt:Date.now()}]))} onRemove={id=>setHistory(h=>editAnnotations(h,h.present.filter(a=>a.id!==id)))} canUndo={!!history.past.length} canRedo={!!history.future.length} onUndo={()=>setHistory(undoAnnotations)} onRedo={()=>setHistory(redoAnnotations)} />}
 </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);`);
await build({entryPoints:[`${directory}/entry.tsx`],outfile:`${directory}/fixture.js`,bundle:true,format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'fixture-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'import React from "react";export default function Link(props){return React.createElement("a",props)}',loader:'js',resolveDir:resolve('.')}));}}]});
const html='<!doctype html><html><head><title>Workshop UI fixture</title><link rel="stylesheet" href="/styles.css"><style>body{background:#faf9f6}button{cursor:pointer;padding:6px 10px} .reader-text{font-size:20px;line-height:1.8;margin-top:30px}.annotate-hint{margin-top:25px}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
createServer((req,res)=>{
 if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(`${directory}/fixture.js`));}
 else if(req.url==='/styles.css'){res.setHeader('Content-Type','text/css');res.end(readFileSync('app/globals.css','utf8').replace(/^@import.*$/gm,''));}
 else{res.setHeader('Content-Type','text/html');res.end(html);}
}).listen(5181,'127.0.0.1',()=>console.log('Isolated UI fixture: http://127.0.0.1:5181'));
