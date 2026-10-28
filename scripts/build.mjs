import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
(function(fs,path,crypto){
  const ROOT='/meshkido/';
  const DOMAIN='https://nimania.github.io';
  const OUT='dist';
  const S=JSON.parse(fs.readFileSync('data/series.json','utf8'));
  const U=JSON.parse(fs.readFileSync('data/updates.json','utf8'));
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
    return `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(title)} | مشکی‌دو</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(u)}"><meta property="og:type" content="website"><meta property="og:site_name" content="مشکی‌دو"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(u)}"><meta property="og:locale" content="fa_IR"><link rel="stylesheet" href="${href('styles.css')}"><script src="${href('ui.js')}" defer></script></head>`;
  }
  function shell(title,desc,permalink,content,current=''){
    const menu=nav.map(([p,n])=>`<a href="${href(p)}" ${p===current?'aria-current="page"':''}>${esc(n)}</a>`).join('');
    const layout=`<header class="site-header"><div class="container header-inner"><a href="${href()}" class="brand"><span class="brand-mark">م<span>۲</span></span><span class="brand-name"><strong>مشکی‌دو</strong><small>دنیای سریال‌های ایرانی</small></span></a><div class="header-actions"><button id="theme-toggle" class="theme-toggle" type="button" aria-label="تغییر حالت نمایش">◐</button></div></div><nav class="site-nav container" aria-label="منوی اصلی">${menu}</nav></header><main id="main" class="container">${content}</main><footer class="site-footer"><div class="container footer-content"><div><strong>مشکی‌دو</strong><p>مرجع مستقل سریال‌های در حال پخش ایران • فاز نخست</p></div><p>آخرین بررسی تحریریه: ${esc(S.checkedAtFa)}<br>اطلاعات با ذکر منبع منتشر شده‌اند؛ زمان‌بندی هفتگی تضمین انتشار هر قسمت نیست.</p><div>${link('about/','روش کار و منابع')}</div></div></footer>`;
    const schema={'@context':'https://schema.org','@type':'WebSite',name:'مشکی‌دو',url:DOMAIN+ROOT,inLanguage:'fa'};
    return '<!doctype html><html lang="fa" dir="rtl">'+meta(title,desc,permalink)+'<body><a class="skip-link" href="#main">رفتن به محتوا</a>'+layout+'<script type="application/ld+json">'+JSON.stringify(schema)+'</script></body></html>';
  }
  function heading(kicker,title,more='',target=''){return `<div class="section-head"><div><span class="kicker">${esc(kicker)}</span><h2>${esc(title)}</h2></div>${more?link(target,more,'text-link'):''}</div>`}
  function cover(s,large=false){
    return `<div class="poster ${large?'poster-large':''}" style="--tone:${esc(s.color)}"><span class="poster-orbit orbit-one"></span><span class="poster-orbit orbit-two"></span><span class="poster-label">MESH KIDO / ${esc(s.type)}</span><strong>${esc(s.title)}</strong><span class="poster-bottom">${esc(s.platform)}</span></div>`;
  }
  function seriesCard(s){
    return `<a class="series-card" href="${href('series/'+s.slug+'/')}" data-series-card data-search="${esc([s.title,s.alt,s.platform,s.director,...(s.cast||[])].join(' ').toLowerCase())}" data-kind="${esc(s.type)}" data-platform="${esc(s.platform)}">${cover(s)}<div class="series-card-body"><div class="mini-label"><span class="live-dot"></span>${esc(s.status)} · ${esc(s.platform)}</div><h3>${esc(s.title)}</h3><p>${esc(s.genres.join(' / '))}</p><div class="card-schedule">${esc(dayText(s))}${s.time?' · '+esc(s.time):''}</div></div></a>`;
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
  function dayPanel(day){
    return `<div class="day-panel"><div class="day-head"><h3>${esc(day.name)}</h3><span>${fa(day.items.length)} سریال</span></div>${day.items.length?day.items.map(s=>`<a class="day-show" href="${href('series/'+s.slug+'/')}"><span class="day-show-name">${esc(s.title)}</span><span class="day-show-meta">${esc(s.platform)} ${s.time?'· '+esc(s.time):''}</span></a>`).join(''):'<p class="muted day-empty">در برنامهٔ ثبت‌شده، پخش تازه‌ای نداریم.</p>'}</div>`;
  }
  const home=`<section class="hero"><div class="hero-text"><div class="eyebrow"><span class="live-dot"></span> راهنمای سریال‌های در حال پخش ایران</div><h1>امروز چه <em>سریالی</em> ببینیم؟</h1><p>زمان‌بندی انتشار، پروندهٔ سریال‌ها و خبرهای معتبر؛ از فیلیمو و فیلم‌نت تا شیدا و شبکه‌های تلویزیون.</p><div class="hero-actions">${link('schedule/','تقویم پخش این هفته','primary-btn')}${link('series/','مرور همهٔ سریال‌ها','secondary-btn')}</div><div class="hero-footnote">پوشش اولیه • ${fa(active.length)} سریال ثبت‌شده • آخرین راستی‌آزمایی ${esc(S.checkedAtFa)}</div></div><div class="hero-graphic"><span>IRANIAN SERIES</span><div>مِشکی<br><i>دو</i></div><small>پخش تازه، روایت تازه</small></div></section><section class="section-block">${heading('تازه‌های جدول پخش','تازه شروع شده‌اند','همهٔ سریال‌ها','series/')}<div class="poster-grid">${recent.map(seriesCard).join('')}</div></section><section class="section-block">${heading('برنامه‌های اعلام‌شده','تقویم هفتگی','تقویم کامل','schedule/')}<p class="section-intro">این جدول روزهای معمول انتشار را نشان می‌دهد، نه تأیید انتشار قسمت بعدی در یک تاریخ مشخص.</p><div class="week-grid">${days.map(dayPanel).join('')}</div></section><section class="section-block">${heading('خبرهای دارای منبع','آخرین اتفاق‌ها','آرشیو خبرها','news/')}<div class="news-grid">${U.slice(0,4).map(newsCard).join('')}</div></section><section class="section-block">${heading('هفت پرونده، یک مرجع','سریال‌های روی آنتن','فهرست کامل','series/')}<div class="poster-grid">${active.slice(0,6).map(seriesCard).join('')}</div></section><section class="notice-box"><strong>سایت در فاز آغازین است.</strong><p>فعلاً فقط سریال‌های ایرانی با شواهد تازه از پخش در فهرست‌اند. قسمت‌ها، اخبار و آمار بدون منبع منتشر نمی‌شوند و برچسب آخرین بررسی همیشه قابل مشاهده است.</p>${link('about/','دربارهٔ روش گردآوری','text-link')}</section>`;
  function render(relative,title,desc,html,navKey=''){
    const file=path.join(OUT,relative,'index.html');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,shell(title,desc,relative?relative+'/':'',html,navKey));
  }
  fs.rmSync(OUT,{recursive:true,force:true});
  fs.mkdirSync(OUT,{recursive:true});
  fs.copyFileSync('public/styles.css',path.join(OUT,'styles.css'));
  fs.copyFileSync('public/ui.js',path.join(OUT,'ui.js'));
  render('','مشکی‌دو | سریال‌های ایرانی در حال پخش','تقویم پخش، اخبار معتبر و معرفی سریال‌های ایرانی در حال پخش از نمایش خانگی و تلویزیون',home,'');
  render('series','سریال‌های ایرانی در حال پخش','فهرست سریال‌های تازهٔ ایرانی همراه با بازیگران، کارگردان و برنامهٔ پخش',`<section class="page-heading"><div class="kicker">فهرست زنده</div><h1>سریال‌های در حال پخش</h1><p>فقط سریال‌های داستانی که پخش قسمت‌های تازه‌شان در دورهٔ پوشش تأیید شده است.</p></section>${filter()}<div class="poster-grid filtered-grid" id="series-list">${active.map(seriesCard).join('')}</div><div class="empty-result" id="series-empty" hidden>نتیجه‌ای پیدا نشد. جستجو یا فیلتر را تغییر دهید.</div>`,'series/');
  render('schedule','تقویم هفتگی سریال‌های ایرانی','روز و ساعت اعلام‌شدهٔ پخش سریال‌های ایرانی در حال انتشار',`<section class="page-heading"><div class="kicker">تقویم برنامه‌های اعلام‌شده</div><h1>چه روزی چه سریالی پخش می‌شود؟</h1><p>روز و ساعت اعلام‌شدهٔ پخش در ${esc(S.checkedAtFa)}. تغییر برنامه یا عدم انتشار یک قسمت ممکن است؛ انتشار قطعی قسمت‌ها را جداگانه تأیید می‌کنیم.</p></section><div class="week-grid week-grid-full">${days.map(dayPanel).join('')}</div><div class="notice-box"><strong>دربارهٔ ساعت‌ها</strong><p>تمام ساعت‌ها به وقت تهران است. در صورت نبود ساعت معتبر، فقط روز پخش درج شده است. هیچ شمارهٔ قسمت آینده‌ای از روی تقویم پیش‌بینی نشده است.</p></div>`,'schedule/');
  render('news','خبرهای سریال‌های ایرانی','خبرهای دارای منبع دربارهٔ سریال‌های ایرانی در حال پخش',`<section class="page-heading"><div class="kicker">خبرهای راستی‌آزمایی‌شده</div><h1>اتفاق‌های تازهٔ سریال‌ها</h1><p>خلاصه‌های کوتاه و مستقل از اعلام‌های معتبر. برای هر خبر، لینک منبع قابل مشاهده است.</p></section><div class="news-grid news-grid-full">${U.map(newsCard).join('')}</div><div class="notice-box"><strong>به‌روزرسانی خبرها فعلاً تحریریه‌ای است</strong><p>در این نسخه، گردآوری خودکار خبر فعال نیست و تا تأیید منبع، هیچ خبری خودکار منتشر نمی‌شود.</p></div>`,'news/');
  for(const s of S.shows){
    const cast=(s.cast||[]).length?`<div class="people-grid">${s.cast.map(n=>`<a href="${actorHref(n)}" class="person-pill"><span class="person-avatar">${esc(n[0])}</span>${esc(n)}</a>`).join('')}</div>`:'<p class="muted">فهرست بازیگران این عنوان هنوز با منبع کافی ثبت نشده است.</p>';
    const info=[['بستر پخش',s.platform],['وضعیت',s.status],['روزهای پخش',dayText(s)],['ساعت اعلام‌شده',s.time?s.time+' (تهران)':'هنوز تأیید نشده'],['تاریخ آغاز',s.startFa||'نیازمند ثبت دقیق'],['کارگردان',s.director||'ثبت نشده'],['تهیه‌کننده',s.producer||'ثبت نشده']].map(([k,v])=>`<div class="detail-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    const detail=`<div class="breadcrumbs">${link('','خانه')} <span>/</span> ${link('series/','سریال‌ها')} <span>/</span> <strong>${esc(s.title)}</strong></div><section class="detail-hero">${cover(s,true)}<div class="detail-hero-text"><div class="kicker">پروندهٔ سریال · ${esc(s.type)}</div><h1>${esc(s.title)}</h1><p class="detail-subtitle">${esc(s.alt)}</p><div class="tags"><span class="pill status"><span class="live-dot"></span>${esc(s.status)}</span><span class="pill">${esc(s.platform)}</span>${s.genres.map(g=>`<span class="pill">${esc(g)}</span>`).join('')}</div><p>${esc(s.synopsis)}</p><div class="detail-small">اطلاعات تا ${esc(S.checkedAtFa)} بررسی شده‌اند.</div></div></section><div class="detail-layout"><div><section class="section-block detail-section">${heading('دربارهٔ اثر','داستان و معرفی')}<p class="body-copy">${esc(s.synopsis)}</p></section><section class="section-block detail-section">${heading('چهره‌های تأییدشده','بازیگران')}<p class="section-intro">نام‌ها از فهرست بازیگران منتشرشده استخراج شده‌اند؛ برای نقش‌های تأییدنشده هیچ کاراکتری ساخته نشده است.</p>${cast}</section><section class="section-block detail-section">${heading('ردیابی اطلاعات','منابع این پرونده')}<ul class="sources-list">${s.sources.map(x=>`<li>${sourceLink(x)}</li>`).join('')}</ul></section><section class="section-block detail-section">${heading('قسمت‌های تازه','آرشیو قسمت‌ها')}<p class="muted">جزئیات هر قسمت پس از تأیید تاریخ انتشار و خلاصهٔ مستقل افزوده می‌شود. در این مرحله هیچ قسمتِ بدون شاهدی ساخته نشده است.</p></section></div><aside class="facts-card"><h2>اطلاعات پخش</h2><dl>${info}</dl><a class="secondary-btn aside-btn" href="${href('schedule/')}">مشاهده تقویم</a></aside></div>`;
    render('series/'+s.slug,s.title+' | معرفی، پخش و بازیگران','دربارهٔ سریال '+s.title+'، بازیگران، زمان پخش و منبع اعلام رسمی',detail,'series/');
  }
  const names=[...people.keys()].sort((a,b)=>a.localeCompare(b,'fa'));
  render('actors','بازیگران سریال‌های در حال پخش','بازیگران آثار حاضر در فهرست مشکی‌دو',`<section class="page-heading"><div class="kicker">چهره‌ها</div><h1>بازیگران</h1><p>در این مرحله فقط حضور افراد در سریال‌های فهرست‌شده نمایش داده می‌شود؛ زندگی‌نامه یا نقش بدون تأیید ساخته نمی‌شود.</p></section><div class="actor-grid">${names.map(n=>`<a class="actor-row" href="${actorHref(n)}"><span class="person-avatar">${esc(n[0])}</span><span><strong>${esc(n)}</strong><small>${fa(people.get(n).length)} عنوان ثبت‌شده</small></span><span class="actor-arrow">←</span></a>`).join('')}</div>`,'actors/');
  for(const n of names){
    const slugs=people.get(n);
    render('actors/'+actorId(n),n+' | سریال‌های در حال پخش','آثار ثبت‌شدهٔ '+n+' در فهرست سریال‌های ایرانی مشکی‌دو',`<div class="breadcrumbs">${link('','خانه')} <span>/</span> ${link('actors/','بازیگران')} <span>/</span> ${esc(n)}</div><section class="page-heading"><div class="kicker">صفحه بازیگر</div><h1>${esc(n)}</h1><p>فهرست آثار این بازیگر در محدودهٔ فعلی مشکی‌دو، بر اساس منابع ثبت‌شدهٔ سریال‌ها. اطلاعات زندگی‌نامه و نقش‌ها در صورت تأیید افزوده می‌شوند.</p></section><div class="poster-grid">${slugs.map(seriesCard).join('')}</div>`,'actors/');
  }
  const platforms=[...new Set(active.map(s=>s.platform))].sort((a,b)=>a.localeCompare(b,'fa'));
  render('platforms','پلتفرم‌ها و شبکه‌ها','فهرست رسانه‌ها و پلتفرم‌های دارای سریال جدید ایرانی',`<section class="page-heading"><div class="kicker">بسترهای انتشار</div><h1>پلتفرم‌ها و شبکه‌ها</h1><p>سریال‌های داستانی در حال پخش به تفکیک بستر انتشار؛ مسابقه و برنامهٔ گفت‌وگومحور در فاز اول پوشش داده نمی‌شود.</p></section>${platforms.map(p=>`<section class="section-block">${heading('پخش‌کننده',p)}<div class="poster-grid">${active.filter(s=>s.platform===p).map(seriesCard).join('')}</div></section>`).join('')}`,'platforms/');
  render('about','دربارهٔ مشکی‌دو و روش گردآوری','روش کار، محدودهٔ پوشش و معیارهای صحت اطلاعات سایت مشکی‌دو',`<section class="page-heading"><div class="kicker">دربارهٔ پروژه</div><h1>مشکی‌دو چیست؟</h1><p>یک پروژهٔ مستقل برای معرفی و پیگیری سریال‌های ایرانی با قسمت‌های تازه؛ الهام‌گرفته از روش داده‌محور مشکی‌مدیا.</p></section><div class="prose"><h2>فاز نخست</h2><p>پوشش سریال‌های داستانی در حال پخش در تلویزیون و نمایش خانگی. بازپخش مجموعه‌های قدیمی، فیلم، مسابقه، رئالیتی‌شو و تاک‌شو فعلاً در فهرست نیست.</p><h2>دقت پیش از سرعت</h2><p>برای هر سریال دست‌کم یک منبع ثبت می‌شود. روزهای هفتگی پخش از اطلاعیه‌های معتبر گرفته می‌شوند، اما به معنی تضمین انتشار هر قسمت در آینده نیستند. زمان انتشار، شماره قسمت، آمار بازدید و امتیاز مخاطبان بدون سند یا دادهٔ واقعی منتشر نمی‌شوند.</p><h2>آنچه هنوز فعال نیست</h2><p>جمع‌آوری خودکار خبر، تقویم قطعی قسمت‌ها، امتیازدهی کاربران و انتشار خودکار شبکه‌های اجتماعی در این فاز فعال نشده است. بخش‌ها به مرور و پس از تست اعتبارسنجی اضافه می‌شوند.</p><h2>اصلاحات و شفافیت</h2><p>آخرین راستی‌آزمایی محتوای اولیه ${esc(S.checkedAtFa)} انجام شده است. داده‌ها در مخزن عمومی سایت قرار دارند و لینک هر منبع در پروندهٔ مربوط ثبت شده است.</p><p><a class="primary-btn" href="https://github.com/nimania/meshkido" target="_blank" rel="noopener noreferrer">مشاهده مخزن پروژه ↗</a></p></div>`,'about/');
  const urls=['', 'series/','schedule/','news/','actors/','platforms/','about/',...S.shows.map(s=>'series/'+s.slug+'/'),...names.map(n=>'actors/'+actorId(n)+'/')];
  fs.writeFileSync(path.join(OUT,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+DOMAIN+href(u)+'</loc></url>').join('')+'</urlset>');
  fs.writeFileSync(path.join(OUT,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: '+DOMAIN+href('sitemap.xml')+'\n');
  fs.mkdirSync(path.join(OUT,'data'),{recursive:true});
  fs.copyFileSync('data/series.json',path.join(OUT,'data/series.json'));
  fs.copyFileSync('data/updates.json',path.join(OUT,'data/updates.json'));
  fs.writeFileSync(path.join(OUT,'.nojekyll'),'');
  console.log('Built '+urls.length+' pages, '+active.length+' active series, '+U.length+' verified updates.');
})(fs,path,crypto);
