import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
(function(fs,path,crypto){
  const ROOT='/meshkido/';
  const DOMAIN='https://nimania.github.io';
  const OUT='dist';
  const S=JSON.parse(fs.readFileSync('data/series.json','utf8'));
  const U=JSON.parse(fs.readFileSync('data/updates.json','utf8'));
  const E=JSON.parse(fs.readFileSync('data/episodes.json','utf8'));
  const P=JSON.parse(fs.readFileSync('data/platforms.json','utf8'));
  const EP=E.episodes;
  const WEEK=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fa=n=>new Intl.NumberFormat('fa-IR').format(n);
  const href=(p='')=>ROOT+p;
  const link=(p,label,cls='')=>`<a href="${href(p)}" class="${cls}">${esc(label)}</a>`;
  const unique=[...new Set(S.shows.map(s=>s.slug))];
  if(unique.length!==S.shows.length)throw Error('Duplicate series slug');
  for(const s of S.shows){
    if(!/^[a-z0-9-]+$/.test(s.slug)||!s.title||!s.platform||!['در حال پخش','تمام‌شده','متوقف'].includes(s.status)||!Array.isArray(s.days)||s.days.some(d=>!Number.isInteger(d)||d<0||d>6)||!s.sources?.length||s.sources.some(x=>!/^https:\/\//.test(x.url)))throw Error('Invalid series data: '+s.slug);
  }
  const bySlug=new Map(S.shows.map(s=>[s.slug,s]));
  for(const u of U){if(!bySlug.has(u.series)||!/^https:\/\//.test(u.source))throw Error('Invalid news: '+u.title);}
  const active=S.shows.filter(s=>s.status==='در حال پخش');
  const byEpisode=new Map();
  for(const ep of EP){if(!bySlug.has(ep.series)||!Number.isInteger(ep.number)||ep.number<=0||!/^https:\/\//.test(ep.source?.url)||ep.releasedAt!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(ep.releasedAt))throw Error('Invalid verified episode '+ep.series+' '+ep.number);const key=ep.series+'#'+(ep.season||1)+'#'+ep.number;if(byEpisode.has(key))throw Error('Duplicate episode '+key);byEpisode.set(key,ep);}
  const episodePath=e=>'series/'+e.series+'/episode/'+(e.season&&e.season!==1?'season-'+e.season+'-':'')+e.number+'/';
  const seriesEpisodes=s=>EP.filter(e=>e.series===s.slug).sort((a,b)=>b.number-a.number);
  const people=new Map();
  for(const s of S.shows)for(const name of s.cast||[]){if(!people.has(name))people.set(name,[]);people.get(name).push(s);}
  const actorId=n=>'person-'+crypto.createHash('sha1').update(n).digest('hex').slice(0,12);
  const actorHref=n=>href('actors/'+actorId(n)+'/');
  const nav=[['','خانه'],['series/','سریال‌ها'],['schedule/','تقویم'],['news/','اخبار'],['actors/','بازیگران'],['platforms/','پلتفرم‌ها'],['about/','دربارهٔ پروژه']];
  const sourceLink=s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)} <span aria-hidden="true">↗</span></a>`;
  const dayText=s=>s.days.length?s.days.map(d=>WEEK[d]).join('، '):'هنوز اعلام نشده';
  const timeText=s=>s.time?'ساعت '+s.time:'ساعت تأیید نشده';
  function meta(title,description,permalink){
    let u=DOMAIN+href(permalink);
    return `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(title)} | مشکی‌دو</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(u)}"><meta property="og:type" content="website"><meta property="og:site_name" content="مشکی‌دو"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(u)}"><meta property="og:locale" content="fa_IR"><meta property="og:image" content="${DOMAIN+href('assets/meshkido-logo.webp')}"><meta property="og:image:alt" content="لوگوی قرمز و مشکی مشکی‌دو"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${DOMAIN+href('assets/meshkido-logo.webp')}"><link rel="icon" type="image/png" sizes="128x128" href="${href('assets/meshkido-favicon.png')}"><link rel="apple-touch-icon" href="${href('assets/meshkido-favicon.png')}"><link rel="stylesheet" href="${href('styles.css')}"><script src="${href('ui.js')}" defer></script></head>`;
  }
  function shell(title,desc,permalink,content,current=''){
    const menu=nav.map(([p,n])=>`<a href="${href(p)}" ${p===current?'aria-current="page"':''}>${esc(n)}</a>`).join('');
    const layout=`<header class="site-header"><div class="container header-inner"><a href="${href()}" class="brand"><span class="brand-logo"><img src="${href('assets/meshkido-logo.webp')}" alt="" width="92" height="48"></span><span class="brand-name"><strong>مشکی‌دو</strong><small>دنیای سریال‌های ایرانی</small></span></a><div class="header-actions"><button id="theme-toggle" class="theme-toggle" type="button" aria-label="تغییر حالت نمایش">◐</button></div></div><nav class="site-nav container" aria-label="منوی اصلی">${menu}</nav></header><main id="main" class="container">${content}</main><footer class="site-footer"><div class="container footer-content"><div><strong>مشکی‌دو</strong><p>مرجع مستقل سریال‌های در حال پخش ایران • فاز نخست</p></div><p>آخرین بررسی تحریریه: ${esc(S.checkedAtFa)}<br>اطلاعات با ذکر منبع منتشر شده‌اند؛ زمان‌بندی هفتگی تضمین انتشار هر قسمت نیست.</p><div>${link('about/','روش کار و منابع')}</div></div></footer>`;
    const schema={'@context':'https://schema.org','@type':'WebSite',name:'مشکی‌دو',url:DOMAIN+ROOT,inLanguage:'fa'};
    return '<!doctype html><html lang="fa" dir="rtl">'+meta(title,desc,permalink)+'<body><a class="skip-link" href="#main">رفتن به محتوا</a>'+layout+'<script type="application/ld+json">'+JSON.stringify(schema)+'</script></body></html>';
  }
  function heading(kicker,title,more='',target=''){return `<div class="section-head"><div><span class="kicker">${esc(kicker)}</span><h2>${esc(title)}</h2></div>${more?link(target,more,'text-link'):''}</div>`}

  const platformMark=(platform,small=true)=>{
    const p=P[platform]||{color:'#64748b',text:'#fff',label:platform};
    return `<span class="platform-mark ${small?'platform-small':''}" style="--platform-color:${esc(p.color)};--platform-ink:${esc(p.text)}">${p.logo?`<img src="${esc(p.logo)}" alt="نشان ${esc(platform)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${esc(p.label)}</span>`:`<span>${esc(p.label)}</span>`}</span>`;
  };
  function cover(s,large=false){
    const p=P[s.platform]||{color:s.color};
    const img=s.artwork?.src?`<img class="poster-photo" src="${esc(s.artwork.src)}" alt="تصویر تبلیغاتی سریال ${esc(s.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('poster-image-failed')">`:'';
    return `<div class="poster ${large?'poster-large':''} ${img?'has-photo':''}" style="--tone:${esc(s.color)};--platform-color:${esc(p.color)}">${img}<span class="poster-orbit orbit-one"></span><span class="poster-orbit orbit-two"></span><span class="poster-label">MESH KIDO / ${esc(s.type)}</span><strong>${esc(s.title)}</strong><span class="poster-bottom">${platformMark(s.platform)}</span></div>`;
  }
  function seriesCard(s){
    const latest=seriesEpisodes(s)[0];
    return `<a class="series-card" href="${href('series/'+s.slug+'/')}" data-series-card data-search="${esc([s.title,s.alt,s.platform,s.director,...(s.cast||[])].join(' ').toLowerCase())}" data-kind="${esc(s.type)}" data-platform="${esc(s.platform)}" style="--platform-color:${esc(P[s.platform]?.color||s.color)}">${cover(s)}<div class="series-card-body"><div class="mini-label"><span class="live-dot"></span>${esc(s.status)} · ${esc(s.platform)}</div><h3>${esc(s.title)}</h3><p>${esc(s.genres.join(' / '))}</p><div class="card-schedule">${esc(dayText(s))}${s.time?' · '+esc(s.time):''}</div>${latest?`<div class="last-episode">آخرین قسمت ثبت‌شده: ${fa(latest.number)} ${latest.dateFa?' · '+esc(latest.dateFa):''}</div>`:''}</div></a>`;
  }
  function filter(){
    return `<div class="filter-toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input id="series-search" type="search" placeholder="جستجوی سریال، بازیگر، کارگردان..." aria-label="جستجو در فهرست سریال‌ها"></label><div class="segmented" role="group" aria-label="نوع پخش"><button class="filter-btn active" type="button" data-kind-filter="همه" aria-pressed="true">همه</button><button class="filter-btn" type="button" data-kind-filter="نمایش خانگی" aria-pressed="false">نمایش خانگی</button><button class="filter-btn" type="button" data-kind-filter="تلویزیون" aria-pressed="false">تلویزیون</button></div><select id="platform-filter" aria-label="فیلتر پلتفرم"><option value="همه">همهٔ پلتفرم‌ها</option>${[...new Set(active.map(s=>s.platform))].sort().map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select></div><p class="results-count" aria-live="polite" id="series-count">${fa(active.length)} سریال در این فهرست</p>`;
  }
  function newsCard(u){
    const s=bySlug.get(u.series);
    return `<article class="news-card"><div class="news-top"><span class="news-date">${esc(u.dateFa)}</span><span class="news-platform">${esc(s.platform)}</span></div><h3><a href="${href('series/'+s.slug+'/')}">${esc(u.title)}</a></h3><p>${esc(u.summary)}</p><div class="news-bottom">${link('series/'+s.slug+'/', 'پروندهٔ '+s.title, 'text-link')}<a href="${esc(u.source)}" class="text-link" target="_blank" rel="noopener noreferrer">منبع: ${esc(u.sourceName)} ↗</a></div></article>`;
  }
  const recent=[...active].sort((a,b)=>b.started.localeCompare(a.started)).slice(0,3);
  const days=WEEK.map((name,d)=>({name,d,items:active.filter(s=>s.days.includes(d))}));

  function scheduleRow(s){
    return `<a class="week-episode" href="${href('series/'+s.slug+'/')}" style="--platform-color:${esc(P[s.platform]?.color||s.color)}">${cover(s)}<span class="week-episode-info"><strong>${esc(s.title)}</strong><small>${platformMark(s.platform)}<span>${s.time?'ساعت '+esc(s.time):'زمان اعلام نشده'}</span></small></span><span class="week-arrow">←</span></a>`;
  }
  function weeklyBoard(){
    const max=Math.max(...days.map(d=>d.items.length),1);
    const tabs=`<div class="weekday-tabs" role="tablist" aria-label="انتخاب روز هفته">${days.map(d=>`<button type="button" role="tab" class="weekday-tab" aria-selected="${d.d===0?'true':'false'}" tabindex="${d.d===0?'0':'-1'}" data-week-tab="${d.d}" aria-controls="week-panel-${d.d}"><span>${esc(d.name)}</span><span class="day-count">${fa(d.items.length)} عنوان</span><span class="day-volume" style="width:${Math.max(8,Math.round(d.items.length/max*100))}%"></span></button>`).join('')}</div>`;
    const panels=days.map(d=>{
      const net=d.items.filter(s=>s.type==='نمایش خانگی'),tv=d.items.filter(s=>s.type==='تلویزیون');
      return `<section class="weekday-panel" role="tabpanel" id="week-panel-${d.d}" data-week-panel="${d.d}" ${d.d===0?'':'hidden'}><div class="day-feature"><div><span class="kicker">برنامهٔ اعلام‌شده</span><h3>${esc(d.name)}‌ها</h3><p>مجموع ${fa(d.items.length)} سریال در برنامهٔ هفتگی این روز ثبت شده است.</p></div><div class="day-feature-count">${fa(d.items.length)}<small>سریال</small></div></div><div class="week-columns"><div class="week-group"><h4>انتشار در نمایش خانگی <span>${fa(net.length)}</span></h4>${net.length?net.map(scheduleRow).join(''):'<p class="week-empty">مجموعه‌ای در جدول این روز ثبت نشده است.</p>'}</div><div class="week-group"><h4>پخش از تلویزیون <span>${fa(tv.length)}</span></h4>${tv.length?tv.map(scheduleRow).join(''):'<p class="week-empty">پخش تازه‌ای در جدول این روز ثبت نشده است.</p>'}</div></div></section>`;
    }).join('');
    return `<div class="weekly-board" data-weekly-board>${tabs}<div class="week-panels">${panels}</div></div>`;
  }
  function todayBlock(){
    const payload={shows:active.map(s=>({slug:s.slug,title:s.title,platform:s.platform,type:s.type,days:s.days,time:s.time})),episodes:EP.map(e=>({series:e.series,number:e.number,season:e.season||1,title:e.title,date:e.releasedAt})),platforms:P};
    const json=JSON.stringify(payload).replace(/</g,'\\u003c');
    return `<section class="section-block today-section"><div class="section-head"><div><span class="kicker">راهنمای لحظه‌ای • به وقت تهران</span><h2 id="today-heading">امروز چه پخش می‌شود؟</h2></div>${link('schedule/','تقویم هفتگی','text-link')}</div><p class="section-intro" id="today-date">برنامه بر اساس تاریخ تهران نمایش داده می‌شود؛ زمان‌بندی به معنی تأیید انتشار نیست.</p><div class="today-columns"><div class="today-list"><h3>منتشرشدهٔ امروز <span>فقط موارد تأییدشده</span></h3><div id="today-released"><p class="muted">در حال بررسی تاریخ انتشار قسمت‌ها…</p></div></div><div class="today-list"><h3>برنامهٔ امروز <span>نمایش خانگی و تلویزیون</span></h3><div id="today-scheduled"><p class="muted">در حال خواندن تقویم تهران…</p></div></div></div><script type="application/json" id="meshkido-today-data">${json}</script></section>`;
  }

  function heroStage(){
    const picks=['nimrokh','konkel','sorkh-o-siah'].map(id=>bySlug.get(id)).filter(s=>s?.artwork?.src);
    const cards=picks.map((s,i)=>`<a class="cinema-card cinema-card-${i+1}" href="${href('series/'+s.slug+'/')}" title="پروندهٔ سریال ${esc(s.title)}" style="--show-accent:${esc(P[s.platform]?.color||s.color)}"><img src="${esc(s.artwork.src)}" alt="پوستر سریال ${esc(s.title)}" loading="eager" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('cinema-card-fallback')"><div class="cinema-card-inner"><span class="cinema-card-tag">${esc(s.platform)}</span><strong>${esc(s.title)}</strong></div></a>`).join('');
    return `<div class="hero-graphic hero-stage" aria-label="پوستر سریال‌های منتخب در حال پخش">
      <div class="stage-grain" aria-hidden="true"></div><div class="stage-glow" aria-hidden="true"></div>
      <div class="stage-top"><span class="stage-indicator"></span><span>NOW SHOWING / IRAN</span><span>۰۱ — ${fa(picks.length)}</span></div>
      <div class="stage-posters">${cards}</div>
      <div class="stage-foot"><span>روی پردهٔ خانه‌ها</span><span class="stage-foot-line"></span><span>پرونده‌های این هفته</span></div>
    </div>`;
  }
  const home=`<section class="hero"><div class="hero-text"><div class="eyebrow"><span class="live-dot"></span> راهنمای سریال‌های در حال پخش ایران</div><h1>امروز چه <em>سریالی</em> ببینیم؟</h1><p>زمان‌بندی انتشار، پروندهٔ سریال‌ها و خبرهای معتبر؛ از فیلیمو و فیلم‌نت تا شیدا و شبکه‌های تلویزیون.</p><div class="hero-actions">${link('schedule/','تقویم پخش این هفته','primary-btn')}${link('series/','مرور همهٔ سریال‌ها','secondary-btn')}</div><div class="hero-footnote">پوشش اولیه • ${fa(active.length)} سریال ثبت‌شده • آخرین راستی‌آزمایی ${esc(S.checkedAtFa)}</div></div>${heroStage()}</section>${todayBlock()}<section class="section-block">${heading('روی آنتن و در دسترس','پرونده‌های فعال','همهٔ سریال‌ها','series/')}<div class="poster-grid">${recent.map(seriesCard).join('')}</div></section><section class="section-block">${heading('برنامه‌های اعلام‌شده','تقویم هفتگی','تقویم کامل','schedule/')}<p class="section-intro">این جدول روزهای معمول انتشار را نشان می‌دهد، نه تأیید انتشار قسمت بعدی در یک تاریخ مشخص.</p>${weeklyBoard()}</section><section class="section-block">${heading('خبرهای دارای منبع','آخرین اتفاق‌ها','آرشیو خبرها','news/')}<div class="news-grid">${U.slice(0,4).map(newsCard).join('')}</div></section><section class="section-block">${heading('هفت پرونده، یک مرجع','سریال‌های روی آنتن','فهرست کامل','series/')}<div class="poster-grid">${active.slice(0,6).map(seriesCard).join('')}</div></section><section class="notice-box"><strong>سایت در فاز آغازین است.</strong><p>فعلاً فقط سریال‌های ایرانی با شواهد تازه از پخش در فهرست‌اند. قسمت‌ها، اخبار و آمار بدون منبع منتشر نمی‌شوند و برچسب آخرین بررسی همیشه قابل مشاهده است.</p>${link('about/','دربارهٔ روش گردآوری','text-link')}</section>`;
  function render(relative,title,desc,html,navKey=''){
    const file=path.join(OUT,relative,'index.html');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,shell(title,desc,relative?relative+'/':'',html,navKey));
  }
  fs.rmSync(OUT,{recursive:true,force:true});
  fs.mkdirSync(OUT,{recursive:true});
  fs.copyFileSync('public/styles.css',path.join(OUT,'styles.css'));
  fs.copyFileSync('public/ui.js',path.join(OUT,'ui.js'));
  fs.mkdirSync(path.join(OUT,'assets'),{recursive:true});
  fs.copyFileSync('assets/meshkido-logo.webp',path.join(OUT,'assets/meshkido-logo.webp'));
  fs.copyFileSync('assets/meshkido-favicon.png',path.join(OUT,'assets/meshkido-favicon.png'));
  render('','مشکی‌دو | سریال‌های ایرانی در حال پخش','تقویم پخش، اخبار معتبر و معرفی سریال‌های ایرانی در حال پخش از نمایش خانگی و تلویزیون',home,'');
  render('series','سریال‌های ایرانی در حال پخش','فهرست سریال‌های تازهٔ ایرانی همراه با بازیگران، کارگردان و برنامهٔ پخش',`<section class="page-heading"><div class="kicker">فهرست زنده</div><h1>سریال‌های در حال پخش</h1><p>فقط سریال‌های داستانی که پخش قسمت‌های تازه‌شان در دورهٔ پوشش تأیید شده است.</p></section>${filter()}<div class="poster-grid filtered-grid" id="series-list">${active.map(seriesCard).join('')}</div><div class="empty-result" id="series-empty" hidden>نتیجه‌ای پیدا نشد. جستجو یا فیلتر را تغییر دهید.</div>`,'series/');
  render('schedule','تقویم هفتگی سریال‌های ایرانی','روز و ساعت اعلام‌شدهٔ پخش سریال‌های ایرانی در حال انتشار',`<section class="page-heading"><div class="kicker">تقویم برنامه‌های اعلام‌شده</div><h1>تقویم هفتگی؛ هر روز، جداگانه</h1><p>روز و ساعت اعلام‌شدهٔ پخش در ${esc(S.checkedAtFa)}. تغییر برنامه یا عدم انتشار یک قسمت ممکن است؛ انتشار قطعی قسمت‌ها را جداگانه تأیید می‌کنیم.</p></section>${weeklyBoard()}<div class="notice-box"><strong>دربارهٔ ساعت‌ها</strong><p>تمام ساعت‌ها به وقت تهران است. در صورت نبود ساعت معتبر، فقط روز پخش درج شده است. هیچ شمارهٔ قسمت آینده‌ای از روی تقویم پیش‌بینی نشده است.</p></div>`,'schedule/');
  render('news','خبرهای سریال‌های ایرانی','خبرهای دارای منبع دربارهٔ سریال‌های ایرانی در حال پخش',`<section class="page-heading"><div class="kicker">خبرهای راستی‌آزمایی‌شده</div><h1>اتفاق‌های تازهٔ سریال‌ها</h1><p>خلاصه‌های کوتاه و مستقل از اعلام‌های معتبر. برای هر خبر، لینک منبع قابل مشاهده است.</p></section><div class="news-grid news-grid-full">${U.map(newsCard).join('')}</div><div class="notice-box"><strong>به‌روزرسانی خبرها فعلاً تحریریه‌ای است</strong><p>در این نسخه، گردآوری خودکار خبر فعال نیست و تا تأیید منبع، هیچ خبری خودکار منتشر نمی‌شود.</p></div>`,'news/');
  for(const s of S.shows){
    const cast=(s.cast||[]).length?`<div class="people-grid">${s.cast.map(n=>`<a href="${actorHref(n)}" class="person-pill"><span class="person-avatar">${esc(n[0])}</span>${esc(n)}</a>`).join('')}</div>`:'<p class="muted">فهرست بازیگران این عنوان هنوز با منبع کافی ثبت نشده است.</p>';
    const info=[['بستر پخش',s.platform],['وضعیت',s.status],['روزهای پخش',dayText(s)],['ساعت اعلام‌شده',s.time?s.time+' (تهران)':'هنوز تأیید نشده'],['تاریخ آغاز',s.startFa||'نیازمند ثبت دقیق'],['کارگردان',s.director||'ثبت نشده'],['تهیه‌کننده',s.producer||'ثبت نشده']].map(([k,v])=>`<div class="detail-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    const detail=`<div class="breadcrumbs">${link('','خانه')} <span>/</span> ${link('series/','سریال‌ها')} <span>/</span> <strong>${esc(s.title)}</strong></div><section class="detail-hero">${cover(s,true)}<div class="detail-hero-text"><div class="kicker">پروندهٔ سریال · ${esc(s.type)}</div><h1>${esc(s.title)}</h1><p class="detail-subtitle">${esc(s.alt)}</p><div class="tags"><span class="pill status"><span class="live-dot"></span>${esc(s.status)}</span><span class="pill">${esc(s.platform)}</span>${s.genres.map(g=>`<span class="pill">${esc(g)}</span>`).join('')}</div><p>${esc(s.synopsis)}</p><div class="detail-small">اطلاعات تا ${esc(S.checkedAtFa)} بررسی شده‌اند.</div>${s.artwork?.source?`<p class="photo-credit">منبع تصویر: <a href="${esc(s.artwork.source)}" target="_blank" rel="noopener noreferrer">${esc(s.artwork.credit)} ↗</a></p>`:''}${s.ratingSource?`<p class="rating-source">امتیاز کاربران: ${s.ratingSource.rating===null?'هنوز دادهٔ عمومی قابل استناد ثبت نشده':esc(s.ratingSource.rating)} · <a href="${esc(s.ratingSource.url)}" target="_blank" rel="noopener noreferrer">${esc(s.ratingSource.name)} ↗</a></p>`:''}</div></section><div class="detail-layout"><div><section class="section-block detail-section">${heading('دربارهٔ اثر','داستان و معرفی')}<p class="body-copy">${esc(s.synopsis)}</p></section><section class="section-block detail-section">${heading('چهره‌های تأییدشده','بازیگران')}<p class="section-intro">نام‌ها از فهرست بازیگران منتشرشده استخراج شده‌اند؛ برای نقش‌های تأییدنشده هیچ کاراکتری ساخته نشده است.</p>${cast}</section><section class="section-block detail-section">${heading('ردیابی اطلاعات','منابع این پرونده')}<ul class="sources-list">${s.sources.map(x=>`<li>${sourceLink(x)}</li>`).join('')}</ul></section><section class="section-block detail-section">${heading('قسمت‌های دارای تأیید','آرشیو قسمت‌ها')}<p class="section-intro">تنها قسمت‌های با شاهد انتشار؛ شماره یا تاریخ آینده از روی برنامهٔ هفتگی ساخته نمی‌شود.</p>${seriesEpisodes(s).length?`<div class="episode-grid">${seriesEpisodes(s).map(e=>`<a class="episode-card" href="${href(episodePath(e))}"><span class="episode-number">قسمت ${fa(e.number)}</span><strong>${esc(e.title||'قسمت '+fa(e.number))}</strong><small>${e.dateFa?esc(e.dateFa):'تاریخ دقیق ثبت نشده'}</small><span class="text-link">صفحهٔ قسمت ←</span></a>`).join('')}</div>`:'<p class="muted">شمارهٔ قسمت تأییدشده‌ای هنوز در این پرونده ثبت نشده است.</p>'}</section></div><aside class="facts-card"><h2>اطلاعات پخش</h2><dl>${info}</dl><a class="secondary-btn aside-btn" href="${href('schedule/')}">مشاهده تقویم</a></aside></div>`;
    render('series/'+s.slug,s.title+' | معرفی، پخش و بازیگران','دربارهٔ سریال '+s.title+'، بازیگران، زمان پخش و منبع اعلام رسمی',detail,'series/');
  }

  for(const e of EP){
    const s=bySlug.get(e.series);
    const eps=seriesEpisodes(s).sort((a,b)=>a.number-b.number);
    const i=eps.findIndex(x=>x===e);
    const prev=eps[i-1],next=eps[i+1];
    const t=e.title||'قسمت '+fa(e.number);
    const page=`<div class="breadcrumbs">${link('','خانه')} <span>/</span> ${link('series/','سریال‌ها')} <span>/</span> ${link('series/'+s.slug+'/',s.title)} <span>/</span> قسمت ${fa(e.number)}</div><section class="episode-hero" style="--platform-color:${esc(P[s.platform]?.color||s.color)}"><div class="episode-hero-image">${cover(s,true)}</div><div><span class="kicker">پروندهٔ قسمتِ منتشرشده</span><h1>${esc(s.title)} · قسمت ${fa(e.number)}</h1><h2>${esc(t)}</h2><div class="tags">${platformMark(s.platform,false)}<span class="pill">${e.season&&e.season!==1?'فصل '+fa(e.season)+' · ':''}قسمت ${fa(e.number)}</span></div><p>${esc(e.summary)}</p><p class="muted">${e.dateFa?'تاریخ انتشارِ تأییدشده: '+esc(e.dateFa):'تاریخ دقیق انتشار در منابع فعلی مستقل از اعلام انتشار تأیید نشده است.'}</p>${e.watchUrl?`<a class="primary-btn" href="${esc(e.watchUrl)}" target="_blank" rel="noopener noreferrer">تماشای قانونی در ${esc(s.platform)} ↗</a>`:''}</div></section><section class="section-block detail-section"><div class="section-head"><div><span class="kicker">معرفی مستقل</span><h2>دربارهٔ این قسمت</h2></div></div><p class="body-copy">${esc(e.summary)}</p><div class="notice-box"><strong>منبع انتشار</strong><p>${sourceLink(e.source)}؛ این صفحه قسمت کامل یا ترجمهٔ مطلب دیگران نیست.</p></div></section><div class="episode-navigation">${prev?link(episodePath(prev),'قسمت قبلی: '+fa(prev.number),'secondary-btn'):'<span></span>'}${next?link(episodePath(next),'قسمت بعدیِ تأییدشده: '+fa(next.number),'secondary-btn'):'<span></span>'}</div><section class="section-block">${heading('این مجموعه','صفحهٔ مادر')}${seriesCard(s)}</section>`;
    render(episodePath(e).replace(/\/$/,''),s.title+' قسمت '+e.number+' | '+t,'جزئیات قسمت '+e.number+' سریال '+s.title+'، تاریخ انتشار، منبع رسمی و مسیر تماشای قانونی',page,'series/');
  }
  const names=[...people.keys()].sort((a,b)=>a.localeCompare(b,'fa'));
  render('actors','بازیگران سریال‌های در حال پخش','بازیگران آثار حاضر در فهرست مشکی‌دو',`<section class="page-heading"><div class="kicker">چهره‌ها</div><h1>بازیگران</h1><p>در این مرحله فقط حضور افراد در سریال‌های فهرست‌شده نمایش داده می‌شود؛ زندگی‌نامه یا نقش بدون تأیید ساخته نمی‌شود.</p></section><div class="actor-grid">${names.map(n=>`<a class="actor-row" href="${actorHref(n)}"><span class="person-avatar">${esc(n[0])}</span><span><strong>${esc(n)}</strong><small>${fa(people.get(n).length)} عنوان ثبت‌شده</small></span><span class="actor-arrow">←</span></a>`).join('')}</div>`,'actors/');
  for(const n of names){
    const slugs=people.get(n);
    render('actors/'+actorId(n),n+' | سریال‌های در حال پخش','آثار ثبت‌شدهٔ '+n+' در فهرست سریال‌های ایرانی مشکی‌دو',`<div class="breadcrumbs">${link('','خانه')} <span>/</span> ${link('actors/','بازیگران')} <span>/</span> ${esc(n)}</div><section class="page-heading"><div class="kicker">صفحه بازیگر</div><h1>${esc(n)}</h1><p>فهرست آثار این بازیگر در محدودهٔ فعلی مشکی‌دو، بر اساس منابع ثبت‌شدهٔ سریال‌ها. اطلاعات زندگی‌نامه و نقش‌ها در صورت تأیید افزوده می‌شوند.</p></section><div class="poster-grid">${slugs.map(seriesCard).join('')}</div>`,'actors/');
  }
  const platforms=[...new Set(active.map(s=>s.platform))].sort((a,b)=>a.localeCompare(b,'fa'));
  render('platforms','پلتفرم‌ها و شبکه‌ها','فهرست رسانه‌ها و پلتفرم‌های دارای سریال جدید ایرانی',`<section class="page-heading"><div class="kicker">بسترهای انتشار</div><h1>پلتفرم‌ها و شبکه‌ها</h1><p>سریال‌های داستانی در حال پخش به تفکیک بستر انتشار؛ مسابقه و برنامهٔ گفت‌وگومحور در فاز اول پوشش داده نمی‌شود.</p></section>${platforms.map(p=>`<section class="section-block">${heading('پخش‌کننده',p)}<div class="poster-grid">${active.filter(s=>s.platform===p).map(seriesCard).join('')}</div></section>`).join('')}`,'platforms/');
  render('about','دربارهٔ مشکی‌دو و روش گردآوری','روش کار، محدودهٔ پوشش و معیارهای صحت اطلاعات سایت مشکی‌دو',`<section class="page-heading"><div class="kicker">دربارهٔ پروژه</div><h1>مشکی‌دو چیست؟</h1><p>یک پروژهٔ مستقل برای معرفی و پیگیری سریال‌های ایرانی با قسمت‌های تازه؛ الهام‌گرفته از روش داده‌محور مشکی‌مدیا.</p></section><div class="prose"><h2>فاز نخست</h2><p>پوشش سریال‌های داستانی در حال پخش در تلویزیون و نمایش خانگی. بازپخش مجموعه‌های قدیمی، فیلم، مسابقه، رئالیتی‌شو و تاک‌شو فعلاً در فهرست نیست.</p><h2>دقت پیش از سرعت</h2><p>برای هر سریال دست‌کم یک منبع ثبت می‌شود. روزهای هفتگی پخش از اطلاعیه‌های معتبر گرفته می‌شوند، اما به معنی تضمین انتشار هر قسمت در آینده نیستند. زمان انتشار، شماره قسمت، آمار بازدید و امتیاز مخاطبان بدون سند یا دادهٔ واقعی منتشر نمی‌شوند.</p><h2>آنچه هنوز فعال نیست</h2><p>پروندهٔ قسمت‌های تأییدشده و تقویم روزانه فعال‌اند. جمع‌آوری خودکار اخبار و قسمت‌ها، امتیازدهی کاربران و انتشار خودکار شبکه‌های اجتماعی هنوز فعال نشده‌اند؛ آمار و شمارهٔ قسمت حدسی وارد نمی‌کنیم.</p><h2>اصلاحات و شفافیت</h2><p>آخرین راستی‌آزمایی محتوای اولیه ${esc(S.checkedAtFa)} انجام شده است. داده‌ها در مخزن عمومی سایت قرار دارند و لینک هر منبع در پروندهٔ مربوط ثبت شده است.</p><p><a class="primary-btn" href="https://github.com/nimania/meshkido" target="_blank" rel="noopener noreferrer">مشاهده مخزن پروژه ↗</a></p></div>`,'about/');
  const urls=['', 'series/','schedule/','news/','actors/','platforms/','about/',...S.shows.map(s=>'series/'+s.slug+'/'),...EP.map(e=>episodePath(e)),...names.map(n=>'actors/'+actorId(n)+'/')];
  fs.writeFileSync(path.join(OUT,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+DOMAIN+href(u)+'</loc></url>').join('')+'</urlset>');
  fs.writeFileSync(path.join(OUT,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: '+DOMAIN+href('sitemap.xml')+'\n');
  fs.mkdirSync(path.join(OUT,'data'),{recursive:true});
  fs.copyFileSync('data/series.json',path.join(OUT,'data/series.json'));
  fs.copyFileSync('data/updates.json',path.join(OUT,'data/updates.json'));
  fs.copyFileSync('data/episodes.json',path.join(OUT,'data/episodes.json'));
  fs.copyFileSync('data/platforms.json',path.join(OUT,'data/platforms.json'));
  fs.writeFileSync(path.join(OUT,'.nojekyll'),'');
  console.log('Built '+urls.length+' pages, '+active.length+' active series, '+EP.length+' verified episodes, '+U.length+' updates.');
})(fs,path,crypto);
