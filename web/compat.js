// Small fallbacks for embedded browsers. Learning data contains plain JSON only.
export const cloneData = value => typeof globalThis.structuredClone === 'function' ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
export function uniqueId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes=new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for(let i=0;i<16;i++)bytes[i]=Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  return [...bytes].map((b,i)=>([4,6,8,10].includes(i)?'-':'')+b.toString(16).padStart(2,'0')).join('');
}
export function timeoutRequest(ms=8000) {
  if (typeof globalThis.AbortController !== 'function') return {signal:undefined,clear:()=>{}};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  return {signal:controller.signal,clear:()=>clearTimeout(timer)};
}
export function installDialogFallback() {
  for(const dialog of document.querySelectorAll('dialog')) {
    if(typeof dialog.showModal==='function')continue;
    Object.defineProperty(dialog,'open',{get:()=>dialog.hasAttribute('open')});
    dialog.showModal=()=>{dialog.setAttribute('open','');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.classList.add('dialog-fallback');dialog.querySelector('button,input,textarea')?.focus();};
    dialog.close=()=>{if(!dialog.open)return;dialog.removeAttribute('open');dialog.dispatchEvent(new Event('close'));};
    dialog.addEventListener('keydown',e=>{if(e.key==='Escape')dialog.close();});
  }
}
