"""Extract verified original-voice clips using the user's 38-sentence timing sheet."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import sys
import unicodedata

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.test-artifacts/media-tools'))
import imageio_ffmpeg
from mutagen.mp3 import MP3
import pymupdf

folder=ROOT/'雅思听力/雅思情景练习/01-旅行自驾游预订'
notes=next(folder.glob('*发音*目录.pdf'))
source=next(folder.glob('*发音*精听拼接.mp3'))
text=unicodedata.normalize('NFKC','\n'.join(p.get_text() for p in pymupdf.open(notes)))
text=text[text.index('逐句说明'):]
matches=list(re.finditer(r'(?m)^(\d{2})\s+([^\n]+)\n拼接位置[:：]([^\n]+)',text))
if len(matches)!=38: raise RuntimeError(f'Expected 38 timed original clips, found {len(matches)}')
ffmpeg=shutil.which('ffmpeg') or imageio_ffmpeg.get_ffmpeg_exe()
out=ROOT/'content/audio';out.mkdir(parents=True,exist_ok=True)
cards=json.loads((ROOT/'web/data/cards.json').read_text(encoding='utf8'))
by_id={c['id']:c for c in cards}
source_sha=hashlib.sha256(source.read_bytes()).hexdigest()
def seconds(stamp):
    m,s=stamp.split(':');return int(m)*60+float(s)
def normalize(sentence): return re.sub(r'\s+',' ',sentence).strip().replace('\xad','-')
items=[]
for i,match in enumerate(matches):
    number,speaker,position=match.groups()
    times=re.findall(r'\d{2}:\d{2}\.\d{2}',position)
    if len(times)<3: raise RuntimeError('Missing repeat boundary for '+number)
    start=max(0,seconds(times[0])-.03)
    end=seconds(times[2])-.12
    body=text[match.end():matches[i+1].start() if i+1<len(matches) else len(text)]
    original=re.search(r'原文[:：](.*?)(?=截取说明[:：]|为什么容易听不清[:：])',body,re.S)
    card=by_id['c10-t1-s1-'+number]
    if not original or normalize(original.group(1))!=normalize(card['sentence']): raise RuntimeError('Transcript mismatch for '+card['id'])
    temp=out/(card['id']+'.tmp.mp3')
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-ss',f'{start:.3f}','-i',str(source),'-t',f'{end-start:.3f}','-vn','-ac','1','-ar','44100','-codec:a','libmp3lame','-b:a','96k','-map_metadata','-1',str(temp)],check=True)
    raw=temp.read_bytes();sha=hashlib.sha256(raw).hexdigest()
    dest=out/f'{card["id"]}-{sha[:12]}.mp3'
    if dest.exists(): temp.unlink()
    else: temp.rename(dest)
    audio=MP3(dest)
    duration=round(audio.info.length,6)
    card['audio']={'url':'https://ourbeings.com/ielts/recordings/'+dest.name,'start':0,'end':duration}
    card['audioSource']='剑雅 10 · Test 1 · Section 1 原录音；按个人38句发音障碍目录精确截取'
    card['speaker']=normalize(speaker)
    card['sourceVerified']=True
    card['feedback']=card.get('feedback') or ('原有38句精听反馈：'+card['sentence']+('；'+card['personalError'] if card.get('personalError') else ''))
    items.append({'id':card['id'],'sentence':card['sentence'],'speaker':card['speaker'],'path':dest.relative_to(ROOT).as_posix(),'sha256':sha,'bytes':len(raw),'duration':duration,'sampleRate':audio.info.sample_rate,'channels':audio.info.channels,'sourceArtifact':source.relative_to(ROOT).as_posix(),'sourceSha256':source_sha,'sourceStart':round(start,3),'sourceEnd':round(end,3),'method':'Extract original recorded speech; mono MP3 96kbps, no synthesized voice'})
    if (i+1)%10==0: print(f'Extracted {i+1}/38 original-voice clips',flush=True)
(ROOT/'web/data/cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
feed=json.loads((ROOT/'content/listening.json').read_text(encoding='utf8'))
for existing in feed['cards']:
    full=by_id[existing['id']]
    for key in ['audio','audioSource','speaker','sourceVerified']: existing[key]=full[key]
feed['updatedAt']=datetime.now(timezone.utc).isoformat()
(ROOT/'content/listening.json').write_text(json.dumps(feed,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
manifest={'schemaVersion':1,'recording':'Cambridge IELTS 10 Test 1 Section 1','count':38,'totalBytes':sum(x['bytes'] for x in items),'generatedAt':datetime.now(timezone.utc).isoformat(),'clips':items}
(ROOT/'content/audio-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(f'Created {len(items)} original-voice clips, {manifest["totalBytes"]} bytes; all transcripts match the timing sheet.',flush=True)
