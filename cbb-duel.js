/* CBB Hub · Matchup Duel, integrated hub view (index.html#duel). Display-only.
   Field meanings are taken only from this repo (see README note in DUEL_FIELDS.md); fields whose team-level
   construction is not documented locally (efg, ftr, tovRate, havoc40, barthag) are not shown. */
(function(){'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// key,label,definition (local source),direction: 1 higher better, -1 lower better, 0 descriptive/style
const M=[
 ['adjEM','Adjusted efficiency margin (AdjEM)','AdjO minus AdjD for every rated team in data/cbb.json (checked: all 361 match to 0.1). Points per 100 possessions vs an average D-I team (hub footer).',1],
 ['adjO','Adjusted offense (AdjO)','Hub "Torvik O": points scored per 100 possessions vs an average D-I team (hub footer; Ratings: barttorvik.com).',1],
 ['adjD','Adjusted defense (AdjD)','Hub "Torvik D": points allowed per 100 possessions vs an average D-I team (hub footer; Ratings: barttorvik.com).',-1],
 ['adjT','Adjusted tempo (AdjT)','Hub tempo rating; enrich_cbb_hub.py averages both teams’ AdjT as the projected game pace in possessions. Style, not quality.',0],
 ['threeRate','3PA rate (3PAr)','Hub label “3PAr” (enrich_cbb_hub.py upset triggers): share of shots taken from three, preseason prior. Style.',0],
 ['threePct','3-point % (3P%)','Hub label “3P%” (enrich_cbb_hub.py), preseason prior. Shown descriptively; builder not in this repo.',0],
 ['orbPct','Offensive rebound % (ORB%)','Hub label “ORB” (enrich_cbb_hub.py), preseason prior. Shown descriptively; no opponent rebounding field exists to compare against.',0]];
let D=null,T=[],RK={},AVG={},st={a:null,b:null,game:null},root=null;
const num=v=>typeof v==='number'&&isFinite(v);
function ranks(){M.forEach(([k,,,dir])=>{const xs=T.filter(t=>num(t[k])).sort((x,y)=>dir<0?x[k]-y[k]:y[k]-x[k]);RK[k]={n:xs.length,r:new Map(xs.map((t,i)=>[t.id,i+1]))};AVG[k]=xs.reduce((a,t)=>a+t[k],0)/Math.max(1,xs.length)})}
const rk=(t,k)=>RK[k]&&RK[k].r.get(t.id);const ord=n=>n==null?'–':n+(['th','st','nd','rd'][(n%100>10&&n%100<14)?0:n%10]||'th');
const tm=id=>T.find(t=>t.id===+id);const etf=s=>new Date(s).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})+' ET';
const meetAll=(a,b)=>(D.games||[]).filter(g=>(g.home_tid===a.id&&g.away_tid===b.id)||(g.home_tid===b.id&&g.away_tid===a.id));
function evidence(a,b){const out=[],f=v=>v.toFixed(1);
 const od=(o,d)=>{if(!num(o.adjO)||!num(d.adjD))return;const ox=o.adjO-AVG.adjO,dx=AVG.adjD-d.adjD;
  out.push(`<li><b>${E(o.team)} offense vs ${E(d.team)} defense</b> (same unit, points per 100 possessions): ${E(o.team)} scores ${f(o.adjO)} (${ox>=0?f(ox)+' above':f(-ox)+' below'} the rated-team mean ${f(AVG.adjO)}); ${E(d.team)} allows ${f(d.adjD)} (${dx>=0?f(dx)+' better':f(-dx)+' worse'} than the mean ${f(AVG.adjD)}). ${Math.abs(ox-dx)<1.5?'These two sides are about equally strong relative to average.':ox>dx?`${E(o.team)}'s offense is further above average than ${E(d.team)}'s defense.`:`${E(d.team)}'s defense is further above average than ${E(o.team)}'s offense.`}</li>`)};
 od(a,b);od(b,a);
 if(num(a.adjEM)&&num(b.adjEM))out.push(`<li><b>Overall margin</b>: AdjEM ${E(a.team)} ${f(a.adjEM)} vs ${E(b.team)} ${f(b.adjEM)} (gap ${f(Math.abs(a.adjEM-b.adjEM))} per 100 possessions, before venue or roster context).</li>`);
 if(num(a.adjT)&&num(b.adjT))out.push(`<li><b>Tempo (style)</b>: AdjT ${E(a.team)} ${a.adjT} vs ${E(b.team)} ${b.adjT}. ${Math.abs(a.adjT-b.adjT)<2?'Similar pace preferences.':`${E(a.adjT>b.adjT?a.team:b.team)} prefers the faster game by ${Math.abs(a.adjT-b.adjT).toFixed(1)}.`} Tempo is not a quality edge.</li>`);
 if(num(a.threeRate)&&num(b.threeRate))out.push(`<li><b>Shot profile (style)</b>: 3PAr ${E(a.team)} ${a.threeRate}% vs ${E(b.team)} ${b.threeRate}%. No opponent three-point defence field exists, so no mismatch is claimed.</li>`);
 return out}
