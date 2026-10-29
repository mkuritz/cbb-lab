"""Build cbb-lab/data/preseason_ref.json from the 2026-27 preseason guide PDF (PDF kept out of git).
Usage: GUIDE_PDF=/path/guide.pdf; pdftotext -bbox "$GUIDE_PDF" /tmp/guide_bbox.html; python3 parse_guide.py; python3 parse_conf.py; python3 parse_national.py; python3 build_preseason_ref.py
Extracted facts only (no prose). Never touches pricer constants."""
import json,re,collections,os
H=os.path.dirname(os.path.abspath(__file__))
CBB=os.environ.get('CBB_JSON','/workspace/cbb-lab/data/cbb.json')
OUT=os.environ.get('OUT','/workspace/cbb-lab/data/preseason_ref.json')
g=json.load(open(f'{H}/guide_teams.json'));cf=json.load(open(f'{H}/guide_conf.json'));nat=json.load(open(f'{H}/guide_national.json'))
d=json.load(open(CBB))
ALIAS={'Usf':'South Florida','San Jose State':'San José State','Seattle':'Seattle U','Usc Upstate':'South Carolina Upstate','Cal Baptist':'California Baptist','Csun':'Cal State Northridge','Fiu':'Florida International','Sam Houston State':'Sam Houston','Fort Wayne':'Purdue Fort Wayne','Iu Indy':'IU Indianapolis','Penn':'Pennsylvania','Umass':'Massachusetts','Illinois Chicago':'UIC','East Tennessee':'East Tennessee State','Incarnate Ward':'Incarnate Word','Lsu New Orleans':'New Orleans','Nicholls State':'Nicholls','Texas A&M Cc':'Texas A&M-Corpus Christi','Utrgv':'UT Rio Grande Valley','St.Thomas':'St. Thomas-Minnesota','Louisiana Monroe':'UL Monroe','Albany':'UAlbany','Queens':'Queens University','Middle Tennessee State':'Middle Tennessee',
 'Michigan St.':'Michigan State','Miami FL':'Miami','Miami Fl':'Miami','St. John’s':"St. John's"}
def n(s): return re.sub(r'[^a-z0-9]','',s.lower().replace('state','st').replace('saint','st'))
idx={n(t['team']):t for t in d['teams']}
def tid(name):
    t=idx.get(n(ALIAS.get(name,name))); return t['id'] if t else None
def pn(s): return re.sub(r'[^a-z]','',re.sub(r'\b(jr|sr|ii|iii|iv)\b\.?','',s.lower()))
FINAL={'GRADUATED','NBA','PRO','PORTAL','OVERSEAS','G LEAGUE','EXHAUSTED ELIGIBILITY','RETIRED','TRANSFERRED'}
def kind(det):
    if not det: return 'unknown'
    u=det.upper()
    if 'FRESHMAN' in u or u in('HS','HIGH SCHOOL') or 'PREP' in u or 'HS' in u.split(): return 'freshman'
    if 'JUCO' in u: return 'juco'
    if re.match(r'^D2|^D-?II|^NAIA|^D3',u): return 'lower_division'
    if u in ('GRADUATED','EXHAUSTED ELIGIBILITY'): return 'graduated'
    if 'NBA' in u or 'PRO' in u.split() or 'OVERSEAS' in u or 'G LEAGUE' in u or 'EUROLEAGUE' in u: return 'pro'
    if u=='PORTAL' or 'UNKNOWN' in u: return 'portal'
    if 'INTERNATIONAL' in u or 'OVERSEAS' in u: return 'international'
    if 'REDSHIRT' in u or 'INJURY' in u or 'RETURN' in u: return 'other'
    return 'school'
CLS={'fr':'Fr','so':'So','jr':'Jr','sr':'Sr','gr':'Gr','5th':'5th','6th':'6th'}
def cls(c):
    if not c: return None
    c=c.lower().replace('.','').replace('r-','')
    return CLS.get(c.split()[0] if c else c)
def htin(h):
    m=re.match(r"(\d+)'(\d+)",h or ''); return int(m.group(1))*12+int(m.group(2)) if m else None
def nice_school(det):
    if not det: return None
    i=tid(det.title())
    if i: return next(t['team'] for t in d['teams'] if t['id']==i)
    return re.sub(r"\b(Uc|Unc|Ucf|Uab|Utep|Utsa|Lsu|Tcu|Smu|Byu|Vcu|Unlv|Njit|Liu|Fiu|Fau|Uic|Umbc|Siue|Usc|Ucla|Etsu|Fgcu|Nba|Juco|D2|Naia|Ii|Iii|Iv)\b",lambda m:m.group(1).upper(),det.title())
