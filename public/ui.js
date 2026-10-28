(function(){
  const root=document.documentElement;
  try{if(localStorage.getItem('meshkido-theme')==='dark')root.dataset.theme='dark';}catch{}
  const toggle=document.querySelector('#theme-toggle');
  if(toggle)toggle.addEventListener('click',()=>{const dark=root.dataset.theme!=='dark';root.dataset.theme=dark?'dark':'light';try{localStorage.setItem('meshkido-theme',dark?'dark':'light');}catch{}});
  const search=document.querySelector('#series-search');
  const platform=document.querySelector('#platform-filter');
  const buttons=[...document.querySelectorAll('[data-kind-filter]')];
  const cards=[...document.querySelectorAll('[data-series-card]')];
  let kind='همه';
  const normalize=s=>String(s).toLocaleLowerCase('fa').replaceAll('ي','ی').replaceAll('ك','ک').replace(/[\u200c\s]+/g,' ').trim();
  function apply(){
    if(!search&&!platform)return;
    const q=normalize(search?.value||''),p=platform?.value||'همه';
    let count=0;
    for(const c of cards){const ok=(kind==='همه'||c.dataset.kind===kind)&&(p==='همه'||c.dataset.platform===p)&&normalize(c.dataset.search).includes(q);c.hidden=!ok;if(ok)count++;}
    const countEl=document.querySelector('#series-count');
    if(countEl)countEl.textContent=new Intl.NumberFormat('fa-IR').format(count)+' سریال در این فهرست';
    const empty=document.querySelector('#series-empty');if(empty)empty.hidden=count!==0;
  }
  search?.addEventListener('input',apply);
  platform?.addEventListener('change',apply);
  for(const b of buttons)b.addEventListener('click',()=>{kind=b.dataset.kindFilter;for(const x of buttons){const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on));}apply();});
  function tehranToday(){
    const now=new Date();
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const get=k=>parts.find(x=>x.type===k)?.value||'';
    const iso=get('year')+'-'+get('month')+'-'+get('day');
    const day=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'short'}).format(now);
    return {iso,day:['Sat','Sun','Mon','Tue','Wed','Thu','Fri'].indexOf(day),dateFa:new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now)};
  }
  const live=tehranToday();
  function selectDay(board,day){
    const tabs=[...board.querySelectorAll('[data-week-tab]')];
    const panels=[...board.querySelectorAll('[data-week-panel]')];
    for(const t of tabs){const selected=+t.dataset.weekTab===day;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;t.classList.toggle('selected',selected);}
    for(const p of panels)p.hidden=(+p.dataset.weekPanel!==day);
  }
  for(const board of document.querySelectorAll('[data-weekly-board]')){
    if(live.day>=0)selectDay(board,live.day);
    const tabs=[...board.querySelectorAll('[data-week-tab]')];
    for(const tab of tabs){
      tab.addEventListener('click',()=>selectDay(board,+tab.dataset.weekTab));
      tab.addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
        e.preventDefault();
        const current=+tab.dataset.weekTab;
        const next=e.key==='Home'?0:e.key==='End'?6:(current+(e.key==='ArrowLeft'?1:6))%7;
        selectDay(board,next);
        tabs[next]?.focus();
      });
    }
  }
  const dataTag=document.getElementById('meshkido-today-data');
  if(dataTag){
    try{
      const data=JSON.parse(dataTag.textContent);
      const bySlug=new Map(data.shows.map(s=>[s.slug,s]));
      const todayTitle=document.getElementById('today-heading');
      if(todayTitle)todayTitle.textContent='امروز؛ '+live.dateFa;
      const stamp=document.getElementById('today-date');
      if(stamp)stamp.textContent='موارد زیر بر اساس روز و ساعت تهران دسته‌بندی شده‌اند؛ قسمت‌های تأییدشده جدا از برنامهٔ هفتگی هستند.';
      const localHref=slug=>'/meshkido/series/'+encodeURIComponent(slug)+'/';
      const digit=n=>new Intl.NumberFormat('fa-IR').format(n);
      const mark=s=>{
        const p=data.platforms[s.platform];
        if(!p)return '<span class="today-platform">'+s.platform+'</span>';
        return '<span class="today-platform" style="--platform-color:'+p.color+'">'+s.platform+'</span>';
      };
      const card=(s,extra,href)=>'<a class="today-item" href="'+href+'" style="--platform-color:'+(data.platforms[s.platform]?.color||'#777')+'"><strong>'+s.title+'</strong><span>'+mark(s)+' · '+extra+'</span></a>';
      const published=data.episodes.filter(e=>e.date===live.iso).sort((a,b)=>a.series.localeCompare(b.series));
      const publishedHTML=published.map(e=>{const s=bySlug.get(e.series);if(!s)return '';const epPath=localHref(s.slug)+'episode/'+(e.season&&e.season!==1?'season-'+e.season+'-':'')+e.number+'/';return card(s,'قسمت '+digit(e.number)+(e.title?' · '+e.title:''),epPath)}).join('');
      const released=document.getElementById('today-released');
      if(released)released.innerHTML=publishedHTML||'<p class="today-empty">برای امروز، انتشار قسمت تازه‌ای هنوز با منبع مستقل ثبت نشده است؛ این به معنی نبود انتشار نیست.</p>';
      const scheduled=data.shows.filter(s=>s.days.includes(live.day)).sort((a,b)=>a.type.localeCompare(b.type));
      const scheduledHTML=scheduled.map(s=>card(s,(s.type==='تلویزیون'?'امشب روی آنتن':'روز معمول انتشار')+(s.time?' · '+s.time:''),localHref(s.slug))).join('');
      const schedule=document.getElementById('today-scheduled');
      if(schedule)schedule.innerHTML=scheduledHTML||'<p class="today-empty">در برنامهٔ هفتگی ثبت‌شده، سریالی برای امروز نداریم.</p>';
    }catch(e){console.warn('MeshkiDo today data unavailable',e);}
  }
})();
