"""One-time extraction of user-supplied local PDFs. Requires pymupdf, not needed to run site."""
from pathlib import Path
import json
import re
import unicodedata
from difflib import SequenceMatcher
import pymupdf

ROOT = Path(__file__).resolve().parents[1]

def clean(s):
    s = unicodedata.normalize('NFKC', s).replace('\xad', '-').replace('\x07', '')
    return re.sub(r'\s+', ' ', s).strip()

def lines_of(p):
    doc = pymupdf.open(p)
    lines = []
    headers = set()
    for page in list(doc)[1:]:
        first = [clean(x) for x in page.get_text().splitlines() if clean(x)]
        if first and first[0] == '词汇与固定搭配学习稿':
            headers.update(first[:3])
    for page in doc:
        for line in page.get_text().splitlines():
            line = clean(line)
            if not line or line in headers or line.startswith(('个人学习稿', '欢迎 私信')) or re.fullmatch(r'\d+ / \d+', line):
                continue
            m = re.match(r'^(\d{1,3}\.)\s+(.+)$', line)
            lines.extend(m.groups() if m else [line])
    return lines

def tokens(s):
    return re.findall(r"[a-z]+", s.lower())

def original_sentences(p, passage):
    doc = pymupdf.open(p)
    content = []
    for page in list(doc)[1:3]:
        ls = page.get_text().splitlines()
        ls = [x for x in ls if not x.startswith('个人练习稿') and not re.fullmatch(r'\s*(Reading|Test 1|\d+|[A-G])\s*', x)]
        content.append('\n'.join(ls))
    text = clean(' '.join(content))
    start = 'In the first half' if passage == 1 else 'Stadiums are among'
    text = text[text.index(start):]
    if passage == 2:
        text = re.sub(r'\* amphitheatre:.*?Many such stadiums', 'Many such stadiums', text)
        text = re.sub(r'seats for spectators, for the presentation of dramatic or sporting events', '', text)
    return [clean(s).replace('amphitheatre*', 'amphitheatre') for s in re.split(r'(?<=[.!?])\s+(?=[A-Z‘])', text) if len(s) > 15]

STOP = set('a an the of to in on for and or with be sth adj n v phr pattern at as by that this its is are were was from it'.split())

def match_sentence(target, example, sentences):
    tt = set(tokens(target)) - STOP
    def score(s):
        st = set(tokens(s))
        overlap = len(tt & st) / max(1, len(tt))
        similarity = SequenceMatcher(None, example.lower(), s.lower()).ratio()
        exact = clean(target).lower().replace('…', '') in s.lower()
        return overlap * 2 + similarity + (0.7 if exact else 0)
    return max(sentences, key=score)

def focus_for(target, example, sentence):
    # Select an actual contiguous span, never a generated phrase, for cloze tests.
    raw = re.sub(r'\s*\([^)]*\)', '', target)
    if len(raw) > 2 and raw.lower() in sentence.lower():
        i = sentence.lower().index(raw.lower())
        return sentence[i:i+len(raw)]
    useful = [x for x in re.findall(r"[A-Za-z]+(?:[-’'][A-Za-z]+)*", target) if x.lower() not in STOP]
    for word in sorted(useful, key=len, reverse=True):
        m = re.search(r'\b' + re.escape(word) + r'\w*\b', sentence, re.I)
        if m:
            return m.group()
    blocks = SequenceMatcher(None, example.lower(), sentence.lower()).get_matching_blocks()
    block = max(blocks, key=lambda b: b.size)
    span = sentence[block.b:block.b+block.size].strip(' ,.;')
    return span if len(span) > 2 else re.findall(r'[A-Za-z]{5,}', sentence)[0]

