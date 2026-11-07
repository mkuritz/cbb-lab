/* CBB Hub · Matchup Duel as an integrated hub view (index.html#duel). Display-only:
   compares two teams on existing recorded ratings (data/cbb.json, ratings: barttorvik.com) and shows
   the existing hub game model line only when the two teams actually meet in the snapshot. No new picks or model. */
(function(){'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=[ // key,label,definition,direction(1 higher better,-1 lower better,0 style)
 ['adjEM','Adjusted efficiency margin','Points scored minus allowed per 100 possessions vs an average D-I team.',1],
 ['adjO','Adjusted offense (AdjO)','Points scored per 100 possessions, adjusted for opponent.',1],
 ['adjD','Adjusted defense (AdjD)','Points allowed per 100 possessions, adjusted for opponent.',-1],
 ['adjT','Adjusted tempo','Possessions per 40 minutes. Style, not quality.',0],
 ['efg','Effective FG%','Field-goal % with threes weighted 1.5×.',1],
 ['threePct','3-point %','Share of three-point attempts made.',1],
 ['threeRate','3-point attempt rate','Share of field-goal attempts taken from three. Style.',0],
 ['orbPct','Offensive rebound %','Share of own missed shots rebounded.',1],
 ['ftr','Free-throw rate','Free-throw attempts per field-goal attempt.',1],
 ['tovRate','Turnover rate','Possessions ending in a turnover.',-1],
 ['havoc40','Havoc (defense)','Existing hub defensive havoc rating per 40 minutes (forced-disruption measure). Higher means more disruptive.',1]];
let D=null,T=[],RK={},st={a:null,b:null},root=null;
const num=v=>typeof v==='number'&&isFinite(v);
function ranks(){M.forEach(([k,,,dir])=>{const xs=T.filter(t=>num(t[k])).sort((x,y)=>dir<0?x[k]-y[k]:y[k]-x[k]);RK[k]={n:xs.length,r:new Map(xs.map((t,i)=>[t.id,i+1]))}})}
const rk=(t,k)=>RK[k]&&RK[k].r.get(t.id);const ord=n=>n==null?'–':n+(['th','st','nd','rd'][(n%100>10&&n%100<14)?0:n%10]||'th');
const tm=id=>T.find(t=>t.id===+id);
function meet(a,b){const g=(D.games||[]).find(g=>(g.home_tid===a.id&&g.away_tid===b.id)||(g.home_tid===b.id&&g.away_tid===a.id));return g||null}
function evidence(a,b){const out=[];const sp=(x,y)=>Math.abs(x-y);
 const pair=(o,d,ok,dk,what)=>{const r1=rk(o,ok),r2=rk(d,dk);if(r1==null||r2==null)return;const gap=r2-r1;
  out.push(`<li><b>${E(o.team)} ${what}</b>: ${E(o.team)} ranks ${ord(r1)} in ${E(M.find(m=>m[0]===ok)[1])} (${o[ok]}); ${E(d.team)} ranks ${ord(r2)} in ${E(M.find(m=>m[0]===dk)[1])} (${d[dk]}). ${Math.abs(gap)<25?'Roughly even.':gap>0?`Edge to ${E(o.team)} by ${gap} spots.`:`Edge to ${E(d.team)} by ${-gap} spots.`}</li>`)};
 pair(a,b,'adjO','adjD','offense vs defense');pair(b,a,'adjO','adjD','offense vs defense');
 if(num(a.adjT)&&num(b.adjT))out.push(`<li><b>Tempo</b>: ${E(a.team)} ${a.adjT} vs ${E(b.team)} ${b.adjT} possessions/40. ${sp(a.adjT,b.adjT)<2?'Similar pace preferences.':`A ${sp(a.adjT,b.adjT).toFixed(1)}-possession gap: ${E(a.adjT>b.adjT?a.team:b.team)} wants to run.`}</li>`);
 const tv=(o,d)=>{if(num(o.tovRate)&&num(d.havoc40))out.push(`<li><b>Ball security</b>: ${E(o.team)} turns it over on ${o.tovRate}% (${ord(rk(o,'tovRate'))} best) and faces ${E(d.team)}'s havoc ${d.havoc40} (${ord(rk(d,'havoc40'))}).</li>`)};tv(a,b);tv(b,a);
 if(num(a.threeRate)&&num(b.threeRate))out.push(`<li><b>Shot profile</b>: ${E(a.team)} takes ${a.threeRate}% of shots from three (makes ${a.threePct}%); ${E(b.team)} ${b.threeRate}% (makes ${b.threePct}%). Opponent 3PT defence is not in the hub data, so this is style only.</li>`);
 if(num(a.orbPct)&&num(b.orbPct))out.push(`<li><b>Glass</b>: offensive rebound % ${E(a.team)} ${a.orbPct} (${ord(rk(a,'orbPct'))}) vs ${E(b.team)} ${b.orbPct} (${ord(rk(b,'orbPct'))}). Defensive rebounding is not recorded here.</li>`);
 return out}
function model(a,b){const g=meet(a,b);if(!g)return `<p class="mut sm">These teams do not play each other in the current hub snapshot, so no model line is shown. The comparison above is ratings only, not a prediction.</p>`;
 const h=g.home_tid===a.id?a:b,aw=h===a?b:a,sp=g.spread_home,hw=g.home_win;
 return `<p><b>${E(g.away_name)} at ${E(g.home_name)}</b>${g.neutral?' (neutral site)':''} · ${E(new Date(g.start).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))} ET</p>
 <table class="dl-t"><tr><td>Existing hub spread</td><td>${num(sp)?E(h.team)+' '+(sp>0?'+':'')+sp:'–'}</td></tr><tr><td>Hub total</td><td>${num(g.total)?g.total:'–'}</td></tr><tr><td>Hub win probability</td><td>${num(hw)?E(h.team)+' '+Math.round(hw*100)+'% · '+E(aw.team)+' '+Math.round((1-hw)*100)+'%':'–'}</td></tr><tr><td>Projected pace</td><td>${num(g.pace)?g.pace+' poss':'–'}</td></tr></table>
 <p class="mut sm">Shown exactly as the existing CBB model produced it. No sportsbook price for this game is stored in the snapshot, so none is shown.</p>`}
function bar(t,k,dir){const r=rk(t,k),n=RK[k].n;if(r==null)return '<span class="mut">–</span>';const pct=dir===0?50:Math.round((1-(r-1)/Math.max(1,n-1))*100);
 return `<div class="dl-bar" title="${E(ord(r)+' of '+n)}"><i style="width:${dir===0?0:pct}%"></i></div><span class="mut sm">${dir===0?'style':ord(r)+' / '+n}</span>`}
function draw(){const a=tm(st.a),b=tm(st.b);if(!a||!b){root.innerHTML='<div class="card">Teams unavailable in snapshot.</div>';return}
 const opt=s=>T.map(t=>`<option value="${t.id}"${t.id===s?' selected':''}>${E(t.team)} (${E(t.conf)})</option>`).join('');
 const games=(D.games||[]).filter(g=>tm(g.home_tid)&&tm(g.away_tid)&&Date.parse(g.start)>=Date.now()-6*36e5);
 const rows=M.map(([k,l,def,dir])=>{const w=dir===0||!num(a[k])||!num(b[k])||a[k]===b[k]?null:(dir>0?a[k]>b[k]:a[k]<b[k])?'a':'b';
  return `<tr><th scope="row">${E(l)}<div class="mut sm" style="text-transform:none;font-weight:400;letter-spacing:0">${E(def)}${dir===1?' Higher is better.':dir===-1?' Lower is better.':''}</div></th><td class="${w==='a'?'dl-w':''}">${num(a[k])?a[k]:'–'}${bar(a,k,dir)}</td><td class="${w==='b'?'dl-w':''}">${num(b[k])?b[k]:'–'}${bar(b,k,dir)}</td></tr>`}).join('');
 root.innerHTML=`<div class="card"><h2>⚔️ Matchup Duel</h2><p class="mut sm">Pick any two D-I teams. Each row is a raw recorded rating with its definition, which way is better, and its D-I rank. Ratings as of ${E(D.ratings_as_of||D.built||'')} (${E(D.ratings_credit||'')}).</p>
 <div class="dl-ctl"><label>Scheduled game<select data-k="g"><option value="">Choose a hub game…</option>${games.map(g=>`<option value="${g.away_tid}-${g.home_tid}">${E(g.away_name+' at '+g.home_name)}</option>`).join('')}</select></label>
 <label>Team A<select data-k="a">${opt(a.id)}</select></label><button type="button" class="dl-swap" aria-label="Swap teams">⇄ Swap</button><label>Team B<select data-k="b">${opt(b.id)}</select></label></div></div>
 <div class="dl-lay"><div class="card"><h3>Where the matchup is decided</h3><ul class="dl-ev">${evidence(a,b).join('')}</ul></div><div class="card"><h3>Model context</h3>${model(a,b)}</div></div>
 <div class="card"><div style="overflow-x:auto"><table class="dl-t dl-cmp"><thead><tr><th>Metric</th><th>${E(a.team)}</th><th>${E(b.team)}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="mut sm">Highlighted cell = better on that metric. Style rows (tempo, 3PA rate) are never highlighted.</p></div>`}
const CSS=`<style id="dlcss">body.duel-on #main-tabs~*:not(#duel-root):not(footer){display:none!important}body.duel-on #main-tabs{display:none}
#duel-root .dl-ctl{display:flex;gap:10px;flex-wrap:wrap;align-items:end}#duel-root label{display:flex;flex-direction:column;font-size:12px;gap:4px;color:var(--mut)}
#duel-root select,#duel-root .dl-swap{background:var(--panel2);color:var(--txt);border:1px solid var(--line);border-radius:10px;padding:9px 10px;min-height:42px;font:inherit;max-width:100%}#duel-root .dl-swap{cursor:pointer}
#duel-root :focus-visible{outline:2px solid #38d0f0;outline-offset:2px}.dl-lay{display:grid;grid-template-columns:1.3fr 1fr;gap:12px}.dl-ev{padding-left:18px;line-height:1.55}.dl-ev li{margin-bottom:6px}
.dl-t{width:100%;border-collapse:collapse}.dl-t td,.dl-t th{padding:8px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.dl-cmp{min-width:560px}.dl-cmp th{font-weight:700}.dl-w{background:rgba(56,208,240,.10)}
.dl-bar{height:6px;background:var(--panel2);border-radius:3px;margin:4px 0 2px;max-width:160px}.dl-bar i{display:block;height:100%;background:#38d0f0;border-radius:3px}
@media(max-width:800px){.dl-lay{grid-template-columns:1fr}}</style>`;
function show(){const on=location.hash==='#duel';document.body.classList.toggle('duel-on',on);if(!root)return;root.hidden=!on;if(on&&D)draw()}
function init(){document.head.insertAdjacentHTML('beforeend',CSS);root=document.createElement('section');root.id='duel-root';root.hidden=true;root.setAttribute('aria-live','polite');
 const tabs=document.getElementById('main-tabs');(tabs?tabs.after(root):document.body.prepend(root));
 root.addEventListener('change',e=>{const k=e.target.dataset.k;if(k==='g'&&e.target.value){const[x,y]=e.target.value.split('-');st.a=+x;st.b=+y}else if(k==='a'||k==='b')st[k]=+e.target.value;draw();const f=root.querySelector(`select[data-k="${k}"]`);f&&f.focus()});
 root.addEventListener('click',e=>{if(e.target.closest('.dl-swap')){[st.a,st.b]=[st.b,st.a];draw();root.querySelector('.dl-swap').focus()}});
 addEventListener('hashchange',show);
 const go=d=>{D=d;T=(d.teams||[]).filter(t=>t.status==='ok').sort((x,y)=>x.team.localeCompare(y.team));ranks();const now=Date.now(),gs=(d.games||[]).filter(g=>tm(g.home_tid)&&tm(g.away_tid)),g=gs.find(g=>Date.parse(g.start)>=now)||gs[gs.length-1];st.a=st.a||(g?g.away_tid:T[0]&&T[0].id);st.b=st.b||(g?g.home_tid:T[1]&&T[1].id);show()};
 window.CBB&&CBB.data?CBB.data(go):fetch('data/cbb.json').then(r=>r.json()).then(go);show()}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.CBBDuel={state:st};
})();
