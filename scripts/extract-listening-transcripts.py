"""Extract full bilingual source transcripts for the two requested listening scenarios."""
from pathlib import Path
import json,re,unicodedata
import pymupdf

ROOT=Path(__file__).resolve().parents[1]
scenarios=[('self-drive','自驾游预订','01-旅行自驾游预订',1),('leisure-club','健身俱乐部','16-休闲健身会所介绍',2)]
lessons=[]
for lesson_id,title,folder_name,section in scenarios:
    folder=ROOT/'雅思听力/雅思情景练习'/folder_name
    pdf=next(folder.glob('*学生*.pdf'))
    audio=next(p for p in folder.glob('*听力.mp3') if '拼接' not in p.name)
    raw=unicodedata.normalize('NFKC','\n'.join(page.get_text() for page in pymupdf.open(pdf)))
    raw=raw[raw.index('3 全文'):raw.index('4 Language Focus')]
    lines=[]
    for line in raw.splitlines():
        line=re.sub(r'\s+',' ',line).strip()
        if not line or line.startswith(('欢迎','Scenario ')) or re.fullmatch(r'\d+ / \d+',line):continue
        lines.append(line)
    turns=[];current=None;group='announcer'
    for line in lines:
        if '示例播放' in line: group='example';continue
        if line.startswith('▶'):
            if '正式' in line:group='main'
            continue
        match=re.match(r'^(A\d{2}|\d{2}[a-z]?)\s+(ANNOUNCER|TRAVEL AGENT|ANDREA|SANDY):\s*(.*)$',line)
        if match:
            key,speaker,text=match.groups()
            current={'key':key,'speaker':speaker,'group':'announcer' if speaker=='ANNOUNCER' else group,'text':text,'translation':''}
            turns.append(current);continue
        if current is None or line.startswith(('(', '音频在','本部分','Full transcript')):continue
        if re.search(r'[\u4e00-\u9fff。！？]',line) or current['translation']:
            current['translation']+=line
        else:current['text']+=' '+line
    # The source handout repeats the price question across the Q1-6/Q7-10 layout boundary.
    if lesson_id=='self-drive':
        repeated=next(t['text'] for t in turns if t['key']=='34b')
        for turn in turns:
            if turn['key']=='34' and turn['text'].endswith(repeated):turn['text']=turn['text'][:-len(repeated)].strip()
    sentences=[]
    for turn in turns:
        text=turn['text'].replace('\xad','-')
        parts=re.split(r'(?<=[.!?])\s+(?=[A-Z])',text)
        cn=[p for p in re.split(r'(?<=[。！？])',turn['translation']) if p.strip()]
        for i,part in enumerate(parts):
            sentence={'id':f'c10-t1-s{section}-sentence-{len(sentences)+1:03}','lessonId':lesson_id,'order':len(sentences)+1,'speaker':turn['speaker'],'sectionGroup':turn['group'],'sentence':part.strip(),'translation':cn[i] if len(cn)==len(parts) else turn['translation'],'translationContext':'' if len(cn)==len(parts) or len(parts)==1 else '同一说话轮的完整译文','sourceTurn':turn['key']}
            sentences.append(sentence)
    lesson={'id':lesson_id,'title':title,'source':f'剑雅 10 · Test 1 · Section {section}','section':section,'sourcePdf':pdf.relative_to(ROOT).as_posix(),'sourceAudio':audio.relative_to(ROOT).as_posix(),'sentences':sentences}
    lessons.append(lesson)
    print(f'{title}: {len(turns)} source turns, {len(sentences)} ordered sentences')
out=ROOT/'content/listening-source-transcripts.json'
out.write_text(json.dumps({'schemaVersion':1,'lessons':lessons},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
