"""Download real remote LFS samples, verifying bytes instead of pointer text."""
from pathlib import Path
import json,hashlib,urllib.request
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'MATERIALS.json').read_text(encoding='utf8'))
samples=[min((f for f in data['files'] if f['path'].lower().endswith(ext)),key=lambda f:f['bytes']) for ext in ['.mp3','.pdf','.jpg']]
results=[]
for f in samples:
    request=urllib.request.Request(f['downloadUrl'],headers={'User-Agent':'MyIELTS-material-verification'})
    with urllib.request.urlopen(request,timeout=120) as response:raw=response.read()
    digest=hashlib.sha256(raw).hexdigest()
    if len(raw)!=f['bytes'] or digest!=f['sha256']:raise RuntimeError('Remote contents mismatch: '+f['path'])
    results.append({'path':f['path'],'bytes':len(raw),'sha256':digest,'verified':True})
    print('PASS remote actual file:',f['path'],len(raw),'bytes',flush=True)
out=ROOT/'.test-artifacts/remote-material-verification.json';out.write_text(json.dumps({'catalogCount':data['count'],'totalBytes':data['totalBytes'],'samples':results},ensure_ascii=False,indent=2),encoding='utf8')
