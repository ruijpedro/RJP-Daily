/** Dados profissionais baseados na estrutura do projeto IP_RJP (versão 2.5). */
import { parsePtCommand } from '../logic/parse.js';
export const IP_KEY='rjp-daily-ip-v2';
export const defaults={
  profile:{appName:'RJP Daily',professionalModule:'IP_RJP',author:'Rui Jorge Pedro',organization:'Infraestruturas de Portugal'},
  vehicles:[
   {id:'v-03-zq-46',plate:'03-ZQ-46',brand:'Fiat',model:'',color:'Branco',type:'Viatura de serviço',active:true,favorite:true},
   {id:'v-23-zp-64',plate:'23-ZP-64',brand:'Renault',model:'Kangoo',color:'Branco',type:'Viatura de serviço',active:true,favorite:true},
   {id:'v-87-hn-72',plate:'87-HN-72',brand:'Mitsubishi',model:'L200 DI-D',color:'Branco',type:'Pick-up de serviço',active:true,favorite:true}
  ],
  places:['Caldas da Rainha','Leiria','Marinha Grande','São Martinho do Porto','Óbidos','Bombarral','Torres Vedras','Mafra','Sabugo','Coimbra','Entroncamento','Guarda'],
  activityTypes:['Inspeção de edifício','Inspeção AMV','Visita de obra','Reunião','Formação','Levantamento','Trabalho administrativo','Outro'],
  defaultVehiclePlate:'03-ZQ-46',
  vehiclesCatalogVersion:1,
  trips:[],guards:[],activities:[]
};
export const localDay=(value=new Date())=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export const clone=()=>JSON.parse(JSON.stringify(defaults));
export function normalizeIP(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Estrutura profissional inválida.');
 const base=clone();
 return {
  ...base,
  profile:{...base.profile,...(raw.profile&&typeof raw.profile==='object'?raw.profile:{})},
  // Na primeira abertura após atualização, repõe apenas as viaturas históricas em falta.
  // Depois dessa migração, remoções/edições voluntárias continuam respeitadas.
  vehicles:completeVehicleCatalog(raw,base),
  vehiclesCatalogVersion:1,
  // Guardar a preferência sem apagar matrículas de deslocações antigas.
  defaultVehiclePlate:typeof raw.defaultVehiclePlate==='string'?raw.defaultVehiclePlate:base.defaultVehiclePlate,
  places:Array.isArray(raw.places)?raw.places.filter(x=>typeof x==='string'):base.places,
  activityTypes:Array.isArray(raw.activityTypes)?raw.activityTypes.filter(x=>typeof x==='string'):base.activityTypes,
  trips:Array.isArray(raw.trips)?raw.trips.filter(x=>x&&typeof x.date==='string').map(x=>({...x,id:x.id||newId()})):[],
  guards:Array.isArray(raw.guards)?raw.guards.filter(x=>x&&typeof x.date==='string'&&['BT','CC'].includes(x.kind)).map(x=>({...x,id:x.id||newId()})):[],
  activities:Array.isArray(raw.activities)?raw.activities.filter(x=>x&&typeof x.date==='string').map(x=>({...x,id:x.id||newId()})):[],
 };
}

