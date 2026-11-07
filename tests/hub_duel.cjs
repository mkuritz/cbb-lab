// DOM checks for integrated CBB Matchup Duel (jsdom only). Run: NODE_PATH=/workspace/visual-preview-tests/node_modules node tests/hub_duel.cjs
const fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom');const R=path.join(__dirname,'..');let ok=0,bad=0;const t=(c,m)=>{c?ok++:(bad++,console.log('FAIL',m))},wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=JSON.parse(fs.readFileSync(path.join(R,'data/cbb.json'),'utf8'));
function hub(url){const dom=new JSDOM('<!doctype html><head></head><body><div class="w"><h2>CBB Hub title</h2><p id="sub">s</p><div id="main-tabs">'+['overview','upsets','segments','hurdles','class','sim'].map(m=>`<button data-mt="${m}"${m==='overview'?' class="on"':''}>${m}</button>`).join('')+'</div><div id="out">hub</div><footer>f</footer></div></body>',{url,runScripts:'outside-only'});const w=dom.window;
 w.fetch=u=>Promise.resolve({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(R,u.split('?')[0].replace(/^\.\//,'')),'utf8'))});w.localStorage.setItem('sl-acct-probe','kept');
 const d=w.document;d.querySelectorAll('#main-tabs button').forEach(b=>b.onclick=()=>{d.querySelectorAll('#main-tabs button').forEach(x=>x.classList.toggle('on',x===b))});
 const bar=d.createElement('header');bar.id='v2bar';bar.innerHTML='<nav class="by"><a href="index.html">x</a></nav>';d.body.prepend(bar);
 for(const f of['navcfg.js','cbb-duel.js','cbb-sidenav.js'])w.eval(fs.readFileSync(path.join(R,f),'utf8'));
 return w}
async function sidebar(w){await wait(50);const s=w.document.body.querySelector('script[src^="side.js"]');if(s)w.eval(fs.readFileSync(path.join(R,'side.js'),'utf8'))}
(async()=>{const w=hub('https://x.test/index.html#duel'),d=w.document,root=()=>d.getElementById('duel-root');await sidebar(w);await wait(600);
 t(d.querySelector('.sl-side'),'in-hub sidebar mounted');const links=[...d.querySelectorAll('.sl-side a')];t(links.some(a=>a.getAttribute('href')==='index.html#duel'),'Duel in sidebar');t(!links.some(a=>/matchup-duel\.html/.test(a.href)),'no standalone link');
 t(d.querySelector('.sl-side a.cur')?.getAttribute('href')==='index.html#duel','sidebar active = Duel');t(w.getComputedStyle(d.querySelector('#v2bar nav.by')).display==='none','top section nav not duplicated');
 t(d.body.classList.contains('duel-on')&&!root().hidden,'visible');t(!d.querySelector('iframe'),'no iframe');
 const r=root();t(r.querySelectorAll('.dl-cmp tbody tr').length===7,'7 locally-documented metrics');t(!/havoc|per 40|tovRate|Turnover rate|Free-throw rate|Barthag/i.test([...r.querySelectorAll('.dl-cmp tbody th')].map(x=>x.textContent).join(' ')),'undocumented metrics omitted');
 t(!/Havoc/i.test(r.querySelector('.dl-ev').textContent),'no havoc narrative');t(/Ratings as of/.test(r.textContent),'as-of shown');
 const past=(D.games||[]).every(g=>Date.parse(g.start)<Date.now());if(past)t(/Historical game/.test(r.textContent)&&/not a current line/.test(r.textContent),'historical game labelled, no current claim');
 t(r.querySelectorAll('.dl-w').length>0&&[...r.querySelectorAll('.dl-cmp tbody tr')].filter(tr=>/tempo|3PA rate|3-point %|Offensive rebound/i.test(tr.cells[0].textContent)).every(tr=>!tr.querySelector('.dl-w')),'style/descriptive never highlighted');
 r.querySelector('.dl-swap').click();await wait(20);t(root().querySelector('select[data-k="a"]').value===String(D.games.find(g=>g.id===w.CBBDuel.state.game)?.home_tid),'swap');
 const T=D.teams.filter(x=>x.status==='ok'&&typeof x.adjO==='number');const a=root().querySelector('select[data-k="a"]'),b=root().querySelector('select[data-k="b"]');
 const pair=[T[0],T[1]].find(()=>true)&&(()=>{for(const x of T)for(const y of T)if(x!==y&&!D.games.some(g=>(g.home_tid===x.id&&g.away_tid===y.id)||(g.home_tid===y.id&&g.away_tid===x.id)))return[x,y]})();
 a.value=String(pair[0].id);a.dispatchEvent(new w.Event('change',{bubbles:true}));const b2=root().querySelector('select[data-k="b"]');b2.value=String(pair[1].id);b2.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(20);
 t(/Comparison only/.test(root().textContent)&&!/Hub model spread/.test(root().textContent),'hypothetical pair: comparison only, no model');
 const gs=root().querySelector('select[data-k="game"]');gs.value=gs.options[1].value;gs.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(20);t(/Hub model spread/.test(root().textContent),'game selector loads its pre-game model values');
 t(!/<script|onerror=/i.test(root().innerHTML),'no injected markup');
 w.location.hash='upsets';await wait(50);t(!d.body.classList.contains('duel-on')&&d.querySelector('#main-tabs button.on').dataset.mt==='upsets'&&d.querySelector('.sl-side a.cur')?.getAttribute('href')==='index.html#upsets','sidebar hash nav to Upset Radar');
 w.history.back();await wait(80);t(w.location.hash==='#duel'&&d.body.classList.contains('duel-on'),'back to Duel');w.history.forward();await wait(80);t(w.location.hash==='#upsets'&&!d.body.classList.contains('duel-on'),'forward');t(w.localStorage.getItem('sl-acct-probe')==='kept','no account/storage reset');
 const vc=new VirtualConsole();const old=new JSDOM('',{url:'https://x.test/matchup-duel.html?game='+D.games[0].id+'&conf=<b>&team=abc',runScripts:'outside-only',virtualConsole:vc});old.window.eval(fs.readFileSync(path.join(R,'duel-redirect.js'),'utf8'));t(old.window.__duelRedirect==='index.html?duel_game='+D.games[0].id+'#duel','old route -> hub view keeps supported game ID only');
 t(fs.readFileSync(path.join(R,'matchup-duel.html'),'utf8').includes('duel-redirect.js'),'old page is redirect only');
 const g=D.games[3],w3=hub('https://x.test/index.html?duel_game='+g.id+'#duel');await wait(600);t(w3.CBBDuel.state.a===g.away_tid&&w3.CBBDuel.state.b===g.home_tid,'redirected game ID selects that game');
 console.log(`hub_duel: ${ok} passed, ${bad} failed`);process.exit(bad?1:0)})();
