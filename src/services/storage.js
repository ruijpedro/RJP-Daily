import {makeBackup,parseBackupText,readJsonText} from '../logic/backup.js';
import {saveJsonFile} from './backup-file.js';
const KEY='rjp-daily-items-v1';
export function loadItems(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[];}catch{return [];}}
export function saveItems(items){localStorage.setItem(KEY,JSON.stringify(items));}
export async function downloadBackup(items,ip){
 const backup=makeBackup(items,ip);
 return saveJsonFile('Agenda-RJP-'+(ip?'Completo-':'')+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(backup,null,2));
}
export async function readBackup(file){
 const data=parseBackupText(await readJsonText(file));
 if(!data.items)throw new Error('O ficheiro não contém registos de agenda.');
 return data.items;
}
