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
function bar(t,k,dir){const r=rk(t,k),n=RK[k].n;if(r==null)return '';if(dir===0)return `<span class="mut sm">Style · ${ord(r)} / ${n}<br>(highest value = 1)</span>`;const pct=Math.round((1-(r-1)/Math.max(1,n-1))*100);
 return `<div class="dl-bar" aria-hidden="true"><i style="width:${pct}%"></i></div><span class="mut sm">${ord(r)} of ${n} rated teams</span>`}
function draw(){const a=tm(st.a),b=tm(st.b);if(!a||!b){root.innerHTML='<div class="card">Teams unavailable in snapshot.</div>';return}
 const opt=s=>T.map(t=>`<option value="${t.id}"${t.id===s?' selected':''}>${E(t.team)} (${E(t.conf)})</option>`).join('');
 const games=(D.games||[]).filter(g=>tm(g.home_tid)&&tm(g.away_tid)),now=Date.now();
 const rows=M.map(([k,l,def,dir])=>{const w=dir===0||!num(a[k])||!num(b[k])||a[k]===b[k]?null:(dir>0?a[k]>b[k]:a[k]<b[k])?'a':'b';
  return `<tr><th scope="row">${E(l)}<details class="dl-definition"><summary>${dir===1?'Higher is better':dir===-1?'Lower is better':'Style · not an edge'}</summary><span class="dl-def">${E(def)}</span></details></th><td class="${w==='a'?'dl-w':''}">${num(a[k])?a[k]:'–'}${bar(a,k,dir)}</td><td class="${w==='b'?'dl-w':''}">${num(b[k])?b[k]:'–'}${bar(b,k,dir)}</td></tr>`}).join('');
 root.innerHTML=`<div class="vz-heading"><div><div class="vz-eyebrow">CBB HUB · MATCHUP DUEL</div><h2>Matchup Duel</h2><p>Two teams. Clear strengths. Context before conclusions.</p></div><div class="vz-status"><i></i><span>RECORDED · NOT LIVE</span></div></div><div class="dl-card dl-toolbar"><p class="mut sm">Ratings as of <b>${E(etf(D.ratings_as_of||D.model_built_utc))}</b> (${E(D.ratings_credit||'')}). Ranks are among the ${RK.adjO.n} rated teams in this hub snapshot, which is not a verified complete D-I census.</p>
 <div class="dl-ctl"><label>Game in snapshot<select data-k="game"><option value="">Pick any two teams…</option>${games.map(g=>`<option value="${E(g.id)}"${String(g.id)===String(st.game)&&meetAll(a,b).some(x=>x.id===g.id)?' selected':''}>${E(g.away_name+' at '+g.home_name)} · ${Date.parse(g.start)<now?'played':'upcoming'} ${E(new Date(g.start).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'}))}</option>`).join('')}</select></label>
 <label>Team A<select data-k="a">${opt(a.id)}</select></label><button type="button" class="dl-swap" aria-label="Swap teams">⇄ Swap</button><label>Team B<select data-k="b">${opt(b.id)}</select></label></div></div>
 <div class="dl-teams">${[a,b].map((t,i)=>`<section class="card dl-team dl-team-${i}"><div><span class="dl-team-label">TEAM ${i?'B':'A'} · ${E(t.conf)}</span><h3>${E(t.team)}</h3><span class="mut sm">AdjEM rank ${ord(rk(t,'adjEM'))} of ${RK.adjEM.n}</span></div><div class="dl-team-value"><b>${num(t.adjEM)?(t.adjEM>0?'+':'')+t.adjEM:'–'}</b><span>AdjEM / 100 poss.</span></div></section>`).join('')}</div>
 <div class="dl-lay"><div class="card"><div class="dl-card-head"><h3>Ratings head to head</h3><span>QUALITY + STYLE</span></div><div class="dl-scroll"><table class="dl-t dl-cmp"><thead><tr><th>Metric</th><th>${E(a.team)}</th><th>${E(b.team)}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="mut sm">Tint = better on a quality metric, not a predicted winner. Bars show rank among rated teams. Style rows are never highlighted. Select a definition for methodology.</p></div><aside><div class="card dl-context"><div class="dl-card-head"><h3>Game & model context</h3><span>SNAPSHOT ONLY</span></div>${context(a,b)}</div><div class="card dl-guide"><h3>Read the matchup, not just the rank</h3><p>AdjO and AdjD share the same unit: points per 100 possessions. Compare offense with the opposing defense.</p><p class="mut sm">Tempo and shot profile describe style. They do not establish a mismatch on their own. Venue, roster availability and a current price remain separate inputs.</p></div></aside></div>
 <div class="card"><div class="dl-card-head"><h3>What the ratings say</h3><span>EVIDENCE, NOT A PICK</span></div><ul class="dl-ev">${evidence(a,b).join('')}</ul></div><footer class="dl-foot">${RK.adjO.n} rated teams · ${(D.teams||[]).filter(t=>t.status==='pending').length} pending in repository metadata · Recorded data, not live prices. Undocumented team metrics are omitted.</footer>`}
const CSS=`<style id="dlcss">body.duel-on #main-tabs~*:not(#duel-root):not(footer):not(#sched-out):not(#sl-modal-root){display:none!important}body.duel-on #main-tabs,body.duel-on #sub,body.duel-on #top-ctl,body.duel-on #tab-out,body.duel-on #sched-out,body.duel-on #gm-out,body.duel-on #out{display:none!important}
body.duel-on{background:#080f11;color:#dce9e8}body.duel-on .w{max-width:1440px;padding:18px 24px}body.duel-on .w>h2{display:none}
body.duel-on .sl-side{background:#0d191c;border-color:#223438;width:206px;font-size:14px}body.duel-on .sl-side h4{color:#899c9f;font-size:11px}body.duel-on .sl-side a{border-radius:3px;padding:8px 10px;color:#aebfc0;font-weight:500}body.duel-on .sl-side a.cur{background:#162d2d;box-shadow:inset 2px 0 #32c9b5;color:#e7f6f1}body.duel-on .sl-tog{background:#122528;border-color:#294044;color:#b8d2d0}
#duel-root{--vb:#111f22;--vp:#14272a;--vl:#263a3d;--vm:#32c9b5;--vt:#dfebea;--vs:#9db1b3;color:var(--vt);font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:1280px;margin:0 auto}
#duel-root .vz-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:4px 0 16px}#duel-root .vz-heading h2{font-size:24px;line-height:1.2;font-weight:750;letter-spacing:-.6px;margin:3px 0 6px}#duel-root .vz-heading p{margin:0;color:var(--vs);font-size:14px}
#duel-root .vz-eyebrow{font-size:10px;font-weight:750;color:#68adab;letter-spacing:1.3px}#duel-root .vz-status{display:flex;align-items:center;gap:7px;font:11px/1.4 ui-monospace,monospace;color:#a6bfbc;border:1px solid #2a4444;border-radius:4px;padding:5px 9px;white-space:nowrap}#duel-root .vz-status i{height:5px;width:5px;background:var(--vm);border-radius:50%}
#duel-root .dl-ctl{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:0 0 16px}#duel-root label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:#a8c4bf;min-width:0}#duel-root label:first-child{flex:1 1 280px;max-width:420px}
#duel-root select,#duel-root .dl-swap,#duel-root button{
  appearance:none!important;-webkit-appearance:none!important;color-scheme:dark!important;
  width:100%;max-width:100%;min-height:44px;padding:10px 14px;border-radius:10px;
  border:1px solid #3a675c;background:#113d36;color:#eefaf5;font:inherit;
  transition:background .15s,border-color .15s,color .15s,box-shadow .15s}
#duel-root select{
  padding-right:36px;
  background:#113d36 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%239dbfbb' d='M1 1l5 5 5-5'/%3E%3C/svg%3E") right 14px center/12px no-repeat;
  box-shadow:inset 0 1px 0 #ffffff08}
#duel-root select:hover,#duel-root .dl-swap:hover{border-color:#7de4c3}
#duel-root .dl-swap{cursor:pointer;width:auto;border-radius:999px;background:#174e40;border-color:#2f7a68;color:#b5ffe4;font-weight:750;padding:0 18px;min-width:96px}
#duel-root .dl-lay{display:grid;grid-template-columns:minmax(0,1.85fr) minmax(280px,1fr);gap:16px;align-items:start}
#duel-root .card,#duel-root .dl-card{background:var(--vb);border:1px solid var(--vl);border-radius:6px;padding:16px;margin-bottom:14px;box-shadow:0 2px 8px #00000012}#duel-root .dl-card h3{margin:0 0 12px;font-size:13px;font-weight:700;color:#d7e9e6}
#duel-root .dl-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}#duel-root .dl-team{background:#14272a;border:1px solid #263c40;border-radius:6px;padding:14px}#duel-root .dl-team.a{border-color:#3a6f8a}#duel-root .dl-team.b{border-color:#8a4a52}
#duel-root .dl-team .nm{font-size:15px;font-weight:750;margin:0 0 4px}#duel-root .dl-team .rk{font-size:11px;color:var(--vs)}#duel-root .dl-team .big{font-size:32px;letter-spacing:-1px;font-variant-numeric:tabular-nums;margin:8px 0 2px;line-height:1.15}#duel-root .dl-team.a .big{color:#72afff}#duel-root .dl-team.b .big{color:#f16c76}
#duel-root .dl-scroll{overflow-x:auto}#duel-root .dl-t{width:100%;border-collapse:collapse;font-size:13px}#duel-root .dl-t th,#duel-root .dl-t td{padding:12px 8px;border-bottom:1px solid var(--vl);text-align:left;vertical-align:top;font-variant-numeric:tabular-nums}#duel-root .dl-t thead th{font-size:10px;letter-spacing:.4px;color:#9db5b6;text-transform:uppercase}
#duel-root .dl-def{display:block;font-weight:400;font-size:11px;color:var(--vs);margin-top:4px;line-height:1.45}#duel-root .dl-bar{height:7px;background:#253b3e;border-radius:99px;overflow:hidden;margin-top:6px}#duel-root .dl-bar>i{display:block;height:100%;background:var(--vm)}
#duel-root .dl-ev{padding-left:18px;line-height:1.55;margin:0}#duel-root .dl-ev li{margin-bottom:8px}#duel-root .dl-hist{background:#102326;border:1px solid #2a4444;border-radius:4px;padding:10px 12px;font-size:13px;color:#d6e5e3}
#duel-root :focus-visible{outline:2px solid var(--vm);outline-offset:2px}
@media(min-width:768px){body.duel-on.sl-open{padding-left:206px}}
@media(max-width:960px){#duel-root .dl-lay{grid-template-columns:1fr}}
@media(max-width:600px){body.duel-on .w{padding:12px}#duel-root .vz-heading{flex-direction:column;gap:8px}#duel-root .vz-heading h2{font-size:21px}#duel-root .dl-pair{grid-template-columns:1fr}#duel-root .dl-team .big{font-size:28px}#duel-root label:first-child{flex:1 1 100%;max-width:none}#duel-root select,#duel-root .dl-swap{min-height:44px}}
body.duel-on .sl-side .sl-brand{white-space:nowrap;font-size:15px}</style>`;
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
