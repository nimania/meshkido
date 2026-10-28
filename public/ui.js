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
})();
