/* Old standalone route -> integrated Hub view. Keeps only supported IDs (?game=<digits>, ?team=<digits>). */
(function(){var q=new URLSearchParams(location.search),o=new URLSearchParams();var g=q.get('game'),t=q.get('team');
if(g&&/^\d{1,12}$/.test(g))o.set('duel_game',g);if(t&&/^\d{1,6}$/.test(t))o.set('duel_team',t);
var to='index.html'+(o.toString()?'?'+o:'')+'#duel';window.__duelRedirect=to;try{location.replace(to)}catch(e){}})();
