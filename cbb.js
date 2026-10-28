(function(){
var E=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
var D=null,Q=[];function data(cb){if(D)return cb(D);Q.push(cb);if(Q.length>1)return;fetch("data/cbb.json").then(function(r){return r.json()}).then(function(j){D=j;Q.forEach(function(f){f(j)});Q=[]})}
function ord(n){var s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function fmtT(t){var d=new Date(t);return d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"America/New_York"}).toUpperCase()+" "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"})+" ET"}
function am(a){return a==null?"—":(a>0?"+":"")+a}
function pc(p){return p==null?"—":(p*100).toFixed(1)+"%"}
function ini(n){return String(n||"").split(/\s+/).map(function(w){return w[0]}).slice(0,2).join("").toUpperCase()}
function head(id,nm,url,col,sz){sz=sz||44;return '<span class="hsr" style="width:'+sz+'px;height:'+sz+'px;box-shadow:0 0 0 3px '+(col||"#38d0f0")+'"><b style="font-size:'+Math.round(sz*.36)+'px">'+E(ini(nm))+'</b>'+(url?'<img loading="lazy" src="'+E(url)+'" alt="" onerror="this.remove()">':'')+'</span>'}
function logo(t,sz){
 if(!D||!D.teams)return"";
 var x=Array.isArray(D.teams)?D.teams.find(function(r){return r.id==t}):D.teams[t];
 return x&&x.logo?'<img class="tl" src="'+E(x.logo)+'" alt="'+E(x.ab||x.team)+'" style="width:'+(sz||20)+'px;height:'+(sz||20)+'px;vertical-align:middle">':'';
}
function edge(e){return e==null?'<span class="edge" title="Needs 2+ books">EDGE —</span>':'<span class="edge '+(e>=0?"p":"n")+'">EDGE '+(e>=0?"+":"")+(e*100).toFixed(1)+'%</span>'}
function badgesHtml(arr){
 if(!arr||!arr.length)return"";
 return '<div class="cbadges">'+arr.map(function(b){return '<span class="cbadge '+E(b.kind||"")+'">'+E(b.txt)+'</span>'}).join("")+'</div>';
}
function roleBadge(p){
 if(!p)return"";
 var st=p.starter?'<span class="role-pill st">★ '+(E(p.slot||"Starter"))+'</span>':'<span class="role-pill bn">'+E(p.role||"Rotation")+'</span>';
 var sr=p.is_star?' <span class="star-pill" title="'+E(p.star_tier||"Star Player")+'">⭐ '+E(p.star_tier==="All-American Watch"?"All-American":(p.star_tier==="All-Conference Star"?"All-Conf Star":"Star"))+'</span>':'';
 var nb=p.nba_prospect?' <span class="nba-pill '+(p.nba_tier==="NBA Lottery"?"lot":"")+'" title="'+E(p.nba_note||p.nba_tier)+'">🏀 '+E(p.nba_tier||"NBA Prospect")+'</span>':'';
 var tr=p.origin==="Transfer"&&p.prev_team?' <span class="role-pill tr" title="Transferred from '+E(p.prev_team)+'">⇄ '+E(p.prev_team)+'</span>':(p.origin==="Freshman"?' <span class="role-pill bn">FR</span>':'');
 return st+sr+nb+tr;
}

var KS={bk:1000,m:0.25};
try{
 var sv=JSON.parse(localStorage.getItem("sl_cbb_kelly")||"null");
 if(sv&&sv.bk>0)KS=sv;
 var uBk=parseFloat(localStorage.getItem("sl_bankroll")||"");
 var uKm=parseFloat(localStorage.getItem("sl_kelly")||"");
 if(uBk>0)KS.bk=uBk;
 if([0.25,0.5,1,1.0,0].includes(uKm))KS.m=uKm;
}catch(e){}
function saveK(){try{localStorage.setItem("sl_cbb_kelly",JSON.stringify(KS));localStorage.setItem("sl_bankroll",String(KS.bk));if(KS.m>0)localStorage.setItem("sl_kelly",String(KS.m))}catch(e){}}
function kellyBar(el,cb){
 if(!el)return;
 el.innerHTML='<div class="kbar"><label>💰 Bankroll ($)<input type="number" id="cbb-bk" min="50" step="50" value="'+KS.bk+'"></label><div class="kbtns" role="group" aria-label="Kelly multiplier">'+[[0.25,"0.25x Kelly"],[0.5,"0.5x Kelly"],[1.0,"1.0x Full"],[0,"Flat 1%"]].map(function(x){return '<button type="button" data-km="'+x[0]+'" class="'+(KS.m===x[0]?"on":"")+'">'+x[1]+'</button>'}).join("")+'</div><span class="mut sm" style="margin-left:auto">Exact $ stake &amp; Model vs. Benchmark Fair Line Edge on every prop (capped at 5% bankroll)</span></div>';
 var inp=el.querySelector("#cbb-bk");
 if(inp)inp.onchange=function(){var v=Math.max(10,parseFloat(inp.value)||1000);KS.bk=v;saveK();if(cb)cb()};
 el.querySelectorAll("[data-km]").forEach(function(b){b.onclick=function(){KS.m=parseFloat(b.getAttribute("data-km"));saveK();kellyBar(el,cb);if(cb)cb()}});
}
function stakeHtml(oursP,fairP,amOdds,sideLabel){
 if(oursP==null||fairP==null)return"";
 var diff=oursP-fairP;
 var p=diff>=0?oursP:(1-oursP),q=diff>=0?fairP:(1-fairP),ed=p-q;
 var pW=Math.min(100,Math.max(4,Math.round(p*1000)/10)),qW=Math.min(97,Math.max(3,Math.round(q*1000)/10));
 var gauge='<div class="cbb-edge-viz" title="Our Fair '+pc(p)+' vs Benchmark Fair '+pc(q)+'"><div class="cev-hd"><span>📊 Our Model <b>'+pc(p)+'</b>'+(sideLabel?" ("+E(sideLabel)+")":"")+'</span><span>Fair <b>'+pc(q)+'</b> · <b class="'+(ed>=0.008?"up":"mut")+'">'+(ed>=0?"+":"")+(ed*100).toFixed(1)+'% Edge</b></span></div><div class="cev-track"><div class="cev-fill" style="width:'+pW+'%"></div><div class="cev-tick" style="left:'+qW+'%" title="Fair '+pc(q)+'"></div></div></div>';
 if(Math.abs(diff)<0.008)return gauge+'<div class="krow"><span class="mut">Model vs Fair: aligned ('+pc(oursP)+' vs '+pc(fairP)+')</span><span class="mut">$0 Pass</span></div>';
 var bDec=(amOdds!=null)?(amOdds>0?amOdds/100:100/-amOdds):(100/110);
 var f=Math.max(0,(p*bDec-(1-p))/bDec);
 var frac=KS.m===0?0.01:Math.min(0.05,f*KS.m);
 var stake=Math.round(KS.bk*frac*100)/100;
 var evPct=((p*(bDec+1)-1)*100);
 if(stake<=0&&ed>0.01){stake=Math.round(KS.bk*Math.min(0.03,ed*(KS.m||0.25))*100)/100}
 return gauge+'<div class="krow"><span class="kst">💵 Stake $'+stake.toFixed(2)+(sideLabel?" · "+E(sideLabel):"")+'</span><span class="mut">Ours <b>'+pc(p)+'</b> vs Fair <b>'+pc(q)+'</b> ('+(ed>=0?"+":"")+(ed*100).toFixed(1)+'% edge'+(evPct>0?' · +$'+Math.max(0.1,stake*Math.max(ed,evPct/100)).toFixed(2)+' EV':'')+')</span></div>';
}

function findPlayer(key,tid){
 if(!D)return null;
 var k=String(key||"").trim().toLowerCase();
 var p=null;
 if(tid&&D.teams){
  var tm=D.teams.find(function(x){return String(x.id)===String(tid)});
  if(tm&&tm.rot){
   p=tm.rot.find(function(r){return String(r.id)===String(key)||(r.n||"").toLowerCase()===k});
  }
 }
 if(!p&&D.players){
  p=D.players.find(function(r){return (r.id&&String(r.id)===String(key))||(r.n||"").toLowerCase()===k});
 }
 if(!p&&D.teams){
  for(var i=0;i<D.teams.length;i++){
   var rot=D.teams[i].rot||[];
   for(var j=0;j<rot.length;j++){
    if((rot[j].id&&String(rot[j].id)===String(key))||(rot[j].n||"").toLowerCase()===k){p=rot[j];break}
   }
   if(p)break;
  }
 }
 return p;
}

function openPlayerModal(key,tid){
 data(function(){
  var p=findPlayer(key,tid);
  if(!p)return;
  var tm=(D.teams||[]).find(function(x){return x.id===p.tid})||{};
  var pProps=(D.props||[]).filter(function(pr){return (pr.aid&&p.id&&String(pr.aid)===String(p.id))||(pr.nm===p.n&&pr.t===p.tid)});
  var opp=(D.opportunities||[]).find(function(o){return (o.id&&p.id&&String(o.id)===String(p.id))||(o.player===p.n&&o.tid===p.tid)});
  var ov=document.getElementById("cbb-modal-ov");
  if(ov)ov.remove();
  ov=document.createElement("div");
  ov.id="cbb-modal-ov";
  var bioBits=[E(p.pos)];
  if(p.yr_short||p.yr)bioBits.push(E(p.yr_short||p.yr));
  if(p.ht)bioBits.push(E(p.ht)+(p.wt?" · "+p.wt+" lbs":""));
  if(p.jersey)bioBits.push("#"+E(p.jersey));
  var mHtml='<div id="cbb-modal" role="dialog" aria-modal="true" aria-label="'+E(p.n)+' player details">'
   +'<button type="button" class="xbtn" id="cbb-modal-x" aria-label="Close">✕</button>'
   +'<div style="display:flex;gap:14px;align-items:center">'
   +head(p.id,p.n,p.hs,tm.col||"#38d0f0",68)
   +'<div>'
   +'<div style="font-size:21px;font-weight:900">'+E(p.n)+' '+(p.ap?'<span class="ap-tag">#'+p.ap+'</span>':'')+'</div>'
   +'<div class="mut sm" style="margin:3px 0">'+logo(p.tid,18)+' <a href="team.html?id='+p.tid+'" style="color:#7dd3fc;font-weight:700">'+E(p.team)+'</a> · '+E(p.conf)+' · '+bioBits.join(" · ")+'</div>'
   +'<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">'+roleBadge(p)+'</div>'
   +'</div></div>';

  if(p.nba_prospect||p.is_star){
   mHtml+='<div class="card" style="margin-top:12px;background:linear-gradient(135deg,rgba(168,85,247,.16),rgba(19,35,63,.9));border-color:#a855f766;padding:10px 12px">'
    +'<div style="font-size:11.5px;font-weight:800;color:#fef08a;text-transform:uppercase;letter-spacing:.04em">'+(p.nba_prospect?'🏀 2027 NBA Draft Scouting Report ('+E(p.nba_tier)+')':'⭐ College Star Profile ('+E(p.star_tier)+')')+'</div>'
    +'<div class="sm" style="margin-top:4px;color:#e6edf6">'+(p.nba_note?E(p.nba_note):'High-impact '+E(p.conf)+' '+E(p.star_tier||'Star')+' projected for '+p.proj_pts+' PPG, '+p.proj_min+' MPG and '+p.usg+'% usage.')+'</div>'
    +'</div>';
  }

  if(opp){
   mHtml+='<div class="card" style="margin-top:10px;background:#13233f;border-color:#38d0f055;padding:10px 12px">'
    +'<div style="font-size:11.5px;font-weight:800;color:#7dd3fc;text-transform:uppercase;letter-spacing:.04em">🚀 2026-27 Usage &amp; Opportunity Spike</div>'
    +'<div class="sm" style="margin-top:3px">'+E(opp.because)+'</div>'
    +'<div class="sm mut" style="margin-top:4px">2025-26 Base: <b>'+opp.base.min+' MIN · '+opp.base.pts+' PPG · '+opp.base.usg+'% USG</b> → 2026-27 Proj: <b style="color:#8ee04a">'+opp.proj.min+' MIN (+'+opp.min_diff+') · '+opp.proj.pts+' PPG (+'+opp.pts_diff+') · '+opp.proj.usg+'% USG</b></div>'
    +'</div>';
  }

  mHtml+='<h3 style="margin:16px 0 6px;font-size:13.5px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8">🏀 2026-27 Projected Role, Minutes &amp; Usage</h3>'
   +'<div class="m-grid">'
   +'<div class="m-tile"><div class="l">Proj Minutes</div><div class="v" style="color:#38d0f0">'+p.proj_min+'</div><div class="s">'+(p.starter?"Starting "+E(p.slot||p.pos):E(p.role))+'</div></div>'
   +'<div class="m-tile"><div class="l">Usage Rate</div><div class="v" style="color:#fcd34d">'+p.usg+'%</div><div class="s">Possession share</div></div>'
   +'<div class="m-tile"><div class="l">Proj Points</div><div class="v">'+p.proj_pts+'</div><div class="s">Last: '+(p.gp?p.ppg:'—')+' PPG</div></div>'
   +'<div class="m-tile"><div class="l">Proj Rebounds</div><div class="v">'+p.proj_reb+'</div><div class="s">Last: '+(p.gp?p.rpg:'—')+' RPG</div></div>'
   +'<div class="m-tile"><div class="l">Proj Assists</div><div class="v">'+p.proj_ast+'</div><div class="s">Last: '+(p.gp?p.apg:'—')+' APG</div></div>'
   +'<div class="m-tile"><div class="l">Proj 3PM</div><div class="v">'+p.proj_tpm+'</div><div class="s">Last: '+(p.gp?p.tpm:'—')+'/g</div></div>'
   +'<div class="m-tile"><div class="l">Proj PRA</div><div class="v" style="color:#8ee04a">'+p.proj_pra+'</div><div class="s">Pts+Reb+Ast</div></div>'
   +'</div>';

  mHtml+='<h3 style="margin:16px 0 6px;font-size:13.5px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8">📊 2025-26 D-I Efficiency &amp; Four-Factors Splits</h3>'
   +(p.gp?'<div class="m-grid">'
   +'<div class="m-tile"><div class="l">Games / Starts</div><div class="v">'+p.gp+' / '+p.starts+'</div><div class="s">'+p.mpg+' MPG ('+(p.prev_team||p.team)+')</div></div>'
   +'<div class="m-tile"><div class="l">eFG%</div><div class="v">'+p.efg+'%</div><div class="s">Effective FG%</div></div>'
   +'<div class="m-tile"><div class="l">True Shooting</div><div class="v">'+p.ts+'%</div><div class="s">TS% w/ FT</div></div>'
   +'<div class="m-tile"><div class="l">Off / Def Rtg</div><div class="v">'+p.ortg+'</div><div class="s">DRtg '+p.drtg+'</div></div>'
   +'<div class="m-tile"><div class="l">Win Shares</div><div class="v" style="color:#8ee04a">'+p.ws+'</div><div class="s">PORPAG '+p.porpag+'</div></div>'
   +'<div class="m-tile"><div class="l">Stocks / G</div><div class="v">'+(p.stl+p.blk).toFixed(1)+'</div><div class="s">'+p.stl+' STL · '+p.blk+' BLK</div></div>'
   +'</div>':'<div class="card mut sm">Incoming '+E(p.origin)+' ('+E(p.yr||"Freshman")+') without prior 2025-26 D-I sample. Projected from recruiting/prospect tier, team rotation slot and pace.</div>');

  if(pProps.length){
   mHtml+='<h3 style="margin:16px 0 6px;font-size:13.5px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8">🎯 Upcoming Matchup Player Props ('+E(pProps[0].matchup)+')</h3>'
    +'<div class="card wrap" style="padding:0"><table><tr><th>Market</th><th>Line</th><th>Our Proj</th><th>Ours</th><th>Fair</th><th>Edge</th><th>Best</th><th>Slip</th></tr>'
    +pProps.map(function(pr){
     var po=pr.side==="Over"?pr.ours:(1-pr.ours),pf=pr.side==="Over"?pr.fair:(1-pr.fair);
     return '<tr><td><b>'+E(pr.mk)+'</b></td><td>'+E(pr.side)+' '+pr.line+'</td><td><b>'+pr.proj+'</b></td><td>'+pc(po)+'</td><td>'+pc(pf)+'</td><td>'+edge(pr.edge)+'</td><td>'+(pr.best?am(pr.best[0])+' <span class="mut sm">'+E(pr.best[1])+'</span>':'—')+'</td><td><a class="sl-bl-btn" href="https://betlab.sportslabshq.com/?sport=ncaamb&amp;addleg='+encodeURIComponent((pr.aid||pr.nm)+"|"+pr.mk)+'" target="_blank" rel="noopener">➕ Slip</a></td></tr>';
    }).join("")+'</table></div>'
    +'<div class="mut sm" style="margin-top:4px">'+E(pProps[0].why)+'</div>';
  }

  if(tm&&tm.team){
   mHtml+='<h3 style="margin:16px 0 6px;font-size:13.5px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8">🏟️ Team Style &amp; Rotation Context ('+E(tm.team)+')</h3>'
    +'<div class="card" style="padding:10px 12px"><div class="sm"><b>Tempo (AdjT):</b> '+(tm.adjT?tm.adjT.toFixed(1)+' poss':'—')+' · <b>Torvik O / D:</b> '+(tm.adjO?tm.adjO.toFixed(1)+' (#'+tm.adjO_rk+') / '+tm.adjD.toFixed(1)+' (#'+tm.adjD_rk+')':'—')+' · <b>Proj Net:</b> '+(tm.proj!=null?(tm.proj>0?'+':'')+tm.proj.toFixed(1):'—')+'</div>'
    +badgesHtml(tm.badges)
    +'<div style="margin-top:8px"><a href="team.html?id='+tm.id+'" class="chip" style="text-decoration:none;display:inline-block">Open Full '+E(tm.team)+' Roster &amp; Hub →</a></div></div>';
  }

  mHtml+='</div>';
  ov.innerHTML=mHtml;
  document.body.appendChild(ov);
  ov.onclick=function(e){if(e.target===ov)ov.remove()};
  var xb=ov.querySelector("#cbb-modal-x");
  if(xb)xb.onclick=function(){ov.remove()};
 });
}

document.addEventListener("keydown",function(e){
 if(e.key==="Escape"){
  var ov=document.getElementById("cbb-modal-ov");
  if(ov)ov.remove();
 }
});
document.addEventListener("click",function(e){
 var pl=e.target.closest("[data-cbb-player]");
 if(pl){
  e.preventDefault();
  e.stopPropagation();
  openPlayerModal(pl.getAttribute("data-cbb-player"),pl.getAttribute("data-cbb-tid"));
 }
});

window.CBB={data:data,E:E,ord:ord,fmtT:fmtT,am:am,pc:pc,head:head,logo:logo,edge:edge,ini:ini,badgesHtml:badgesHtml,roleBadge:roleBadge,kellyBar:kellyBar,stakeHtml:stakeHtml,openPlayerModal:openPlayerModal};
function bar(){if(document.getElementById("v2bar"))return;var C=window.SLTOP;if(!C)return;var pg=(location.pathname.split("/").pop()||"index.html").replace(".html","");if(pg=="player")pg="players";
 var b=document.createElement("header");b.id="v2bar";b.setAttribute("role","banner");
 var sp=C.sports.map(function(x){return x[2]==C.cur?'<a class="on" aria-current="page" href="'+x[1]+'">'+x[0]+'</a>':'<a href="'+x[1]+'" data-sp="'+x[2]+'">'+x[0]+'</a>'}).join("");
 var by=C.by.map(function(x){return '<a class="'+(pg==x[2]?"on":"")+'"'+(pg==x[2]?' aria-current="page"':'')+' href="'+x[1]+'">'+x[0]+'</a>'}).join("");
 b.innerHTML='<div class="in"><a class="brand" href="index.html">CBB <b>Hub</b></a><nav class="sp" aria-label="Sport">'+sp+'</nav><button id="v2menu" aria-expanded="false" aria-controls="v2drop" aria-label="Menu">☰</button><div id="v2drop"><form id="v2ask" role="search"><input type="search" placeholder="Ask anything… e.g. college basketball player props &amp; NBA prospects" aria-label="Ask Sports Labs" enterkeyhint="search"></form><nav class="by" aria-label="CBB Hub sections">'+by+'</nav></div></div>';
 document.body.insertBefore(b,document.body.firstChild);
 var m=b.querySelector("#v2menu"),dr=b.querySelector("#v2drop");m.onclick=function(){var o=dr.classList.toggle("open");m.setAttribute("aria-expanded",o);m.textContent=o?"✕":"☰";if(o)b.querySelector("#v2ask input").focus({preventScroll:true})};
 document.addEventListener("keydown",function(e){if(e.key=="Escape"&&dr.classList.contains("open"))m.click()});
 document.addEventListener("click",function(e){if(dr.classList.contains("open")&&!b.contains(e.target))m.click()});
 b.querySelectorAll("a").forEach(function(a){a.addEventListener("pointerdown",function(){b.querySelectorAll("nav a.on").forEach(function(x){if(x.parentNode==a.parentNode)x.classList.remove("on")});a.classList.add("on")})});
 b.querySelector("form").onsubmit=function(e){e.preventDefault();var q=b.querySelector("input").value.trim();location.href=C.ask+encodeURIComponent(q||"most improved college basketball teams")}}
if(document.readyState=="loading")document.addEventListener("DOMContentLoaded",bar);else bar();
if(!window.__sl&&!document.querySelector('script[src*="/sl/sl.js"]')){var _sls=document.createElement("script");_sls.src="https://sportslabshq.com/sl/sl.js?v=10";_sls.defer=true;document.head.appendChild(_sls);}
})();
