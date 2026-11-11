import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import {googleEventPayload,normalizeGoogleEvents,visibleGoogleCalendars} from '../logic/google-events.js';
import {safeCalendarName} from '../logic/calendar-view.js';
import {stableGoogleId} from '../logic/google-sync.js';

// A app só necessita de ler/criar/editar eventos, não gerir calendários nem partilhas.
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CALENDAR_LIST_SCOPE = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';
export const GOOGLE_CALENDAR_SCOPE = CALENDAR_SCOPE;
let initializedClient = null;
let initialization = null;
/** Metadados públicos (email/rotulo) são guardados. Tokens Google ficam só em memória. */
const GOOGLE_ACCOUNTS_KEY='agenda-rjp-google-accounts-v1';
const sessions=new Map();
const emailKey=v=>String(v||'').trim().toLowerCase();
let knownAccounts=[];
try{
 const rows=JSON.parse(localStorage.getItem(GOOGLE_ACCOUNTS_KEY)||'[]');
 if(Array.isArray(rows))knownAccounts=rows.filter(x=>x&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email)).slice(0,20)
    .map(x=>({email:emailKey(x.email),name:String(x.name||x.email).slice(0,160),primary:Boolean(x.primary)}));
}catch{}
const storeAccounts=()=>{try{localStorage.setItem(GOOGLE_ACCOUNTS_KEY,JSON.stringify(knownAccounts));}catch{}};
const primaryEmail=()=>knownAccounts.find(x=>x.primary)?.email||'';
export function getGoogleAccounts(){return knownAccounts.map(x=>({...x,connected:sessions.has(x.email)}));}
export const hasGoogleSessions=()=>sessions.size>0;
export const primaryGoogleEmail=()=>primaryEmail();
export function setPrimaryGoogleAccount(email){
 const key=emailKey(email);
 if(!sessions.has(key))throw new Error('Autoriza esta conta Google antes de a definir como principal.');
 knownAccounts=knownAccounts.map(x=>({...x,primary:x.email===key}));
 storeAccounts();
 return getGoogleAccounts();
}
export function removeGoogleAccount(email){
 const key=emailKey(email);
 if(!knownAccounts.some(x=>x.email===key))return getGoogleAccounts();
 sessions.delete(key);
 knownAccounts=knownAccounts.filter(x=>x.email!==key);
 // Não escolher outra conta automaticamente para escrita.
 storeAccounts();
 return getGoogleAccounts();
}


const clientIsValid = id => /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(String(id||'').trim());

async function initialize(clientId) {
  const id=String(clientId||'').trim();
  if(!clientIsValid(id))throw new Error('Indica o Client ID Web completo, terminado em .apps.googleusercontent.com.');
  if(initializedClient===id)return;
  if(initialization)return initialization;
  initialization=SocialLogin.initialize({google:{webClientId:id,mode:'online'}})
    .then(()=>{initializedClient=id})
    .finally(()=>{initialization=null});
  return initialization;
}

function credentials(result){
 const x=result?.result||result;
 const token=typeof x?.accessToken==='string'?x.accessToken:x?.accessToken?.token;
 const email=emailKey(x?.profile?.email);
 if(!token)throw new Error('O Google não concedeu acesso ao Calendar.');
 if(!email)throw new Error('O Google não identificou o email. Confirma a permissão de perfil e volta a ligar a conta.');
 return {token,email,name:String(x?.profile?.name||email).slice(0,160)};
}
/** Ligação interativa; o selecionador Google pode abrir outra conta sem apagar as anteriores. */
export async function connectGoogle(clientId) {
 await initialize(clientId);
 const answer=await SocialLogin.login({provider:'google',options:{
   scopes:['email','profile',CALENDAR_SCOPE,CALENDAR_LIST_SCOPE],
   filterByAuthorizedAccounts:false,autoSelectEnabled:false,
   style:'standard',prompt:'select_account'
 }});
 const value=credentials(answer);
 sessions.set(value.email,{token:value.token});
 if(!knownAccounts.some(x=>x.email===value.email)){
   knownAccounts.push({email:value.email,name:value.name,primary:!knownAccounts.some(x=>x.primary)});
 }else{
   knownAccounts=knownAccounts.map(x=>x.email===value.email?{...x,name:value.name}:x);
 }
 storeAccounts();
 return {name:value.email,email:value.email,accounts:getGoogleAccounts()};
}

