import re, json, html, sys
SRC=sys.argv[1] if len(sys.argv)>1 else '/tmp/guide_bbox.html'
raw=open(SRC).read()
pages=[]
for pm in re.finditer(r'<page[^>]*>(.*?)</page>',raw,re.S):
    ws=[]
    for m in re.finditer(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<',pm.group(1)):
        x,y,X,Y,w=m.groups(); ws.append(dict(x=float(x),y=float(y),X=float(X),Y=float(Y),h=float(Y)-float(y),w=html.unescape(w)))
    pages.append(ws)
def lines(ws,tol=8):
    ws=sorted(ws,key=lambda w:(w['y'],w['x'])); out=[]
    for w in ws:
        for L in out:
            if abs(L[0]['y']-w['y'])<tol: L.append(w); break
        else: out.append([w])
    return [(min(a['y'] for a in L),' '.join(a['w'] for a in sorted(L,key=lambda a:a['x']))) for L in sorted(out,key=lambda L:L[0]['y'])]
def find(ws,word,ymax=None):
    return [w for w in ws if w['w']==word and (ymax is None or w['y']<ymax)]
def region(ws,x0,x1,y0,y1): return [w for w in ws if x0<=w['x']<x1 and y0<=w['y']<y1]
def items(txtlines):
    out=[];cur=''
    for _,t in txtlines:
        cur=(cur+' '+t).strip()
        if cur.count('(')<=cur.count(')') and cur.endswith(')'): out.append(cur);cur=''
    if cur: out.append(cur)
    res=[]
    for s in out:
        m=re.match(r'(.*?)\s*\((.*)\)$',s)
        res.append({'name':(m.group(1) if m else s).title().strip(),'detail':(m.group(2) if m else None)})
    return res
TOC=[('ACC',10),('Big 12',29),('Big East',46),('Big Ten',58),('Pac-12',77),('SEC',87),('American',105),('A-10',119),('MWC',136),('WCC',147),('Big Sky',158),('Big South',170),('Big West',180),('CAA',194),('CUSA',209),('Horizon',220),('Ivy',233),('MAC',243),('MVC',256),('SoCon',268),('Southland',280),('Summit',293),('Sun Belt',302),('UAC',317),('America East',329),('ASUN',339),('Metro',348),('MEAC',362),('NEC',371),('OVC',381),('Patriot',391),('SWAC',402)]
MAXPAGE=354  # pages 355-414 are corrupt (null page objects) in the source file
def conf_of(p): return [c for c,s in TOC if s<=p][-1]
teams=[]
for pi,ws in enumerate(pages,1):
    if pi>MAXPAGE: break
    t=' '.join(w['w'] for w in ws)
    if 'STARTING' not in t or 'ADDITIONS' not in t: continue
    ka=[w for w in find(ws,'ADDITIONS') if w['y']<1200]
    sp=[w for w in find(ws,'PREVIEW') if w['y']>ka[0]['y']+50] if ka else []
    if not ka: continue
    yk=ka[0]['y']; yend=min([w['y'] for w in sp] or [yk+600])
    conf=conf_of(pi)
    big=[w for w in region(ws,0,1000,40,yk-20) if w['h']>40]
    nl=lines(big,30); name=' '.join(t for _,t in nl[:-1]).title(); nick=nl[-1][1].title() if nl else None
    if nick and nick.split()[0] in ('State','St.') and len(nick.split())>1: name+=' '+nick.split()[0]; nick=' '.join(nick.split()[1:])
    def reg(x0,x1,y0,y1): return [t for _,t in lines(region(ws,x0,x1,y0,y1))]
    rec=reg(1000,1260,yk-330,yk-60); er=reg(1260,1520,yk-330,yk-60); co=reg(1520,2000,yk-330,yk-60)
    def g(lst,pat):
        for s in lst:
            m=re.search(pat,s)
            if m: return m.group(1)
    adds=items(lines(region(ws,0,590,yk+40,yend-10)))
    loss=items(lines(region(ws,590,1000,yk+40,yend-10)))
    five=[]
    pos=[w for w in region(ws,1000,1080,yk+40,yend-10) if w['w'] in('PG','SG','SF','PF','C','G','F','W','CG')]
    for p in sorted(pos,key=lambda w:w['y']):
        nw=sorted([w for w in region(ws,1080,1385,p['y']-25,p['y']+30)],key=lambda w:w['x'])
        hw=sorted([w for w in region(ws,1385,1520,p['y']-25,p['y']+30)],key=lambda w:w['x'])
        ht=' '.join(w['w'] for w in hw)
        m=re.match(r'''(\d+'\d+")\s*(.*)''',ht)
        five.append({'pos':p['w'],'name':' '.join(w['w'] for w in nw),'ht':m.group(1) if m else None,'cls':(m.group(2).rstrip('.')+('.' if m and m.group(2).endswith('.') and len(m.group(2))<5 else '')) if m else ht or None})
    fin=reg(1520,2000,yk+40,yend-10); ft=' '.join(fin)
    pf=g([ft],r'^(\d+(?:ST|ND|RD|TH|st|nd|rd|th))'); post=g([ft],r'POSTSEASON:\s*(.*)$')
    # player to know (bbox block left of the blurb column)
    ptk=None
    kw=[w for w in ws if w['w']=='KNOW']
    if kw:
        k=kw[0]; blk=[w for w in ws if k['Y']<w['y']<k['y']+330 and k['x']-300<w['x']<1250]
        nmw=sorted([w for w in blk if w['h']>40 and w['y']<k['y']+110 and not re.match(r'^[\d.%]+$',w['w'])],key=lambda w:(round(w['y']/20),w['x']))
        bio=' '.join(w['w'] for w in sorted([w for w in blk if 20<w['h']<35 and k['y']+90<w['y']<k['y']+150],key=lambda w:w['x']))
        parts=[p.strip() for p in bio.split('|')]
        stats={}
        for lab in [w for w in blk if w['w'] in('PPG','RPG','APG','FG%','SPG','BPG','3P%','FT%')]:
            v=[w for w in blk if abs(w['x']-lab['x'])<45 and lab['y']-80<w['y']<lab['y']-20 and re.match(r'^\d+(\.\d+)?%?$',w['w'])]
            if v: stats[lab['w']]=v[0]['w']
        if nmw and len(parts)>=3:
            ptk={'name':' '.join(w['w'] for w in nmw),'ht':parts[0],'cls':parts[1].title(),'pos':parts[2].title(),'status':(parts[3].title() if len(parts)>3 else None),'last_season':stats}
    teams.append(dict(page=pi,team=name,nickname=nick,conf=conf,record_2025_26=g(rec,r'^(\d+-\d+)$'),conf_record_2025_26=g(rec,r'\((\d+-\d+)\)'),
        last_eff_rank_prior=int(g(er,r'#(\d+)')) if g(er,r'#(\d+)') else None,head_coach=next((c.title() for c in co if 'COACH' not in c and 'SEASON' not in c),None),
        coach_season=g(co,r'(\d+)\w\w SEASON'),key_additions=adds,key_losses=loss,projected_starting_five=five,projected_conf_finish=pf,postseason_outlook=post,player_to_know=ptk))
json.dump(teams,open('guide_teams.json','w'),indent=1)
print(len(teams))
