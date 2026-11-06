/* CBB profile Matchup Analyzer. Display only: no projections, pricing, or model writes. */
(function(){"use strict";
var request;
function E(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function load(){if(!request)request=fetch("data/matchup_an.json?v=cbb-matchup-1").then(function(r){if(!r.ok)throw Error("unavailable");return r.json()}).catch(function(e){request=null;throw e});return request}
function date(s){return new Date(s).toLocaleString("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})+" ET"}
function num(v){return Number(v).toFixed(1)}
function tabs(root, attribute){var buttons=Array.from(root.querySelectorAll("["+attribute+"]"));
 function select(b){buttons.forEach(function(x){var on=x===b;x.setAttribute("aria-selected",String(on));x.tabIndex=on?0:-1;var panel=root.querySelector('#'+x.getAttribute('aria-controls'));if(panel)panel.hidden=!on})}
 buttons.forEach(function(b,i){b.onclick=function(){select(b)};b.onkeydown=function(e){var j=e.key==="ArrowRight"?(i+1)%buttons.length:e.key==="ArrowLeft"?(i+buttons.length-1)%buttons.length:e.key==="Home"?0:e.key==="End"?buttons.length-1:-1;if(j>=0){e.preventDefault();buttons[j].focus();select(buttons[j])}}});
}
function radar(axes){var n=axes.length,c=160,r=92;
 function xy(i,p){var a=-Math.PI/2+i*2*Math.PI/n;return [c+Math.cos(a)*r*p/100,c+Math.sin(a)*r*p/100]}
 var svg=[25,50,75,100].map(function(p){return '<polygon points="'+axes.map(function(_,i){return xy(i,p).join(',')}).join(' ')+'" fill="none" stroke="#334155"/>'}).join('');
 axes.forEach(function(a,i){var p=xy(i,100),t=xy(i,139);svg+='<line x1="160" y1="160" x2="'+p[0]+'" y2="'+p[1]+'" stroke="#334155"/><text x="'+t[0]+'" y="'+t[1]+'" text-anchor="middle" fill="#cbd5e1" font-size="10">'+E(a.label)+'</text>'});
 svg+='<polygon points="'+axes.map(function(a,i){return xy(i,a.percentile).join(',')}).join(' ')+'" fill="#38d0f033" stroke="#38d0f0" stroke-width="2"/>';
 return '<svg class="cma-radar" viewBox="0 0 320 320" role="img" aria-label="Player percentiles among same-position players with at least three logged games">'+svg+'</svg><p class="mut sm">Outer edge = higher value among same-position players with 3+ logged games. Not a projection or an opponent-allowed comparison.</p>'+table(['Metric','Per game / %','Percentile','Games'],axes.map(function(a){return [a.label,num(a.value),a.percentile+' ('+a.peers+' peers)',a.n]}));
}
function table(head,rows){return '<div class="cma-table"><table><thead><tr>'+head.map(function(h){return '<th>'+E(h)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(v){return '<td>'+E(v)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>'}
function mount(el,p,D){var parts=[],next=p.next;
 if(p.axes&&p.axes.length>=3)parts.push(['overview','Overview',radar(p.axes)]);
 var wins=p.windows||{},stats=D.stats;
 if(Object.keys(wins).length){var available=stats.filter(function(s){return Object.keys(wins).some(function(k){return wins[k].v[s[0]]!=null})});
  if(available.length)parts.push(['splits','Splits','<p class="mut sm">Logged games only. Shooting percentages use combined attempts; each metric includes only games with that field. Missing values are omitted, not zero.</p>'+Object.keys(wins).map(function(k){var w=wins[k];return '<h4>'+E(k)+' · '+E(w.n)+' games</h4>'+table(['Metric','Per game / %','Sample'],available.filter(function(s){return w.v[s[0]]!=null}).map(function(s){return [s[1],num(w.v[s[0]]),w.samples[s[0]]+' games']}))}).join('')]);
 }
 if(p.opponent_context&&p.opponent_context.length)parts.push(['opponent','Opponent','<p>Published rating context for '+E(next.opponent)+'.</p><p class="mut sm">Snapshot: '+E(D.source_built||'date unavailable')+'. These ratings are not current-season position allowances.</p>'+table(['Factor','Value','Units'],p.opponent_context.map(function(r){return [r.label,num(r.value),r.unit]}))+'<p class="mut sm">Ratings: barttorvik.com</p>']);
 if(p.similar&&p.similar.length)parts.push(['similar','Similar players','<p class="mut sm">Same position, season minutes within 30% of this player. Actual games against '+E(next.opponent)+' this season; points compared with each player’s own logged season average. No betting lines.</p>'+table(['Date (ET)','Player','Team','Minutes avg','Points avg','Result'],p.similar.map(function(r){return [date(r.start),r.name,r.team,num(r.minutes),num(r.average),r.points]}))]);
 el.innerHTML='<section class="cma"><h3>Matchup Analyzer</h3><p>'+E(p.name)+' · '+(next.neutral?'Neutral vs ':next.home?'vs ':'@ ')+E(next.opponent)+' · '+date(next.start)+'</p><p class="mut sm">'+E(D.season)+' season · '+E(p.role||p.pos||'')+'. Display only; does not change Highlighted plays or probabilities.</p>'+(p.status==='insufficient_logs'?'<p>No upcoming game with logged games for this player yet.</p><p class="mut sm">At least '+E(D.minimum_games)+' completed games this season are required; '+E(p.logged_games)+' valid logged games are available. Prior-season averages and projected minutes are not used as logged games. Only published opponent rating context is shown.</p>':'')+(!parts.length?'<p>No supported matchup sections with enough real data yet.</p>':'<div class="cma-tabs" role="tablist" aria-label="Analyzer sections">'+parts.map(function(t,i){return '<button type="button" role="tab" data-cma-section="'+t[0]+'" id="cma-tab-'+t[0]+'" aria-controls="cma-panel-'+t[0]+'" aria-selected="'+(!i)+'" tabindex="'+(i?-1:0)+'">'+t[1]+'</button>'}).join('')+'</div>'+parts.map(function(t,i){return '<section role="tabpanel" id="cma-panel-'+t[0]+'" aria-labelledby="cma-tab-'+t[0]+'"'+(i?' hidden':'')+'>'+t[2]+'</section>'}).join(''))+'</section>';
 tabs(el,'data-cma-section');
}
function open(el,p){el.innerHTML='<section class="cma" aria-live="polite"><h3>Matchup Analyzer</h3><p>Loading matchup…</p></section>';
 return load().then(function(D){var key=String(p.tid)+'|'+String(p.id||p.n.toLowerCase()),row=D.players&&D.players[key];
 // Generated snapshots cannot resurrect an already-started game while a page stays cached.
 if(!row||!row.next||new Date(row.next.start)<=new Date()){
  var reason=!row||row.status==='no_upcoming'||(row.next&&new Date(row.next.start)<=new Date())?'No future game is available in the published schedule.':'At least '+E(D.minimum_games)+' completed games this season are required; '+row.logged_games+' valid logged games are available.';
  el.innerHTML='<section class="cma" aria-live="polite"><h3>Matchup Analyzer</h3><p>No upcoming game with logged games for this player yet.</p><p class="mut sm">'+E(reason)+'</p><p class="mut sm">Prior-season averages and projected minutes are not used as logged games. Source snapshot: '+E(D.source_built||'date unavailable')+'.</p></section>';return;
 }
 mount(el,row,D);
 }).catch(function(){el.innerHTML='<section class="cma" aria-live="polite"><h3>Matchup Analyzer</h3><p>Matchup data is unavailable. Please try again.</p></section>'})
}
window.CBBMatchup={open:open,mount:mount,tabs:tabs};
})();
