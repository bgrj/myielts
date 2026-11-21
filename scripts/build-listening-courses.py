"""Build complete ordered courses and auditable, original-voice sentence clips."""
from pathlib import Path
import sys,json,hashlib,subprocess,re
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.test-artifacts/media-tools'))
import imageio_ffmpeg
from mutagen.mp3 import MP3
source=json.loads((ROOT/'content/listening-source-transcripts.json').read_text(encoding='utf8'))
manifest_path=ROOT/'content/listening-audio-manifest.json'
oldpaths={c['path'] for c in json.loads(manifest_path.read_text(encoding='utf8'))['clips']} if manifest_path.exists() else set()
old=json.loads((ROOT/'web/data/cards.json').read_text(encoding='utf8'))
translations={52:'谢谢。',53:'我能问一下，您是从哪里知道 World Tours 的？',54:'是朋友介绍的吗？',55:'还是您在哪里看到了广告？',69:'我不想住帐篷。',70:'那会太热了。',74:'我们还能安排的另一条线路略有不同。',75:'它从旧金山出发。',76:'然后你们向南开往 Cambria。',80:'太好了。',81:'我想去看看。',82:'这条线路也会进入沙漠吗？',89:'我想不用了。',90:'我们想留点时间晒太阳和游泳。',94:'我刚才说的第一条是穿越加州的自驾游，全程十二天，行驶 2,020 公里。',95:'最短的一段路程为 206 公里，最长的为 632 公里。',96:'费用是每人 525 英镑。',97:'这包含住宿、租车和一程航班，但不含餐食。',109:'好的。',110:'那非常感谢您。',111:'等我有机会看完宣传册后，会再联系您。'}
# Exact bounds for strings that ASR cannot reliably align (spelling, phone, quiet farewell).
manual={'self-drive':{46:(185.66,188.86),51:(194.54,200.98),113:(407.95,408.55),114:(408.65,409.4)}}
cards=[];lessons=[];clips=[]
outdir=ROOT/'content/audio';outdir.mkdir(exist_ok=True)
for lesson in source['lessons']:
    aligned=json.loads((ROOT/f".test-artifacts/{lesson['id']}-aligned.json").read_text(encoding='utf8'))
    original=ROOT/lesson['sourceAudio'];sourcebytes=original.read_bytes();sourcehash=hashlib.sha256(sourcebytes).hexdigest()
    archivepath=outdir/f"{lesson['id']}-complete-{sourcehash[:10]}.mp3"
    archivepath.write_bytes(sourcebytes)
    lesson['archivedAudio']=archivepath.relative_to(ROOT).as_posix()
    lesson['sourceAudioSha256']=sourcehash
    for i,s in enumerate(aligned):
        start,end=manual.get(lesson['id'],{}).get(s['order'],(s['start'],s['end']))
        previous=manual.get(lesson['id'],{}).get(aligned[i-1]['order'],(aligned[i-1]['start'],aligned[i-1]['end']))[1] if i else 0
        following=manual.get(lesson['id'],{}).get(aligned[i+1]['order'],(aligned[i+1]['start'],aligned[i+1]['end']))[0] if i+1<len(aligned) else MP3(original).info.length
        # Preserve consonants without including the neighbouring sentence's words.
        start=max(0,start-.12,(previous+start)/2 if previous<=start else start)
        end=min(MP3(original).info.length,end+.16,(end+following)/2 if following>=end else end)
        if end<=start:raise ValueError(s['id'])
        temp=ROOT/'.test-artifacts/clip.mp3'
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-ss',str(start),'-i',str(original),'-t',str(end-start),'-map_metadata','-1','-ac','1','-ar','44100','-b:a','96k',str(temp)],check=True)
        raw=temp.read_bytes();sha=hashlib.sha256(raw).hexdigest();name=f"{s['id']}-{sha[:10]}.mp3";path=outdir/name
        path.write_bytes(raw);duration=round(MP3(path).info.length,6)
        translation=translations.get(s['order'],s['translation']) if lesson['id']=='self-drive' else s['translation']
        matching=next((c for c in old if c['kind']=='listening' and c['sentence'].lower().strip(' .') in s['sentence'].lower()),None)
        note=matching.get('note','') if matching else ''
        if not note:note='先听原声，独立写完整句；核对拼写、缩写和词尾，再回听对应片段。'
        if s['speaker']=='ANNOUNCER':note='播音员原声也是听写内容。留意指令中的题号、时间和动作；听完独立写句，再核对原文。'
        grammar=matching.get('grammar','') if matching else ''
        pronunciation=matching.get('pronunciation','') if matching else ''
        if not pronunciation:pronunciation="用原音核对重读信息词和轻读的功能词；缩写按实际读音听，不把漏听的 a、the、to 或词尾省略。"
        card={k:s[k] for k in ['id','lessonId','order','speaker','sectionGroup','sourceTurn']}
        card.update(kind='listening',target=s['sentence'],sentence=s['sentence'],focus=s['sentence'],source=lesson['source'],title=lesson['title'],translation=translation,meaning=translation,note=note,grammar=grammar,pronunciation=pronunciation,feedback=matching.get('feedback','') if matching else '',originalRef=f"{lesson['source']} · 原声第 {s['order']} 句 · {start:.2f}–{end:.2f}s",sourceVerified=True,origin='完整原声逐句课程',fragment=s['sentence'].endswith('...'),tags=['逐句听写','播音员' if s['speaker']=='ANNOUNCER' else '场景原声'],audioSource=f"{lesson['sourceAudio']} · SHA256 {sourcehash}",audio={'url':f'https://ourbeings.com/ielts/recordings/{name}','start':0,'end':duration})
        cards.append(card)
        clips.append({'id':s['id'],'lessonId':lesson['id'],'order':s['order'],'speaker':s['speaker'],'sentence':s['sentence'],'path':path.relative_to(ROOT).as_posix(),'sha256':sha,'bytes':len(raw),'duration':duration,'sourcePath':lesson['archivedAudio'],'sourceSha256':sourcehash,'sourceStart':round(start,3),'sourceEnd':round(end,3),'alignmentCoverage':s['coverage'],'manualBounds':s['order'] in manual.get(lesson['id'],{})})
    lessons.append({'id':lesson['id'],'title':lesson['title'],'source':lesson['source'],'sentenceCount':len(aligned),'announcerCount':sum(s['speaker']=='ANNOUNCER' for s in aligned),'release':'initial','releaseNote':''})
feed={'schemaVersion':1,'kind':'listening','botId':'e79fc4f8-184b-450b-b10e-a21f91070599','revision':3,'updatedAt':datetime.now(timezone.utc).isoformat(),'publisher':'verified-feedback','lessons':lessons,'cards':cards}
for name in ['content/listening.json','web/data/listening.json']:(ROOT/name).write_text(json.dumps(feed,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(ROOT/'content/listening-source-transcripts.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(ROOT/'content/listening-audio-manifest.json').write_text(json.dumps({'schemaVersion':1,'count':len(clips),'method':'Canonical bilingual source PDF + local word timing alignment; manual corrections for spelling, telephone and quiet farewell; original MP3 clips only.','lessons':lessons,'clips':clips},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
for path in oldpaths-{c['path'] for c in clips}:
    obsolete=(ROOT/path).resolve()
    if obsolete.parent != outdir.resolve():raise ValueError('Unexpected archive path')
    obsolete.unlink(missing_ok=True)
print('Built',len(cards),'original-voice sentence clips,',sum(c['bytes'] for c in clips),'bytes')
