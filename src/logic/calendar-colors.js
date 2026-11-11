/** Prioridade visual do planeamento; não exportar tokens nem conteúdos corporativos. */
export const CALENDAR_ROLES={
 profissional:{label:'Profissional',color:'#087F70',priority:0},
 academico:{label:'Académico',color:'#2563EB',priority:1},
 pessoal:{label:'Pessoal',color:'#8B5CF6',priority:2},
 outros:{label:'Outros',color:'#64748B',priority:3}
};
const isColor=s=>/^#[0-9a-fA-F]{6}$/.test(String(s||''));
export function calendarSourceKey(e){
 if(e?.fromIP)return 'local:ip';
 if(e?.fromMicrosoft)return 'microsoft:'+(e.sourceAccount||'')+':'+(e.calendarId||'primary');
 if(e?.fromGoogle)return 'google:'+(e.sourceAccount||'')+':'+(e.calendarId||'primary');
 return 'local:'+(e?.category||'outros');
}
export function suggestedRole(e){
 if(e?.fromIP||e?.fromMicrosoft||e?.category==='Trabalho')return 'profissional';
 const name=[e?.calendarName,e?.sourceAccount].filter(Boolean).join(' ').toLowerCase();
 if(/\b(ipl|escola|universidade|acad[eé]m|aula|curso|faculdade|exame|estudo|student)\b/i.test(name))return 'academico';
 if(/\b(trabalho|profissional|corporat|work|infraestruturas|empresa|servi[cç]o)\b/i.test(name))return 'profissional';
 return 'pessoal';
}
export function calendarPresentation(e,settings={}){
 const key=calendarSourceKey(e);
 const v=settings[key]||{};
 const role=CALENDAR_ROLES[v.role]?v.role:suggestedRole(e);
 const color=isColor(v.color)?v.color:CALENDAR_ROLES[role].color;
 return {key,role,color,label:CALENDAR_ROLES[role].label,priority:CALENDAR_ROLES[role].priority};
}
export function calendarChoices(googleCalendars=[],microsoftCalendars=[]){
 const list=[
   {id:'local:ip',label:'IP · Deslocações, prevenções e atividades',fromIP:true},
   ...googleCalendars.map(x=>({id:'google:'+(x.accountEmail||'')+':'+(x.id||'primary'),label:'Google · '+(x.accountEmail||'')+' · '+x.summary,fromGoogle:true,sourceAccount:x.accountEmail||'',calendarId:x.id||'primary',calendarName:x.summary})),
   ...microsoftCalendars.map(x=>({id:'microsoft:'+(x.accountEmail||'')+':'+(x.id||'primary'),label:'Outlook · '+x.summary,fromMicrosoft:true,sourceAccount:x.accountEmail||'',calendarId:x.id||'primary',calendarName:x.summary}))
 ];
 const seen=new Set();return list.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;});
}
export function loadCalendarColors(){
 try{const x=JSON.parse(localStorage.getItem('agenda-rjp-calendar-colors-v1')||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}catch{return {};}
}
export function saveCalendarColors(prefs){localStorage.setItem('agenda-rjp-calendar-colors-v1',JSON.stringify(prefs));}
export function prioritySort(a,b,settings={}){
 const pa=calendarPresentation(a,settings).priority,pb=calendarPresentation(b,settings).priority;
 return pa-pb||new Date(a.when)-new Date(b.when);
}
