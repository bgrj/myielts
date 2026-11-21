"""Align canonical source PDF sentences to original audio, keeping all speakers."""
from pathlib import Path
import sys,json,re,difflib,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.test-artifacts/media-tools'))
import imageio_ffmpeg
from num2words import num2words
def tokens(text):
    text=text.lower().replace('’',"'").replace('kilometers','kilometres').replace('okay','ok').replace('alright','all right')
    text=re.sub(r'(?<=\d),(?=\d)','',text)
    text=re.sub(r'\b\d+\b',lambda m:num2words(int(m[0])) if len(m[0])<5 else m[0],text)
    return re.findall(r"[a-z]+|\d+",text)
data=json.loads((ROOT/'content/listening-source-transcripts.json').read_text(encoding='utf8'))
for lesson in data['lessons']:
    records=json.loads((ROOT/f".test-artifacts/{lesson['id']}-timings.json").read_text(encoding='utf8'))
    words=[w for seg in records for w in seg['words']]
    a=[];ai=[];b=[];bi=[]
    for i,s in enumerate(lesson['sentences']):
        t=tokens(s['sentence']);a.extend(t);ai.extend([i]*len(t))
    for i,w in enumerate(words):
        t=tokens(w['word']);b.extend(t);bi.extend([i]*len(t))
    matches=[[] for s in lesson['sentences']]
    for block in difflib.SequenceMatcher(None,a,b,autojunk=False).get_matching_blocks():
        for j in range(block.size):matches[ai[block.a+j]].append(bi[block.b+j])
    result=[]
    for i,s in enumerate(lesson['sentences']):
        m=matches[i];count=len(tokens(s['sentence']));coverage=len(m)/count if count else 0
        start=words[min(m)]['start'] if m else None;end=words[max(m)]['end'] if m else None
        result.append({**s,'start':start,'end':end,'coverage':round(coverage,3)})
    # Unrecognised short responses are bounded by the surrounding canonical sentences.
    for i,s in enumerate(result):
        if s['start'] is None:
            s['start']=result[i-1]['end'] if i else 0
            s['end']=next((n['start'] for n in result[i+1:] if n['start'] is not None),s['start']+.5)
    out=ROOT/f".test-artifacts/{lesson['id']}-aligned.json"
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    print(lesson['id'],len(result),'sentences')
    for s in result:
        if s['coverage']<.75 or s['end']-s['start']>20:print(s['order'],s['coverage'],s['start'],s['end'],s['sentence'])
