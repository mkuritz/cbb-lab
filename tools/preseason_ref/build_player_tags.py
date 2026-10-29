"""Build public data/player_tags.json (preseason Top 100 rank, all-conference, award & All-American tags) from data/preseason_ref.json.
Keyed 'tid|normalized name'. Facts only; no source names."""
import json,re,os
H=os.path.dirname(os.path.abspath(__file__)); DATA=os.path.join(H,'..','..','data')
R=json.load(open(os.path.join(DATA,'preseason_ref.json')))
def nm(s): return re.sub(r'[^a-z]','',re.sub(r'\b(jr|sr|ii|iii|iv)\b\.?','',(s or '').lower().replace('*','')))
idx={nm(t['team']):int(k) for k,t in R['teams'].items()}
cb=json.load(open(os.path.join(DATA,'cbb.json')))
for t in cb['teams']: idx.setdefault(nm(t['team']),t['id'])
alias={'michiganst':'michiganstate','miamifl':'miami','uconn':'uconn'}
def tid(team): return idx.get(alias.get(nm(team),nm(team)))
T={}
LAST={}
def add(t,name,tag):
    if not t: return
    k=f"{t}|{nm(name)}"; T.setdefault(k,[])
    w=[x for x in name.replace('*','').split() if not re.match(r'(?i)^(jr\.?|sr\.?|ii|iii|iv)$',x)]; LAST[k]=nm(w[-1]) if w else ''
    if tag not in T[k]: T[k].append(tag)
for p in R['national']['top100_players']: add(p.get('tid') or tid(p['team']),p['name'],{'k':'top100','r':p['rank'],'t':f"Preseason Top 100 #{p['rank']}"})
for tk,x in R['teams'].items():
    for n in x.get('all_conference',[]): add(int(tk),n,{'k':'allconf','t':f"Highlighted: Preseason All-{x['conf']}"})
lab={'player_of_year':'Player of the Year','newcomer_of_year':'Newcomer of the Year','defensive_player_of_year':'Defensive Player of the Year'}
for c,v in R['conferences'].items():
    for k,a in (v.get('awards') or {}).items():
        if k in lab: add(tid(a['team']),a['name'],{'k':'confaward','t':f"Highlighted: {c} {lab[k]}"})
na=R['national']['awards']
for k in ('player_of_year','defensive_player_of_year'):
    a=na.get(k)
    if a: add(tid(a['team']),a['name'],{'k':'nataward','t':f"Highlighted: National {lab[k]}"})
for team,pl in R['national']['all_american'].items():
    for pos,n,tm in pl: add(tid(tm),n,{'k':'allam','t':f"Highlighted: {team}-Team All-American"})
# rekey name variants (e.g. Rob/Robert) to the hub roster spelling when the last name is unique on that team
roster={}
for t in cb['teams']:
    for pl in (t.get('rot') or []): roster.setdefault(t['id'],[]).append(pl['n'])
for k in list(T):
    t,n=k.split('|',1); names=roster.get(int(t),[])
    if any(nm(x)==n for x in names): continue
    cands=[x for x in names if nm(x.split()[-1] if not re.match(r'(?i)^(jr\.?|sr\.?|ii|iii|iv)$',x.split()[-1]) else x.split()[-2])==LAST.get(k)]
    if len(cands)==1:
        nk=f"{t}|{nm(cands[0])}"; old=T.pop(k); T.setdefault(nk,[])
        T[nk]+= [x for x in old if x not in T[nk]]
json.dump(T,open(os.path.join(DATA,'player_tags.json'),'w'),separators=(',',':'))
print('players tagged',len(T),'tags',sum(len(v) for v in T.values()))
