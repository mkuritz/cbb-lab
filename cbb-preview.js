(function(){'use strict';
const {node:n,text,card,num,table,select,chart,bars,json,dialog}=PV;
const app=document.getElementById('preview-app'),controls=document.getElementById('preview-controls'),view=document.body.dataset.view;
let D,teamId='',game=0,conf='all';const Q=new URLSearchParams(location.search);teamId=Q.get('team')||'';game=Number(Q.get('game'))||0;conf=Q.get('conf')||'all';
const team=t=>t.membership_only?n('button',{class:'pv-link',click:()=>dialog(t.team,text(t.reason),text('Membership-only detail. No cached native profile or invented ratings.'))},t.team):n('a',{href:'team.html?'+new URLSearchParams({id:t.id})},t.team);
function scatter(){
 const teams=D.teams.filter(t=>Number.isFinite(t.adjO)&&Number.isFinite(t.adjD)&&(conf==='all'||t.conf===conf));if(!teams.length)return text('No efficiency rows.');
 const s=chart('Team efficiency scatter; lower defensive efficiency is better',800,420),xs=teams.map(t=>t.adjO),ys=teams.map(t=>t.adjD),minX=Math.min(...xs)-1,maxX=Math.max(...xs)+1,minY=Math.min(...ys)-1,maxY=Math.max(...ys)+1;
 const X=v=>55+(v-minX)/(maxX-minX)*705,Y=v=>30+(v-minY)/(maxY-minY)*330;
 for(let i=0;i<=4;i++){const v=minX+(maxX-minX)*i/4,w=minY+(maxY-minY)*i/4;s.append(n('line',{x1:X(v),x2:X(v),y1:30,y2:360,stroke:'#225047'}),n('text',{x:X(v),y:380,fill:'#a4bfb6'},num(v,0)),n('line',{x1:55,x2:760,y1:Y(w),y2:Y(w),stroke:'#225047'}),n('text',{x:5,y:Y(w)+4,fill:'#a4bfb6'},num(w,0)))}
 const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
 s.append(n('line',{x1:X(mx),x2:X(mx),y1:30,y2:360,stroke:'#7de4c3','stroke-dasharray':'5 5'}),n('line',{x1:55,x2:760,y1:Y(my),y2:Y(my),stroke:'#7de4c3','stroke-dasharray':'5 5'}));
 for(const t of teams){const a=n('g',{role:'link',tabindex:0,'aria-label':t.team,click:()=>{location.href='team.html?'+new URLSearchParams({id:t.id})}},n('circle',{cx:X(t.adjO),cy:Y(t.adjD),r:4,fill:'#7de4c3','fill-opacity':.8},n('title',{},t.team+' · AdjO '+t.adjO+' / AdjD '+t.adjD)));a.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();a.dispatchEvent(new MouseEvent('click'))}});s.append(a)}
 s.append(n('text',{x:300,y:410,fill:'#a4bfb6'},'Adjusted offense → · stronger defense ↑'));return card('Efficiency universe · '+teams.length+' teams',s,text('Current cached season snapshot; dashed lines are means. Every marker opens its native team page. Missing ratings are listed below rather than plotted at invented coordinates.','mut sm'),...D.teams.filter(t=>!Number.isFinite(t.adjO)||!Number.isFinite(t.adjD)).map(t=>n('p',{},team(t),' · efficiency unavailable')));
}
function factor(t,key,reverse=false){const a=D.teams.map(x=>x[key]).filter(x=>typeof x==='number'),v=t[key];if(typeof v!=='number')return null;return Math.round(a.filter(x=>reverse?x>v:x<v).length/Math.max(1,a.length-1)*100)}
function duel(){
 const g=D.games[Math.max(0,Math.min(game,D.games.length-1))];if(!g){app.replaceChildren(card('Matchup Duel',text('No games in snapshot.')),scatter());return}
 const a=D.teams.find(t=>t.id===g.away_tid),h=D.teams.find(t=>t.id===g.home_tid);
 if(!a||!h){app.replaceChildren(card('Ratings unavailable',text('Game team IDs do not match current ratings.')));return}
 const block=t=>card(team(t),bars(['eFG percentile','ORB percentile','TOV percentile','FTR percentile'],[factor(t,'efg'),factor(t,'orbPct'),factor(t,'tovRate',true),factor(t,'ftr')]),table(['Metric','Value'],['efg','orbPct','tovRate','ftr','adjO','adjD','adjEM'].map(k=>[k,num(t[k])])),text('Offensive four factors only. Percentiles across numeric values in the '+D.teams.length+'-record display universe; lower TOV is better.','mut sm'));
 app.replaceChildren(n('div',{class:'pv-grid'},block(a),block(h)),card('Existing matchup projection',text('Existing model home spread '+num(g.spread_home,1)+' · model total '+num(g.total,1)+' · model home-win '+num(g.home_win*100,1)+'%'),text('Bookmaker spread/total not provided in this snapshot schema. No model line is mislabeled as market.'),table(['Player','Projected minutes','PTS'],[...(g.away_starters||[]),...(g.home_starters||[])].map(p=>[player(p),num(p.min,1),num(p.pts,1)]))),scatter());
 PV.controls(select('Game',D.games.map((g,i)=>[i,g.away_name+' @ '+g.home_name]),game,v=>{game=Number(v);render()}),conferenceSelect());
}
function player(p){const id=String(p.id||p.aid||''),native=(D.players||[]).find(x=>String(x.id)===id);return /^\d+$/.test(id)&&native?n('button',{class:'pv-link',click:()=>{if(window.CBB?.openPlayerModal)window.CBB.openPlayerModal(id,String(native.tid))}},p.n||p.nm||native.n):p.n||p.nm||'Unavailable'}
function conferenceSelect(){return select('Conference',[['all','All conferences'],...[...new Set(D.teams.map(t=>t.conf))].sort().map(c=>[c,c])],conf,v=>{conf=v;render()})}
function power(){
 const shown=D.teams.filter(t=>conf==='all'||t.conf===conf),by={};for(const t of shown)(by[t.conf]??=[]).push(t);
 const cards=Object.entries(by).sort().map(([c,teams])=>{const sorted=teams.slice().sort((a,b)=>(b.adjEM??-999)-(a.adjEM??-999)),rated=sorted.filter(t=>Number.isFinite(t.adjEM));return card('Cached conference · '+c+' · '+teams.length,bars(rated.map(t=>t.team),rated.map(t=>t.adjEM)),table(['Team','AdjEM','Stored rank'],sorted.map(t=>[team(t),num(t.adjEM),t.torvikRk??'Unrated'])))});
 app.replaceChildren(card('One rating snapshot',text('Conference labels are cached, with verified transition corrections. Full membership/conference reconciliation remains pending. No historical trajectory, frozen-value movers or fabricated daily changes.')),n('div',{class:'pv-grid'},...cards));PV.controls(conferenceSelect());
}
function render(){view==='duel'?duel():power();history.replaceState(null,'','?'+new URLSearchParams({game,conf}))}
async function boot(){PV.nav();D=await json('data/cbb.json');D.teams=D.teams.filter(t=>t.id!==278);if(!D.teams.some(t=>t.team==='West Florida'))D.teams.push({id:'membership:uwf',team:'West Florida',conf:'ASUN',membership_only:true,reason:'Verified first Division I basketball season 2026–27; no cached native ID or rating. No invented coordinates.'});PV.status('2026–27 snapshot · '+D.teams.filter(t=>Number.isFinite(t.adjO)&&Number.isFinite(t.adjD)).length+' rated teams · ratings: barttorvik.com','Recorded hub snapshot built '+D.built+' · '+D.teams.length+' display records / '+D.teams.filter(t=>Number.isFinite(t.adjO)&&Number.isFinite(t.adjD)).length+' rated teams after verified transitions; full current membership/conference reconciliation pending. Ratings credit: barttorvik.com. Not live.');render()}
document.addEventListener('pv-reset',()=>{game=0;conf='all';teamId='';render()});
boot().catch(e=>app.replaceChildren(card('Unavailable',text(e.message))));
})();