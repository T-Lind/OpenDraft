import {database} from '@/db/storage';
import {readEnv} from '@/lib/auth';
import {enqueueReadingReminders,deliverWorkEmails} from '@/lib/work-updates';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
 const secret=readEnv('CRON_SECRET');if(!secret||request.headers.get('Authorization')!=='Bearer '+secret)return Response.json({error:'Unauthorized.'},{status:401});
 try{const db=database();const reminders=await enqueueReadingReminders(db);return Response.json({reminders:reminders.meta.changes,...await deliverWorkEmails(db)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Work update processing will retry.'},{status:503});}
}