function context(a,b){const gs=meetAll(a,b),now=Date.now();
 const g=gs.find(x=>String(x.id)===String(st.game))||gs.find(x=>Date.parse(x.start)>=now)||gs[gs.length-1];
 if(!g)return `<p><b>Comparison only.</b> ${E(a.team)} and ${E(b.team)} are not scheduled against each other in this snapshot, so this is a hypothetical ratings comparison. No model line or market is shown.</p>`;
 const past=Date.parse(g.start)<now,h=g.home_tid===a.id?a:b,aw=h===a?b:a,sp=g.spread_home,hw=g.home_win;
 return `<p><b>${past?'Historical game':'Scheduled game'}: ${E(g.away_name)} at ${E(g.home_name)}</b>${g.neutral?' (neutral site)':''}, tip ${E(etf(g.start))}.</p>
 ${past?`<p class="dl-hist">This game has already tipped. The values below are the hub model's pre-game snapshot for it, kept for reference. They are not a current line or a pick.</p>`:''}
 <table class="dl-t"><tr><td>Hub model spread</td><td>${num(sp)?E(h.team)+' '+(sp>0?'+':'')+sp:'–'}</td></tr><tr><td>Hub model total</td><td>${num(g.total)?g.total:'–'}</td></tr><tr><td>Hub model win probability</td><td>${num(hw)?E(h.team)+' '+Math.round(hw*100)+'% · '+E(aw.team)+' '+Math.round((1-hw)*100)+'%':'–'}</td></tr><tr><td>Projected pace</td><td>${num(g.pace)?g.pace+' possessions':'–'}</td></tr></table>
 <p class="mut sm">From data/cbb.json games, as produced by enrich_cbb_hub.py. No sportsbook price is stored for this game.</p>`}
function bar(t,k,dir){const r=rk(t,k),n=RK[k].n;if(r==null)return '';if(dir===0)return `<span class="mut sm">descriptive · value rank ${ord(r)} of ${n} (highest = 1)</span>`;const pct=Math.round((1-(r-1)/Math.max(1,n-1))*100);
 return `<div class="dl-bar" aria-hidden="true"><i style="width:${pct}%"></i></div><span class="mut sm">${ord(r)} of ${n} rated teams</span>`}
function draw(){const a=tm(st.a),b=tm(st.b);if(!a||!b){root.innerHTML='<div class="card">Teams unavailable in snapshot.</div>';return}
 const opt=s=>T.map(t=>`<option value="${t.id}"${t.id===s?' selected':''}>${E(t.team)} (${E(t.conf)})</option>`).join('');
 const games=(D.games||[]).filter(g=>tm(g.home_tid)&&tm(g.away_tid)),now=Date.now();
 const rows=M.map(([k,l,def,dir])=>{const w=dir===0||!num(a[k])||!num(b[k])||a[k]===b[k]?null:(dir>0?a[k]>b[k]:a[k]<b[k])?'a':'b';
  return `<tr><th scope="row">${E(l)}<span class="dl-def">${E(def)} ${dir===1?'Higher is better.':dir===-1?'Lower is better.':''}</span></th><td class="${w==='a'?'dl-w':''}">${num(a[k])?a[k]:'–'}${bar(a,k,dir)}</td><td class="${w==='b'?'dl-w':''}">${num(b[k])?b[k]:'–'}${bar(b,k,dir)}</td></tr>`}).join('');
 root.innerHTML=`<div class="card"><h2>⚔️ Matchup Duel</h2><p class="mut sm">Ratings as of <b>${E(etf(D.ratings_as_of||D.model_built_utc))}</b> (${E(D.ratings_credit||'')}). Ranks are among the ${RK.adjO.n} rated teams in this hub snapshot, which is not a verified complete D-I census.</p>
 <div class="dl-ctl"><label>Game in snapshot<select data-k="game"><option value="">Pick any two teams…</option>${games.map(g=>`<option value="${E(g.id)}"${String(g.id)===String(st.game)&&meetAll(a,b).some(x=>x.id===g.id)?' selected':''}>${E(g.away_name+' at '+g.home_name)} · ${Date.parse(g.start)<now?'played':'upcoming'} ${E(new Date(g.start).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'}))}</option>`).join('')}</select></label>
 <label>Team A<select data-k="a">${opt(a.id)}</select></label><button type="button" class="dl-swap" aria-label="Swap teams">⇄ Swap</button><label>Team B<select data-k="b">${opt(b.id)}</select></label></div></div>
 <div class="dl-lay"><div class="card"><h3>What the ratings say</h3><ul class="dl-ev">${evidence(a,b).join('')}</ul></div><div class="card"><h3>Game & model context</h3>${context(a,b)}</div></div>
 <div class="card"><div class="dl-scroll"><table class="dl-t dl-cmp"><thead><tr><th>Metric</th><th>${E(a.team)}</th><th>${E(b.team)}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="mut sm">Highlighted cell = better on a quality metric. Style and descriptive rows are never highlighted. eFG%, FT rate, turnover rate, havoc and Barthag are omitted: their team-level construction isn't documented in this repo.</p></div>`}
const CSS=`<style id="dlcss">body.duel-on #main-tabs~*:not(#duel-root):not(footer){display:none!important}body.duel-on #main-tabs,body.duel-on #sub{display:none}
#duel-root .dl-ctl{display:flex;gap:10px;flex-wrap:wrap;align-items:end}#duel-root label{display:flex;flex-direction:column;font-size:12px;gap:4px;color:var(--mut)}
#duel-root select,#duel-root .dl-swap{background:var(--panel2);color:var(--txt);border:1px solid var(--line);border-radius:10px;padding:9px 10px;min-height:44px;font:inherit;max-width:100%}#duel-root .dl-swap{cursor:pointer}
#duel-root :focus-visible{outline:2px solid #38d0f0;outline-offset:2px}.dl-lay{display:grid;grid-template-columns:1.3fr 1fr;gap:12px}.dl-ev{padding-left:18px;line-height:1.55}.dl-ev li{margin-bottom:8px}
.dl-hist{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.45);border-radius:8px;padding:8px 10px;font-size:13px}
.dl-scroll{overflow-x:auto}.dl-t{width:100%;border-collapse:collapse}.dl-cmp{min-width:560px}.dl-t td,.dl-t th{padding:8px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.dl-cmp tbody th{font-weight:700;text-transform:none;letter-spacing:0}.dl-def{display:block;font-weight:400;font-size:12px;color:var(--mut);max-width:420px}.dl-w{background:rgba(56,208,240,.10)}
.dl-bar{height:6px;background:var(--panel2);border-radius:3px;margin:4px 0 2px;max-width:160px}.dl-bar i{display:block;height:100%;background:#38d0f0;border-radius:3px}
@media(max-width:800px){.dl-lay{grid-template-columns:1fr}#duel-root .dl-ctl label{flex:1 1 100%}#duel-root select{width:100%}}</style>`;
function show(){const on=location.hash==='#duel';document.body.classList.toggle('duel-on',on);if(!root)return;root.hidden=!on;if(on&&D)draw()}
function init(){document.head.insertAdjacentHTML('beforeend',CSS);root=document.createElement('section');root.id='duel-root';root.hidden=true;root.setAttribute('aria-live','polite');
 const tabs=document.getElementById('main-tabs');(tabs?tabs.after(root):document.body.prepend(root));
 root.addEventListener('change',e=>{const k=e.target.dataset.k;if(k==='game'&&e.target.value){const g=(D.games||[]).find(x=>String(x.id)===e.target.value);if(g){st.a=g.away_tid;st.b=g.home_tid;st.game=g.id}}else if(k==='a'||k==='b'){st[k]=+e.target.value;st.game=null}else if(k==='game')st.game=null;draw();const f=root.querySelector(`select[data-k="${k}"]`);f&&f.focus()});
 root.addEventListener('click',e=>{if(e.target.closest('.dl-swap')){[st.a,st.b]=[st.b,st.a];draw();root.querySelector('.dl-swap').focus()}});
 addEventListener('hashchange',show);
 const q=new URLSearchParams(location.search);
 const go=d=>{D=d;T=(d.teams||[]).filter(t=>t.status==='ok'&&num(t.adjO)&&num(t.adjD)).sort((x,y)=>x.team.localeCompare(y.team));ranks();
  const gs=(d.games||[]).filter(g=>tm(g.home_tid)&&tm(g.away_tid)),qg=gs.find(g=>String(g.id)===q.get('duel_game')),qt=tm(q.get('duel_team'));
  const g=qg||gs.find(g=>Date.parse(g.start)>=Date.now())||gs[gs.length-1];
  if(qt&&!qg){st.a=qt.id;st.b=(g&&g.home_tid!==qt.id?g.home_tid:T.find(t=>t.id!==qt.id).id)}else if(g){st.a=g.away_tid;st.b=g.home_tid;st.game=g.id}else{st.a=T[0].id;st.b=T[1].id}show()};
 window.CBB&&CBB.data?CBB.data(go):fetch('./data/cbb.json').then(r=>r.json()).then(go);show()}
document.readyState==='complete'?init():document.addEventListener('DOMContentLoaded',init);
window.CBBDuel={state:st};
})();