cards = []
audit = []
for passage in (1, 2):
    folder = ROOT / '雅思阅读' / '01-历史与城市发展'
    notes = next(folder.glob(f'C17-Test1-Passage{passage}*词汇*.pdf'))
    original = next(folder.glob(f'C17-Test1-Passage{passage}*练习.pdf'))
    sentences = original_sentences(original, passage)
    ls = lines_of(notes)
    ls = ls[:ls.index('自测清单')]
    starts = [(i, int(x[:-1])) for i, x in enumerate(ls) if re.fullmatch(r'\d{1,3}\.', x)]
    for k, (start, number) in enumerate(starts):
        end = starts[k+1][0] if k+1 < len(starts) else len(ls)
        block = ls[start+1:end]
        if '义' not in block or '例' not in block:
            continue
        fields = {}
        current = 'head'
        for line in block:
            if line in ('义', '搭配', '例', '用法', '相关'):
                current = line
            elif line.startswith(('词汇与固定搭配学习稿', '错题复盘', '补充条目')) or (' / ' in line and re.search(r'\d+ / \d+', line)):
                continue
            else:
                fields.setdefault(current, []).append(line)
        head = fields['head']
        target = head[0]
        # Two-line long expressions are followed by part of speech.
        if len(head) > 2 and not re.match(r'^(n\.|v\.|adj\.|adv\.|prep\.|pattern)', head[1]):
            target += ' ' + head[1]
        example = clean(' '.join(fields.get('例', [])))
        sentence = match_sentence(target, example, sentences)
        note = clean(' '.join(fields.get('用法', [])))
        # The last entry may be followed by the error-analysis appendix.
        if passage == 2 and number == 126:
            note = note.split('第 15 题')[0].split('错题复盘')[0]
        card = {
            'id': f'c17-t1-p{passage}-{number:03}', 'kind': 'reading',
            'target': target, 'meaning': clean(' '.join(fields.get('义', []))),
            'sentence': sentence, 'focus': focus_for(target, example, sentence),
            'translation': '', 'ipa': '', 'note': note,
            'collocations': clean(' '.join(fields.get('搭配', []))),
            'related': clean(' '.join(fields.get('相关', []))),
            'source': f'剑雅 17 · Test 1 · Passage {passage}',
            'title': '伦敦地下铁路的发展' if passage == 1 else '体育场的过去、现在与未来',
            'originalRef': f'C17 T1 P{passage} · 笔记第 {number} 条',
            'tags': ['词汇', '搭配'], 'origin': '本地学习笔记',
        }
        cards.append(card)
        audit.append(f"{card['id']} | {target} | {sentence}")

folder = ROOT / '雅思听力' / '雅思情景练习' / '01-旅行自驾游预订'
notes = next(folder.glob('*发音*目录.pdf'))
ls = lines_of(notes)
text = '\n'.join(ls)
text = text[text.index('逐句说明'):]
blocks = re.split(r'(?m)^(\d{2})\s+([^\n]+)\n', text)
for i in range(1, len(blocks), 3):
    number, speaker, body = blocks[i:i+3]
    m = re.search(r'原文[:：](.*?)(?=截取说明[:：]|为什么容易听不清[:：])', body, re.S)
    if not m:
        continue
    sentence = clean(m.group(1))
    note = clean(body.split('为什么容易听不清：', 1)[-1])
    correction = re.search(r'截取说明[:：](.*?)(?=为什么容易听不清[:：])', body, re.S)
    stamp = re.search(r'拼接位置[:：](.*?)起', body)
    focus = re.search(r'[A-Za-z]+(?:[-’\'][A-Za-z]+)*(?: [A-Za-z]+)?\s*/[^/]+/', note)
    target = focus.group().split('/')[0].strip() if focus else sentence
    cards.append({
        'id': f'c10-t1-s1-{number}', 'kind': 'listening', 'target': target,
        'meaning': '', 'sentence': sentence, 'focus': focus_for(target, sentence, sentence),
        'translation': '', 'ipa': '', 'note': note,
        'collocations': '', 'related': '',
        'source': '剑雅 10 · Test 1 · Section 1', 'title': '旅行自驾游预订',
        'originalRef': f'C10 T1 S1 · 难点第 {number} 句' + (f' · 拼接 {stamp.group(1)}' if stamp else ''),
        'tags': ['发音', '精听'], 'origin': '本地发音障碍笔记',
        'personalError': clean(correction.group(1)) if correction else '',
        'fragment': True,
    })

output = ROOT / 'web' / 'data'
output.mkdir(parents=True, exist_ok=True)
(output / 'cards.json').write_text(json.dumps(cards, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
audit_path = ROOT / '.test-artifacts'
audit_path.mkdir(exist_ok=True)
(audit_path / 'sentence-audit.txt').write_text('\n'.join(audit), encoding='utf-8')
print(f'Extracted {len(cards)} cards: reading={sum(c["kind"]=="reading" for c in cards)}, listening={sum(c["kind"]=="listening" for c in cards)}')
