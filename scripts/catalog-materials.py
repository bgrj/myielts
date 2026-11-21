"""Inventory user-requested complete materials with hashes and LFS download URLs."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
MATERIAL_ROOT = ROOT / '剑桥雅思真题1-20【真题＋新方法解析＋音频】'
paths = sorted(p for p in MATERIAL_ROOT.rglob('*') if p.is_file())

def inspect(path):
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    relative = path.relative_to(ROOT).as_posix()
    return {'path': relative, 'bytes': path.stat().st_size, 'sha256': digest,
            'extension': path.suffix.lower(),
            'downloadUrl': 'https://media.githubusercontent.com/media/bgrj/myielts/main/' + quote(relative, safe='/')}

items = []
with ThreadPoolExecutor(max_workers=4) as pool:
    for count, item in enumerate(pool.map(inspect, paths), 1):
        items.append(item)
        if count % 50 == 0: print(f'Hashed {count}/{len(paths)} materials', flush=True)
manifest = {'schemaVersion': 1, 'root': MATERIAL_ROOT.name, 'generatedAt': datetime.now(timezone.utc).isoformat(),
            'count': len(items), 'totalBytes': sum(item['bytes'] for item in items),
            'storage': 'Git LFS', 'files': items}
(ROOT / 'MATERIALS.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Cataloged {len(items)} files, {manifest["totalBytes"]} bytes', flush=True)
