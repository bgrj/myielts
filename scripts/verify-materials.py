"""Verify every staged material is an LFS pointer matching the complete catalog."""
from pathlib import Path
import json
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'MATERIALS.json').read_text(encoding='utf8'))
expected={item['path']:item for item in manifest['files']}
git=['git','-c','safe.directory='+ROOT.as_posix()]
index=subprocess.run(git+['ls-files','--stage','-z','--',manifest['root']],cwd=ROOT,capture_output=True,check=True).stdout
entries=[]
for entry in index.split(b'\0'):
    if not entry: continue
    header,path=entry.split(b'\t',1)
    mode,oid,stage=header.decode().split()
    if stage!='0': raise RuntimeError('Unmerged material: '+path.decode('utf8'))
    entries.append((path.decode('utf8'),oid))
if set(path for path,_ in entries)!=set(expected): raise RuntimeError('Staged file list does not match full catalog')
objects=subprocess.run(git+['cat-file','--batch'],cwd=ROOT,input=('\n'.join(oid for _,oid in entries)+'\n').encode(),capture_output=True,check=True).stdout
offset=0
for path,oid in entries:
    end=objects.index(b'\n',offset)
    header=objects[offset:end].decode().split()
    size=int(header[2]);content=objects[end+1:end+1+size].decode('ascii')
    offset=end+1+size+1
    match=re.fullmatch(r'version https://git-lfs.github.com/spec/v1\noid sha256:([a-f0-9]{64})\nsize (\d+)\n',content)
    if not match or match[1]!=expected[path]['sha256'] or int(match[2])!=expected[path]['bytes']:
        raise RuntimeError('LFS pointer mismatch: '+path)
print(f'PASS: {len(entries)} complete material files indexed as LFS, all sizes and SHA-256 match the catalog.')