/** O plugin v8 devolve void em refresh(); logo, não fornece um novo
 * accessToken ao JS numa restauração silenciosa. Não afirmar ligação falsa.
 * O novo token é solicitado através do botão de autorização do utilizador. */
export async function restoreGoogleSession(clientId){
  if(!Capacitor.isNativePlatform() || !clientId || !clientIsValid(clientId))return null;
  try {
    await initialize(clientId);
    // O estado nativo pode estar válido, mas não prova acesso ao Calendar.
    await SocialLogin.isLoggedIn({provider:'google'});
  }catch{}
  return null;
}

/** Desligar todas: apaga os perfis e as sessões da app, sem tocar nos calendários remotos. */
export async function disconnectGoogle(){
 try{await SocialLogin.logout({provider:'google'})}catch{}
 sessions.clear();knownAccounts=[];storeAccounts();
}
export function googleConnected(){return Boolean(sessions.has(primaryEmail()));}
export function googleProfile(){return knownAccounts.find(x=>x.primary)?.email||'';}
/** Um pedido nunca muda automaticamente para outra conta quando a principal expirou. */
async function request(path,options={},forEmail=primaryEmail()){
 const email=emailKey(forEmail),session=sessions.get(email);
 if(!session)throw new Error(email?'A conta '+email+' precisa de nova autorização Google.':'Escolhe e autoriza uma conta Google principal.');
 const response=await fetch('https://www.googleapis.com/calendar/v3'+path,{
   ...options,
   headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json',...options.headers}
 });
 if(response.status===401){
   sessions.delete(email);
   throw new Error('Autorização da conta '+email+' expirou. Volta a ligar essa conta.');
 }
 if(!response.ok){
   let err={};try{err=await response.json()}catch{}
   if(response.status===403)throw new Error('Google Calendar recusou o acesso da conta '+email+'. Confirma as permissões da conta e a Calendar API.');
   const problem=new Error(err?.error?.message||'Erro Google Calendar '+response.status);
   problem.status=response.status;throw problem;
 }
 return response.status===204?null:response.json();
}

