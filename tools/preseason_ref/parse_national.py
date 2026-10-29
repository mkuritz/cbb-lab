import re,json,subprocess
import os
PDF=os.environ.get('GUIDE_PDF','/workspace/drive_t1364/guide.pdf')
def pt(p): return subprocess.run(['pdftotext','-layout','-f',str(p),'-l',str(p),PDF,'-'],capture_output=True,text=True).stdout
top=[]
for p in (9,135,193,327):
    for m in re.finditer(r"^\s*(\d{1,3}) ([^,\n]+?)(\*?), ([^\n]+?)(?:\s{2,}.*)?$",pt(p),re.M):
        top.append({'rank':int(m.group(1)),'name':m.group(2).strip(),'fifth_year_flag':bool(m.group(3)),'team':m.group(4).strip()})
top=sorted({t['rank']:t for t in top}.values(),key=lambda t:t['rank'])
t25={}
txt=pt(6)
for r,n in re.findall(r"(?<!\d)(\d{1,2})\s+([A-Z][A-Za-z.’' ]+?)(?=\s{2,}|\s+\d|$)",txt,re.M):
    if 2<=int(r)<=25 and n.strip() not in('PREDICTIONS',): t25[int(r)]=n.strip()
# #1 and #2 are printed as display graphics ('1 FLORIDA' overlaid, '2' above 'Duke'); verified against page 6 text
if 1 not in t25 and 'FLORIDA' in txt: t25[1]='Florida'
if 2 not in t25 and re.search(r"^\s*Duke\s",txt,re.M): t25[2]='Duke'
json.dump({'top25':[{'rank':k,'team':t25[k]} for k in sorted(t25)],'top100_players':top,
 'national_awards':{'player_of_year':{'name':'Jeremy Fears Jr.','team':'Michigan State'},'defensive_player_of_year':{'name':'Rueben Chinyelu','team':'Florida'},'coach_of_year':{'name':'Sean Miller','team':'Texas'},'national_champion':'Duke'},
 'all_american':{'1st':[['G','Jeremy Fears Jr.','Michigan State'],['G','Tyler Tanner','Vanderbilt'],['F','Thomas Haugh','Florida'],['F','Tyran Stokes','Kansas'],['F','David Mirkovic','Illinois']],'2nd':[['G','John Blackwell','Duke'],['G','Rob Wright III','BYU'],['G','Silas Demary Jr.','UConn'],['F','Flory Bidunga','Louisville'],['C','Motiejus Krivas','Arizona']],'3rd':[['G','Nigel James Jr.','Marquette'],['G','Juke Harris','Tennessee'],['G','Caleb Holt','Arizona'],['F','Joaquim Boumtje Boumtje','Duke'],['C','Matas Vokietaitis','Texas']]}},open('guide_national.json','w'),indent=1)
print(len(t25),sorted(t25.items()),len(top),[t['rank'] for t in top][:3],set(range(1,101))-{t['rank'] for t in top})
