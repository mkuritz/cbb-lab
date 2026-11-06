/* DOM checks: real published data + clearly separate synthetic unit fixture. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=JSON.parse(read('data/cbb.json')),an=JSON.parse(read('data/matchup_an.json'));
const wait=()=>new Promise(r=>setTimeout(r,0));
function env(data=an){
 const dom=new JSDOM('<!doctype html><html><head></head><body><a href="elsewhere.html" data-cbb-player="4848637" data-cbb-tid="135">Milan Momcilovic</a></body></html>',{url:'http://localhost/players.html',runScripts:'outside-only'});
 let calls=[];
 dom.window.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>url.startsWith('data/matchup_an')?data:url==='data/cbb.json'?source:{}}};
 dom.window.eval(read('matchup-analyzer.js'));
 dom.window.eval(read('cbb.js'));
 return {dom,w:dom.window,document:dom.window.document,calls};
}
(async()=>{
 // Every shared-modal entrypoint must load the analyzer first and cache-bust both scripts.
 for(const page of ['players','props','index','team','teams','transfers','method']){
  const html=read(page+'.html');
  assert.match(html,/matchup-analyzer\.js\?v=cbb-matchup-1/);
  assert.match(html,/cbb\.js\?v=cbb-matchup-1/);
  assert(html.indexOf('matchup-analyzer.js')<html.indexOf('src="cbb.js'));
 }
 const e=env(),{document:d,w}=e;
 d.querySelector('[data-cbb-player]').click();await wait();
 const profile=d.querySelector('#cbb-panel-profile'),matchup=d.querySelector('#cbb-panel-matchup');
 assert(profile&&!profile.hidden);assert(matchup.hidden);
 assert.match(profile.textContent,/2026-27 Projected Role, Minutes & Usage/);
 assert.match(profile.textContent,/2025-26 D-I Efficiency/);
 assert.equal(e.calls.filter(x=>x.startsWith('data/matchup_an')).length,0);
 const before=profile.innerHTML;
 d.querySelector('#cbb-tab-matchup').click();await wait();
 assert(profile.hidden);assert(!matchup.hidden);
 assert.match(matchup.textContent,/No upcoming game with logged games/);
 assert.match(matchup.textContent,/0 valid logged games/);
 assert.match(matchup.textContent,/Kansas/);
 assert.match(matchup.textContent,/Ratings: barttorvik.com/);
 assert.deepEqual(Array.from(matchup.querySelectorAll('[data-cma-section]'),b=>b.textContent),['Opponent']);
 const row=an.players['135|4848637'];
 for(const c of row.opponent_context)assert(matchup.textContent.includes(c.value.toFixed(1)));
 assert.equal(w.location.pathname,'/players.html');
 d.querySelector('#cbb-tab-profile').click();assert.equal(profile.innerHTML,before);
 assert(!profile.hidden);assert(matchup.hidden);
 // Arrow-key tab activation also lazily renders content, never changes location.
 d.querySelector('#cbb-tab-profile').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 assert(!matchup.hidden);assert.equal(d.querySelector('#cbb-tab-matchup').getAttribute('aria-selected'),'true');
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!d.querySelector('#cbb-modal-ov'));
 // Compare the entire default Profile body byte-for-byte with the pre-change modal.
 const original=execFileSync('git',['show','143008a:cbb.js'],{cwd:root,encoding:'utf8'});
 const old=env();old.document.body.innerHTML='';old.w.eval(original);old.w.CBB.openPlayerModal('4848637','135');await wait();
 const nodes=Array.from(old.document.querySelector('#cbb-modal').children).slice(2).map(n=>n.outerHTML).join('');
 assert.equal(nodes,before,'Existing Profile content must be unchanged');
 old.dom.window.close();
 // No schedule: all analysis sections hidden, no blanks/fake zeros.
 const noNext=Object.values(an.players).find(p=>p.status==='no_upcoming'&&p.id);
 w.CBB.openPlayerModal(noNext.id,noNext.tid);await wait();d.querySelector('#cbb-tab-matchup').click();await wait();
 assert.match(d.querySelector('#cbb-panel-matchup').textContent,/No future game/);
 assert.equal(d.querySelectorAll('[data-cma-section]').length,0);
 // Synthetic fixture proves all four render paths. Not real-player evidence.
 const code="import sys,json;sys.path.insert(0,'tests');from test_matchup_builder import fixture,NOW,b;print(json.dumps(b.build(fixture(),NOW)))";
 const fixtureData=JSON.parse(execFileSync('python3',['-c',code],{cwd:root,encoding:'utf8'}));
 const host=d.createElement('div');d.body.appendChild(host);
 const fp=fixtureData.players['1|0'];w.CBBMatchup.mount(host,fp,fixtureData);
 assert.deepEqual(Array.from(host.querySelectorAll('[data-cma-section]'),b=>b.textContent),['Overview','Splits','Opponent','Similar players']);
 assert(host.querySelector('svg'));
 for(const tab of host.querySelectorAll('[data-cma-section]')){tab.click();assert.equal(tab.getAttribute('aria-selected'),'true');assert(!host.querySelector('#'+tab.getAttribute('aria-controls')).hidden)}
 assert(!/undefined|NaN/.test(host.textContent));
 // Stale cached next-game timestamps must not resurrect a started matchup.
 const stale=structuredClone(an);stale.players['135|4848637'].next.start='2026-01-01T00:00Z';
 const x=env(stale);x.w.CBB.openPlayerModal('4848637','135');await wait();x.document.querySelector('#cbb-tab-matchup').click();await wait();
 assert.match(x.document.querySelector('#cbb-panel-matchup').textContent,/No future game/);x.dom.window.close();
 // Hostile display fields must stay text, not elements/handlers (XSS regression).
 const hostile=structuredClone(fp),bad='<img src=x onerror="window.PWNED=1">';
 hostile.name=bad;hostile.next.opponent=bad;hostile.role=bad;
 hostile.windows.All.n=bad;hostile.similar[0].name=bad;
 hostile.axes[0].label=bad;hostile.opponent_context[0].label=bad;
 w.CBBMatchup.mount(host,hostile,fixtureData);
 assert.equal(host.querySelectorAll('img,[onerror],script').length,0);
 hostile.status='insufficient_logs';hostile.logged_games=bad;
 w.CBBMatchup.mount(host,hostile,{...fixtureData,minimum_games:bad});
 assert.equal(host.querySelectorAll('img,[onerror],script').length,0);
 assert(host.textContent.includes(bad));
 console.log(JSON.stringify({realExample:row,entrypoints:7,profileUnchanged:true,syntheticFourTabs:true,xssEscaped:true},null,2));
 e.dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1});
