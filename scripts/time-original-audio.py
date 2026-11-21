"""Get offline word timings. Canonical sentences come from the user's source PDFs."""
from pathlib import Path
import os,sys,json,subprocess
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.test-artifacts/media-tools'))
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1'
os.environ['HF_HUB_DISABLE_XET']='1'
from faster_whisper import WhisperModel
import numpy as np
import imageio_ffmpeg
model=WhisperModel('base.en',device='cpu',compute_type='int8',cpu_threads=8,download_root=str(ROOT/'.test-artifacts/whisper-models'))
data=json.loads((ROOT/'content/listening-source-transcripts.json').read_text(encoding='utf8'))
for lesson in data['lessons']:
    out=ROOT/f".test-artifacts/{lesson['id']}-timings.json"
    if out.exists():continue
    decoded=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(ROOT/lesson['sourceAudio']),'-f','s16le','-ar','16000','-ac','1','-'],capture_output=True,check=True).stdout
    waveform=np.frombuffer(decoded,np.int16).astype(np.float32)/32768
    segments,info=model.transcribe(waveform,language='en',word_timestamps=True,beam_size=5,vad_filter=True)
    records=[]
    for seg in segments:
        records.append({'start':seg.start,'end':seg.end,'text':seg.text,'words':[{'word':w.word,'start':w.start,'end':w.end,'probability':w.probability} for w in seg.words]})
        print(lesson['id'],round(seg.end),seg.text,flush=True)
    out.write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
