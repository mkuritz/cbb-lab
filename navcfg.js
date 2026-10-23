/* CBB Hub top-bar config (window.SLTOP, same shape as CFB/NFL). */
window.SLTOP={
 sports:window.SLS?SLS.top():[["NBA","https://betlab.sportslabshq.com/","nba"],["NFL","https://nfllab.sportslabshq.com/","nfl"],["CFB","https://cfblab.sportslabshq.com/","cfb"],["CBB","index.html","cbb"],["NHL","https://nhllab.sportslabshq.com/","nhl"],["MLB","https://mlblab.sportslabshq.com/","mlb"]],
 by:[["Most Improved","index.html","index"],["Transfers","transfers.html","transfers"],["Teams","teams.html","teams"],["Method","method.html","method"]].concat(window.SLS?[["CBB in Bet Lab ↗",SLS.betlab("ncaamb"),"bl"]]:[]),
 ask:"https://betlab.sportslabshq.com/#ask&q=",cur:"cbb",ready:{cbb:true}};