export const vehicleKey=(plate)=>String(plate||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
/** Introduz uma única vez as 3 matrículas IP_RJP sem duplicar nem apagar outras viaturas. */
export function completeVehicleCatalog(raw,base=clone()){
 const vehicles=Array.isArray(raw?.vehicles)?raw.vehicles.filter(x=>x?.plate).map(x=>({...x,id:x.id||newId()})):base.vehicles;
 if(raw?.vehiclesCatalogVersion===1)return vehicles;
 const result=[...vehicles];
 const known=new Set(vehicles.map(v=>vehicleKey(v.plate)));
 for(const v of base.vehicles){if(!known.has(vehicleKey(v.plate))){result.push({...v});known.add(vehicleKey(v.plate));}}
 return result;
}
export function getDefaultVehiclePlate(data){
 const active=(data?.vehicles||[]).filter(v=>v?.plate&&v.active!==false);
 const preferred=active.find(v=>v.plate===data?.defaultVehiclePlate);
 return preferred?.plate||active[0]?.plate||'';
}
export const newId=()=>globalThis.crypto?.randomUUID?.()||`ip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function loadIP(){try{const saved=localStorage.getItem(IP_KEY);return saved?normalizeIP(JSON.parse(saved)):clone()}catch{return clone()}}
export function saveIP(data){localStorage.setItem(IP_KEY,JSON.stringify(data));}
export function asIPBackup(data){return {app:'RJP Daily',module:'IP_RJP',version:2,exportedAt:new Date().toISOString(),ip:normalizeIP(data)};}
export async function importIPBackup(file){
 const input=JSON.parse(await file.text());
 // Compatibilidade com exportações e backups da antiga IP_RJP, que guardavam os dados diretamente.
 let value=input?.module==='IP_RJP'?input.ip:input?.ip??input;
 if(!value || !Array.isArray(value.trips) || !Array.isArray(value.guards) || !Array.isArray(value.activities))throw new Error('Este ficheiro não contém um backup válido da IP_RJP.');
 return normalizeIP(value);
}
export function durationMinutes(start,end){
 if(!/^\d{2}:\d{2}$/.test(start||'')||!/^\d{2}:\d{2}$/.test(end||''))return 0;
 const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);
 if(sh>23||eh>23||sm>59||em>59)return 0;
 return ((eh*60+em)-(sh*60+sm)+1440)%1440;
}
export const minsText=mins=>`${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}`;
export function makeProfessionalAgenda(data){
 const output=[];
 for(const [collection,records] of [['trips',data.trips],['guards',data.guards],['activities',data.activities]]){
  for(const r of records){
   const time=collection==='trips'?r.out:collection==='guards'?(r.start||'09:00'):(r.start||'09:00');
   const label=collection==='trips'?`Deslocação: ${r.from||'Origem'} → ${r.to||'Destino'}`:collection==='guards'?`Prevenção ${r.kind}`:`${r.type||'Atividade'} · ${r.place||''}`;
   const hasTime=/^\d{2}:\d{2}$/.test(time)&&!(collection==='guards'&&!r.start);
   const dateTime=hasTime?`${r.date}T${time}`:r.date;
   if(Number.isNaN(new Date(dateTime).getTime()))continue;
   output.push({id:`ip:${collection}:${r.id}`,linkedId:r.id,linkedType:collection,fromIP:true,kind:'evento',title:label,details:r.notes||r.activity||'',category:'Trabalho',when:dateTime,allDay:!hasTime,done:false});
  }
 }
 return output;
}
function removeTail(s){return s.replace(/\b(?:amanh[ãa]|hoje|depois de amanh[ãa])\b.*$/i,'').replace(/\b(?:na|no|de|para)\s+(?:pr[oó]xima?\s+)?(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?\b.*$/i,'').replace(/\b(?:[àa]s?|pelas?)\s+\d{1,2}(?:[:h]\d{1,2})?(?:\s+horas?)?.*$/i,'').trim().replace(/[,.]+$/,'').trim()}
/** Reconhece comandos profissionais. Só pré-preenche formulários, nunca guarda sem confirmação. */
export function parseIPVoice(sentence,reference=new Date()){
 const src=String(sentence||'').trim(), s=src.toLocaleLowerCase('pt-PT');
 const parsedCommand=parsePtCommand(src,reference);
 const date=parsedCommand.when?.slice(0,10)||localDay(reference);
 const reminder=/\b(?:lembra-me|lembrar-me|avisa-me|notifica-me)\b/i.test(s)?(parsedCommand.when||''):'';
 if(/\b(desloca[cç][aã]o|deslocar[- ]?me|viagem de servi[cç]o)\b/i.test(s)){
  const route=src.match(/(?:^|\s)de\s+(.+?)\s+para\s+(.+?)(?=\s+(?:amanh[ãa]|hoje|depois\s+de\s+amanh[ãa]|[àa]s?\s+\d|com\s+(?:a\s+)?viatura|de\s+matr[ií]cula|na\s+(?:pr[oó]xima?\s+)?(?:segunda|ter[cç]a|quarta|quinta|sexta))|[,.!?]|$)/i);
  const plate=src.match(/\b(?:matr[ií]cula|viatura)\s+(?:de\s+matr[ií]cula\s+)?([0-9A-Z]{2}[- ]?[0-9A-Z]{2}[- ]?[0-9A-Z]{2})\b/i);
  return {type:'trips',form:{date,from:removeTail(route?.[1]||''),to:removeTail(route?.[2]||''),vehiclePlate:plate?.[1]?.replaceAll(' ','-').toUpperCase()||'',out:parsedCommand.when&&!parsedCommand.suggestedHour?parsedCommand.when.slice(11,16):'',in:'',activity:'',notes:'',reminderAt:reminder},original:src};
 }
 if(/\bpreven[cç][aã]o\b/i.test(s)){
  const kind=src.match(/\b(BT|CC)\b/i)?.[1]?.toUpperCase()||'BT';
  return {type:'guards',form:{date,kind,notes:'',start:'',end:'',reminderAt:reminder},original:src};
 }
 if(/\b(regista(?:r)?|marca(?:r)?|adiciona(?:r)?)\s+(?:uma\s+)?(?:atividade|inspe[cç][aã]o|visita de obra|levantamento)\b/i.test(s)){
  return {type:'activities',form:{date,start:parsedCommand.when&&!parsedCommand.suggestedHour?parsedCommand.when.slice(11,16):'',end:'',type:/inspe[cç][aã]o/i.test(s)?'Inspeção de edifício':/visita\s+de\s+obra/i.test(s)?'Visita de obra':'Outro',place:'',notes:src,reminderAt:reminder},original:src};
 }
 return null;
}
