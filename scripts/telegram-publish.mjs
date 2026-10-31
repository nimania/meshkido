// MeshkiDo Telegram: Meshki Media-style photo + title + summary + hashtags + site link.
// First run seeds all historical items without flooding the channel.
// Only post after the site deploy succeeds. Separate bot, channel and receipts from Meshki Media.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const DATA=new URL('../data/',import.meta.url);
const STATE=new URL('telegram-posted.json',DATA);
const ROOT='https://nimania.github.io/meshkido/';
const TOKEN=(process.env.MESHKIDO_TELEGRAM_BOT_TOKEN||'').trim();
const CHAT=(process.env.MESHKIDO_TELEGRAM_CHAT||'').trim();
const DRY=process.argv.includes('--dry-run');
const MAX=Math.max(1,Math.min(12,Number(process.env.MESHKIDO_TELEGRAM_MAX||6)||6));
const GAP_MS=3500;
const HOUR=3600000;
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const escape=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const hash=s=>createHash('sha256').update(String(s)).digest('hex').slice(0,24);
const hashtag=s=>clean(s).replace(/[()«».,،؛:!?"'\-–—/\\]+/g,' ').replace(/\s+/g,'_').replace(/^_+|_+$/g,'');
function dateStamp(s){const t=Date.parse(s||'');return Number.isFinite(t)?t:0;}
export function makeEntries(updates,episodes,shows,now=Date.now()){
 const bySlug=new Map(shows.map(x=>[x.slug,x]));
 const output=[];
 for(const item of updates){
   const s=bySlug.get(item.series);
   if(!s||!item.title||!/^https:\/\//.test(item.source||''))continue;
   // Do not turn old hand-edited news into channel posts; imported archive is seeded anyway.
   const date=dateStamp(item.publishedAt||item.date);
   if(!date||date>now+2*HOUR)continue;
   const id='news:'+hash([item.series,clean(item.title).toLowerCase(),item.source].join('|'));
   output.push({id,type:'news',date,title:clean(item.title),summary:clean(item.summary),
     show:s,source:item.source,site:ROOT+'news/',image:s.artwork?.src||'',
     label:'📰 خبر سریال'});
 }
 for(const ep of episodes){
   const s=bySlug.get(ep.series);
   if(!s||!Number.isInteger(ep.number)||!ep.releasedAt||!/^https:\/\//.test(ep.source?.url||''))continue;
   const date=dateStamp(ep.releasedAt);
   if(!date||date>now+2*HOUR)continue;
   const page=ROOT+'series/'+encodeURIComponent(ep.series)+'/episode/'+
     (ep.season&&ep.season!==1?'season-'+ep.season+'-':'')+ep.number+'/';
   output.push({id:'episode:'+ep.series+':'+(ep.season||1)+':'+ep.number,type:'episode',date,
     title:'قسمت '+ep.number+' سریال «'+s.title+'» منتشر شد',
     summary:clean(ep.summary)||'انتشار این قسمت بر اساس منبع ثبت‌شده تأیید شده است.',
     show:s,source:ep.source.url,site:page,image:ep.image?.src||s.artwork?.src||'',
     label:'🎬 قسمت تازه'});
 }
 return [...new Map(output.map(x=>[x.id,x])).values()].sort((a,b)=>a.date-b.date);
}
export function caption(item){
 const tags=['#مشکیدو','#سریال_ایرانی','#'+hashtag(item.show.title)].filter(x=>x.length>1).join(' ');
 const title=escape(item.title);
 const tail='\n\n'+tags+'\n\n🔗 <a href="'+escape(item.site)+'">ادامه در مشکیدو</a>'+
   '\nمنبع: <a href="'+escape(item.source)+'">'+escape(item.type==='news'?'خبر اصلی':'اطلاعیه انتشار')+'</a>';
 const base=item.label+'\n\n<b>'+title+'</b>\n\n';
 const room=Math.max(0,990-base.length-tail.length);
 const summary=escape(item.summary).slice(0,room);
 return base+summary+(summary.length<escape(item.summary).length?'…':'')+tail;
}
async function save(state){
 const tmp=new URL('telegram-posted.json.tmp',DATA);
 await writeFile(tmp,JSON.stringify(state,null,2)+'\n','utf8');
 await rename(tmp,STATE);
}
async function send(method,data){
 const res=await fetch('https://api.telegram.org/bot'+TOKEN+'/'+method,{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),
   signal:AbortSignal.timeout(30000)});
 const body=await res.json().catch(()=>({}));
 return {ok:res.ok&&body.ok,code:res.status,retry:body.parameters?.retry_after||0,error:body.description||''};
}
async function post(item){
 const message=caption(item);
 if(/^https:\/\//.test(item.image)&&message.length<=1024){
   const photo=await send('sendPhoto',{chat_id:CHAT,photo:item.image,caption:message,parse_mode:'HTML'});
   if(photo.ok||photo.retry)return photo;
 }
 return send('sendMessage',{chat_id:CHAT,text:message,parse_mode:'HTML',link_preview_options:{is_disabled:false}});
}
async function main(){
 const [updates,episodes,series]=await Promise.all([
   readFile(new URL('updates.json',DATA),'utf8').then(JSON.parse),
   readFile(new URL('episodes.json',DATA),'utf8').then(JSON.parse),
   readFile(new URL('series.json',DATA),'utf8').then(JSON.parse)]);
 const entries=makeEntries(updates,episodes.episodes,series.shows);
 let state;
 try{state=JSON.parse(await readFile(STATE,'utf8'))}catch{}
 // Seed before checking secrets to ensure the historical backlog is never blasted later.
 if(!state||!Array.isArray(state.posted)){
   console.log('Telegram first run: seeding '+entries.length+' existing entries, sending none.');
   if(!DRY)await save({posted:entries.map(x=>x.id),seeded:true,updated:new Date().toISOString()});
   return;
 }
 if(!TOKEN||!CHAT){
   console.log('Telegram: bot/channel secrets not configured; no messages sent.');
   return;
 }
 // A seeded archive should not leave a new channel completely empty.
 // Publish exactly one clearly dated introductory news item; never repost the backlog.
 if(!state.launchPostSentAt){
   const lead=entries.filter(x=>x.type==='news'&&Date.now()-x.date<=14*24*HOUR)
     .sort((a,b)=>b.date-a.date)[0];
   if(lead){
     const intro={...lead,label:'📰 آغاز خبررسانی مشکیدو | خبر آرشیوی '+new Date(lead.date).toISOString().slice(0,10)};
     if(DRY){
       console.log('DRY initial channel news post:\\n'+caption(intro));
     }else{
       let result=await post(intro);
       if(!result.ok&&result.retry){
         await new Promise(resolve=>setTimeout(resolve,(result.retry+1)*1000));
         result=await post(intro);
       }
       if(!result.ok){
         console.error('Initial MeshkiDo Telegram post failed:',result.code,result.error);
         process.exitCode=1;
         return;
       }
       state.launchPostSentAt=new Date().toISOString();
       state.updated=state.launchPostSentAt;
       await save(state);
       console.log('Telegram: initial, dated source-linked news published.');
     }
   } else {
     console.log('Telegram: no verified news from last 14 days for introductory post.');
   }
 }
 const posted=new Set(state.posted);
 // Only recent items; a backlog after an outage is deliberately limited to 72h.
 const recent=entries.filter(x=>!posted.has(x.id)&&Date.now()-x.date<72*HOUR).slice(0,MAX);
 let sent=0,failed=0;
 for(const [index,item] of recent.entries()){
   if(DRY){console.log('DRY '+item.id+'\n'+caption(item));continue;}
   let result=await post(item);
   if(!result.ok&&result.retry){
     await new Promise(resolve=>setTimeout(resolve,(result.retry+1)*1000));
     result=await post(item);
   }
   if(!result.ok){
     failed++;console.warn('Telegram delivery failed:',item.id,result.code,result.error);
     if([401,403].includes(result.code))break;
     continue;
   }
   sent++;state.posted.push(item.id);
   state.posted=state.posted.slice(-2500);
   state.updated=new Date().toISOString();
   await save(state);
   if(index<recent.length-1)await new Promise(resolve=>setTimeout(resolve,GAP_MS));
 }
 console.log(JSON.stringify({new:recent.length,sent,failed,channel:CHAT}));
 if(failed)process.exitCode=1;
}
if(import.meta.url===new URL('file://'+process.argv[1]).href)await main();