export async function upsertGoogle(item){
  const calendarId=encodeURIComponent(item.googleCalendarId||'primary');
  const base='/calendars/'+calendarId+'/events';
  const payload=googleEventPayload(item);
  if(item.googleEventId){
    const event=await request(base+'/'+encodeURIComponent(item.googleEventId),
      {method:'PATCH',body:JSON.stringify(payload)});
    return event.id;
  }
  // O mesmo registo local recebe sempre o mesmo ID no Google para evitar
  // duplicações após perda de Internet durante a confirmação.
  const fixedId=stableGoogleId(item.id);
  const resource={...payload};
  if(fixedId){
    resource.id=fixedId;
    resource.extendedProperties={private:{rjpLocalId:String(item.id)}};
  }
  try{
    const event=await request(base,{method:'POST',body:JSON.stringify(resource)});
    return event.id;
  }catch(error){
    if(error.status!==409 || !fixedId)throw error;
    const existing=await request(base+'/'+encodeURIComponent(fixedId));
    if(existing?.extendedProperties?.private?.rjpLocalId!==String(item.id)){
      throw new Error('Existe um conflito de identificador Google. Não foi criado outro evento.');
    }
    return existing.id;
  }
}
export async function deleteGoogleEvent(id){
  if(!id || !accessToken)return;
  return request(`/calendars/primary/events/${encodeURIComponent(id)}`,{method:'DELETE'});
}
/** Lê cada conta autorizada de forma independente. Uma falha não bloqueia as restantes. */
async function snapshotForAccount(email,from){
 const begin=new Date(from.getFullYear(),from.getMonth()-1,1).toISOString();
 const end=new Date(from.getFullYear(),from.getMonth()+3,1).toISOString();
 let calendars=[],listWarning='';
 try{
   let pageToken;
   do{
     const params=new URLSearchParams({maxResults:'250'});
     if(pageToken)params.set('pageToken',pageToken);
     const result=await request('/users/me/calendarList?'+params,email?{}:{},email);
     calendars.push(...(result.items||[]));
     pageToken=result.nextPageToken;
   }while(pageToken&&calendars.length<1000);
   calendars=visibleGoogleCalendars(calendars);
 }catch(error){
   if(/403|permiss|scope|acesso|calendar/i.test(String(error?.message||''))){
     listWarning=email+': sem acesso à lista de calendários; a consultar apenas o principal.';
     calendars=[];
   }else throw error;
 }
 if(!calendars.length){
   calendars=[{id:'primary',summary:'Calendário principal',primary:true}];
 }
 calendars.sort((a,b)=>Number(Boolean(b.primary))-Number(Boolean(a.primary)));
 const fetchOne=async calendar=>{
   const all=[];let pageToken;
   do{
     const params=new URLSearchParams({timeMin:begin,timeMax:end,singleEvents:'true',orderBy:'startTime',maxResults:'250',timeZone:'Europe/Lisbon'});
     if(pageToken)params.set('pageToken',pageToken);
     const result=await request('/calendars/'+encodeURIComponent(calendar.id)+'/events?'+params,{},email);
     all.push(...(result.items||[]));
     pageToken=result.nextPageToken;
   }while(pageToken&&all.length<2500);
   return normalizeGoogleEvents(all,{...calendar,accountEmail:email});
 };
 const settled=[];
 for(let i=0;i<calendars.length;i+=6){
   settled.push(...await Promise.allSettled(calendars.slice(i,i+6).map(fetchOne)));
 }
 const failed=settled.filter(x=>x.status==='rejected');
 if(failed.length===settled.length)throw failed[0].reason;
 return {
   events:settled.flatMap(x=>x.status==='fulfilled'?x.value:[]),
   calendars:calendars.map(x=>({id:x.id,summary:safeCalendarName(x.summary),primary:Boolean(x.primary),accountEmail:email})),
   warning:[listWarning,failed.length?email+': '+failed.length+' calendário(s) não puderam ser lidos.':''].filter(Boolean).join(' ')
 };
}
export async function getGoogleSnapshot(from=new Date()){
 if(!sessions.size)throw new Error('Liga pelo menos uma conta Google para consultar os calendários.');
 const allEmails=[...sessions.keys()];
 const results=await Promise.allSettled(allEmails.map(email=>snapshotForAccount(email,from)));
 const successful=results.filter(x=>x.status==='fulfilled').map(x=>x.value);
 if(!successful.length)throw results[0].reason;
 const calendars=successful.flatMap(x=>x.calendars);
 const seen=new Set();
 const events=successful.flatMap(x=>x.events).filter(x=>{
   // O mesmo calendário partilhado pode existir em várias contas.
   const k=x.calendarId+'|'+x.googleEventId;
   if(seen.has(k))return false;seen.add(k);return true;
 });
 const errors=results.flatMap((x,i)=>x.status==='rejected'?[allEmails[i]+': '+x.reason.message]:[]);
 const warning=[...successful.map(x=>x.warning).filter(Boolean),...errors].join(' ');
 return {events,calendars,warning,accounts:getGoogleAccounts()};
}
/** Compatibilidade com chamadas anteriores. */
export async function getGoogleEvents(from=new Date()){
  return (await getGoogleSnapshot(from)).events;
}
