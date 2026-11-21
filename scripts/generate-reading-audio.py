"""Pre-render natural British reading speech, shared by cards with identical sentences.

Requires edge-tts and mutagen. No private chat or credentials are sent; only source sentences.
"""
from pathlib import Path
import sys,json,hashlib,asyncio,os
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.test-artifacts/media-tools'))
import edge_tts
from mutagen.mp3 import MP3
VOICE='en-GB-SoniaNeural';RATE='-5%'
async def main():
    cards=[c for c in json.loads((ROOT/'web/data/cards.json').read_text(encoding='utf8')) if c['kind']=='reading']
    feed=json.loads((ROOT/'content/reading.json').read_text(encoding='utf8'))
    sentences=list(dict.fromkeys(c['sentence'] for c in [*cards,*feed['cards']]))
    limit=int(os.environ.get('TTS_LIMIT','0'))
    if limit:sentences=sentences[:limit]
    out=ROOT/'content/audio';out.mkdir(exist_ok=True)
    clips=[];semaphore=asyncio.Semaphore(3)
    async def generate(sentence):
        key=hashlib.sha256((VOICE+'|'+RATE+'|'+sentence).encode()).hexdigest()[:20]
        path=out/f'reading-{key}.mp3'
        async with semaphore:
            if not path.exists():
                for attempt in range(3):
                    try:
                        await edge_tts.Communicate(sentence,VOICE,rate=RATE).save(str(path));break
                    except Exception:
                        path.unlink(missing_ok=True)
                        if attempt==2:raise
                        await asyncio.sleep(1+attempt*2)
            raw=path.read_bytes();duration=MP3(path).info.length
            item={'sentence':sentence,'voice':VOICE,'rate':RATE,'kind':'synthetic-reading','path':path.relative_to(ROOT).as_posix(),'url':f'https://ourbeings.com/ielts/recordings/{path.name}','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'duration':round(duration,6)}
            print(len(raw),path.name,flush=True);return item
    clips=await asyncio.gather(*(generate(s) for s in sentences))
    result={'schemaVersion':1,'kind':'synthetic-reading','voice':VOICE,'rate':RATE,'count':len(clips),'clips':clips}
    for dest in ['content/reading-audio-manifest.json','web/data/reading-audio.json']:(ROOT/dest).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print('COMPLETE',len(clips),'unique sentences,',sum(c['bytes'] for c in clips),'bytes',flush=True)
asyncio.run(main())
