// Formatos antigos e completo. Sem credenciais OAuth nem eventos remotos.
export function parseBackupText(text){
 let p;
 try{p=JSON.parse(String(text).replace(/^\uFEFF/,'').trim());}catch{throw new Error('JSON inválido ou incompleto. Seleciona um ficheiro de backup original.');}
 if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Formato de backup inválido.');
 const known=['RJP Daily','Agenda RJP','IP_RJP'].includes(p.app);
 const items=known&&Array.isArray(p.items)?p.items:null;
 const candidate=p.ip??p;
 const ip=Array.isArray(candidate?.trips)&&Array.isArray(candidate?.guards)&&Array.isArray(candidate?.activities)?candidate:null;
 if(!items&&!ip)throw new Error('Este ficheiro não é uma cópia da Agenda RJP ou IP_RJP.');
 if(items&&items.some(i=>!i||typeof i.id!=='string'||typeof i.title!=='string'||!['nota','tarefa','evento'].includes(i.kind)))throw new Error('O backup contém registos de agenda inválidos. Não foi importado.');
 if(ip){
   for(const key of ['trips','guards','activities']){
     if(ip[key].some(x=>!x||typeof x.date!=='string'||(key==='guards'&&!['BT','CC'].includes(x.kind))))throw new Error('O backup contém registos profissionais inválidos. Não foi importado.');
   }
 }
 return {items,ip};
}
export async function readJsonText(file){
 if(!file)throw new Error('Nenhum ficheiro selecionado.');
 if(typeof file.text==='function'){try{return await file.text();}catch{}}
 if(typeof FileReader==='undefined')throw new Error('Não foi possível ler o ficheiro.');
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Não foi possível ler o ficheiro. Usa a opção Colar JSON.'));reader.readAsText(file,'UTF-8');});
}
export function makeBackup(items,ip){
 return {app:'Agenda RJP',version:3,exportedAt:new Date().toISOString(),items,...(ip?{ip}:{})};
}
export function mergeById(existing,incoming){
 const map=new Map(existing.map(x=>[x.id,x]));
 for(const x of incoming)map.set(x.id,x);
 return [...map.values()];
}
