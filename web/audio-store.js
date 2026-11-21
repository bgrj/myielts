const DB_NAME = 'myielts.userAudio.v1';
const STORE = 'clips';
const clipIndex = new Map();

export function clipNameKey(name) {
  return String(name || '').trim().split(/[/\\]/).pop().toLowerCase();
}

function idFromHash(buffer) {
  const hex = [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `file-${hex.slice(0, 16)}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开音频库'));
  });
}

function run(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || tx.error || new Error('音频读写失败'));
  });
}

export function clipForName(name) {
  return clipIndex.get(clipNameKey(name)) || null;
}

export async function loadClipIndex() {
  const db = await openDb();
  const rows = await run(db, 'readonly', store => store.getAll());
  clipIndex.clear();
  for (const row of rows || []) {
    const key = clipNameKey(row.name);
    const prev = clipIndex.get(key);
    if (!prev || (row.savedAt || 0) >= (prev.savedAt || 0)) clipIndex.set(key, { id: row.id, name: row.name, savedAt: row.savedAt || 0 });
  }
  db.close();
  return clipIndex;
}

export async function saveClip(file) {
  const name = clipNameKey(file.name);
  if (!name || (!String(file.type || '').startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|webm|flac)$/i.test(name))) throw new Error('请选择 mp3、m4a、wav 等音频文件');
  if (file.size > 30 * 1024 * 1024) throw new Error('单个音频请小于 30 MB');
  const bytes = await file.arrayBuffer();
  const id = idFromHash(await crypto.subtle.digest('SHA-256', bytes));
  const record = { id, name: file.name.split(/[/\\]/).pop(), type: file.type || 'audio/mpeg', blob: new Blob([bytes], { type: file.type || 'audio/mpeg' }), savedAt: Date.now() };
  const db = await openDb();
  await run(db, 'readwrite', store => store.put(record));
  db.close();
  clipIndex.set(name, { id: record.id, name: record.name, savedAt: record.savedAt });
  remembered.delete(id);
  return record;
}

const remembered = new Map();

export async function clipObjectUrl(id) {
  if (remembered.has(id)) return remembered.get(id);
  const db = await openDb();
  const row = await run(db, 'readonly', store => store.get(id));
  db.close();
  if (!row?.blob) return '';
  const url = URL.createObjectURL(row.blob);
  remembered.set(id, url);
  return url;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBytes(data) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function exportClips(ids) {
  const db = await openDb();
  const out = [];
  for (const id of ids) {
    const row = await run(db, 'readonly', store => store.get(id));
    if (!row?.blob) continue;
    const bytes = new Uint8Array(await row.blob.arrayBuffer());
    out.push({ id: row.id, name: row.name, type: row.type || 'audio/mpeg', data: bytesToBase64(bytes) });
  }
  db.close();
  return out;
}

export async function restoreClips(list) {
  if (!Array.isArray(list) || !list.length) return 0;
  const db = await openDb();
  let restored = 0;
  for (const item of list) {
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.data !== 'string' || item.data.length > 42 * 1024 * 1024) continue;
    let bytes;
    try { bytes = base64ToBytes(item.data); } catch { continue; }
    const id = idFromHash(await crypto.subtle.digest('SHA-256', bytes));
    if (id !== item.id) continue;
    const type = typeof item.type === 'string' && item.type.startsWith('audio/') ? item.type : 'audio/mpeg';
    await run(db, 'readwrite', store => store.put({ id, name: item.name.split(/[/\\]/).pop(), type, blob: new Blob([bytes], { type }), savedAt: Date.now() }));
    remembered.delete(id);
    restored++;
  }
  db.close();
  await loadClipIndex();
  return restored;
}
