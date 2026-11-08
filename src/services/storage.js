const KEY='rjp-daily-items-v1';
export function loadItems() {
 try { const x=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(x)?x:[]; }
 catch {return []}
}
export function saveItems(items) { localStorage.setItem(KEY,JSON.stringify(items)); }
export function downloadBackup(items) {
 const blob = new Blob([JSON.stringify({app:'RJP Daily',version:1,exportedAt:new Date().toISOString(),items},null,2)],{type:'application/json'});
 const a=document.createElement('a'); const url=URL.createObjectURL(blob);
 a.href=url; a.download=`RJP-Daily-backup-${new Date().toISOString().slice(0,10)}.json`;
 document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000);
}
export async function readBackup(file) {
 const p=JSON.parse(await file.text());
 if (!p || p.app!=='RJP Daily' || !Array.isArray(p.items)) throw new Error('Ficheiro de cópia de segurança inválido.');
 return p.items.filter(i=>i && typeof i.id==='string' && typeof i.title==='string' && ['nota','tarefa','evento'].includes(i.kind));
}
