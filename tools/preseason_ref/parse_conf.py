import re,json,sys
sys.argv=[sys.argv[0]]+sys.argv[1:2]
exec(open('parse_guide.py').read().split('teams=[]')[0])
def L(ws): return lines(ws,12)
out={}
for conf,p in TOC:
    if p>MAXPAGE: continue
    ws=pages[p-1]
    st=[w for w in ws if w['w']=='STANDINGS'][0]; ap=[w for w in ws if w['w']=='AWARD'][0]
    allc=[w for w in ws if w['w']=='ALL-CONFERENCE'][0]
    xs=allc['x']-60
    left=[w for w in region(ws,0,xs,st['y']+10,ap['y']-5) if w['w'] not in('CONFERENCE','STANDINGS')]
    standings={}
    for _,t in L(left):
        for r,n in re.findall(r"(\d{1,2})\s+([A-Za-z][^\d]*?)(?=\s+\d{1,2}\s|$)",t): standings[int(r)]=n.strip()
    right=[w for w in region(ws,xs,2000,allc['Y']+5,ap['y']-5) if w['w'] not in('ALL-CONFERENCE','TEAM','CONFERENCE','PREDICTIONS')]
    px=min([w['x'] for w in right if w['w'] in('G','F','C','F/C','G/F')] or [1100])+60
    nm=[(y,t) for y,t in L([w for w in right if w['x']>px])]
    names=[(y,t) for y,t in nm if not t.isupper()]; tms=[(y,t) for y,t in nm if t.isupper()]
    poss=[t for _,t in L([w for w in right if w['x']<=px])]
    ac=[{'name':n.replace('*','').strip(),'fifth_year_flag':'*' in n,'pos':(poss[i] if i<len(poss) else None),'team':(tms[i][1].title() if i<len(tms) else None)} for i,(_,n) in enumerate(names)]
    hdrs=[w for w in ws if w['w'] in('PLAYER','NEWCOMER','COACH','DEFENSIVE','YEAR') and w['y']>ap['Y']]
    hy=max(w['Y'] for w in hdrs)
    fy=min([w['y'] for w in ws if w['w']=='asterisk' and w['y']>hy]+[2475])
    bodies=region(ws,0,2000,hy+5,fy-5)
    keys=['player_of_year','newcomer_of_year','defensive_player_of_year','coach_of_year']
    awards={}
    for k,(x0,x1) in zip(keys,[(0,480),(480,960),(960,1450),(1450,2000)]):
        col=[t for _,t in L(region(bodies,x0,x1,0,3000))]
        team=[c for c in col if c.isupper()]; n=[c for c in col if not c.isupper()]
        awards[k]={'name':' '.join(n).replace('*','').strip() or None,'team':' '.join(team).title() if team else None}
    out[conf]={'page':p,'standings':[standings[k] for k in sorted(standings)],'all_conference':ac,'awards':awards}
json.dump(out,open('guide_conf.json','w'),indent=1)
for c,v in out.items(): print(c,len(v['standings']),len(v['all_conference']),[a['name'] for a in v['awards'].values()])