def nice_player(nm):
    nm=nm.replace('*','').strip()
    out=[]
    for w in nm.split():
        if re.fullmatch(r"[A-Za-z]{2}",w) and w.lower() not in('jr','sr','de','da','la','le','di','du','el','ka'): w=w.upper()
        elif w.lower() in('ii','iii','iv'): w=w.upper()
        w=re.sub(r"\b(Mc|Mac)([a-z])",lambda m:m.group(1)+m.group(2).upper(),w) if w.startswith(('Mc',)) else w
        w=re.sub(r"-Mc([a-z])",lambda m:'-Mc'+m.group(1).upper(),w)
        out.append(w)
    return ' '.join(out)
top100={};[top100.setdefault(tid(p['team']),[]).append(p) for p in nat['top100_players']]
t25={tid(x['team']):x['rank'] for x in nat['top25']}
allc={}
for c,v in cf.items():
    for p in v['all_conference']: allc.setdefault(tid(p['team'] or ''),[]).append(p['name'])
teams={};unmapped=[]
bycf=collections.defaultdict(list)
for x in g:
    i=tid(x['team'])
    if not i: unmapped.append(x['team']);continue
    T=next(t for t in d['teams'] if t['id']==i)
    roster={pn(p['n']):p for p in (T.get('rot') or [])}
    five=[]
    for f in x['projected_starting_five']:
        p=roster.get(pn(f['name']))
        five.append({'pos':f['pos'],'name':f['name'],'ht':f['ht'],'ht_in':htin(f['ht']),'cls':cls(f['cls']),'pid':p['id'] if p and p.get('id') else None})
    adds=[{'name':nice_player(a['name']),'fifth_year_flag':'*' in a['name'],'from':nice_school(a['detail']),'type':kind(a['detail'])} for a in x['key_additions']]
    loss=[{'name':nice_player(a['name']),'to':nice_school(a['detail']),'type':kind(a['detail'])} for a in x['key_losses']]
    hs=[f['ht_in'] for f in five if f['ht_in']]
    vet=sum(1 for f in five if f['cls'] in('Sr','Gr','5th','6th'))
    fin=int(re.match(r'\d+',x['projected_conf_finish']).group()) if x['projected_conf_finish'] else None
    ptk=x['player_to_know']
    if ptk: 
        p=roster.get(pn(ptk['name'])); ptk['pid']=p['id'] if p and p.get('id') else None
    teams[str(i)]={'tid':i,'team':T['team'],'conf':x['conf'],'last_record':x['record_2025_26'],'last_conf_record':x['conf_record_2025_26'],
     'last_eff_rank':x['last_eff_rank_prior'],'coach':x['head_coach'],'coach_season':int(x['coach_season']) if x['coach_season'] else None,
     'first_year_coach':x['coach_season']=='1','proj_conf_finish':fin,'postseason_outlook':x['postseason_outlook'],'preseason_top25':t25.get(i),
     'key_additions':adds,'key_losses':loss,'proj_starting_five':five,
     'five_avg_ht_in':round(sum(hs)/len(hs),1) if hs else None,'five_vets':vet,
     'five_newcomers':sum(1 for f in five if any(pn(a['name'])==pn(f['name']) for a in adds)),
     'player_to_know':ptk,'top100':[{'rank':p['rank'],'name':p['name']} for p in top100.get(i,[])],'all_conference':allc.get(i,[])}
    if fin: bycf[x['conf']].append((fin,T['team'],i))
conf={c:{'proj_standings':[{'rank':r,'team':tm,'tid':i} for r,tm,i in sorted(v)],
         'awards':{k:v for k,v in (cf.get(c,{}).get('awards') or {}).items() if v.get('name') and len(v['name'].split())>=2 and v.get('team') and tid(v['team'])}} for c,v in bycf.items()}
out={'season':'2026-27','built_from':'preseason reference guide (offline PDF, facts only)','n_teams':len(teams),
 'missing_conferences':['Metro (partial: 6 of 13)','MEAC','NEC','OVC','Patriot','SWAC'],
 'teams':teams,'conferences':conf,
 'national':{'top25':[dict(x,tid=tid(x['team'])) for x in nat['top25']],'top100_players':[dict(p,tid=tid(p['team'])) for p in nat['top100_players']],'awards':nat['national_awards'],'all_american':nat['all_american']}}
json.dump(out,open(OUT,'w'),separators=(',',':'))
print('teams',len(teams),'unmapped',unmapped)
print('five linked',sum(1 for t in teams.values() for f in t['proj_starting_five'] if f['pid']),'/',sum(len(t['proj_starting_five']) for t in teams.values()))
print('add types',collections.Counter(a['type'] for t in teams.values() for a in t['key_additions']))
print('loss types',collections.Counter(a['type'] for t in teams.values() for a in t['key_losses']))
print('first-yr coaches',sum(t['first_year_coach'] for t in teams.values()),'t25 mapped',sum(1 for x in out['national']['top25'] if x['tid']),'t100 mapped',sum(1 for x in out['national']['top100_players'] if x['tid']))
