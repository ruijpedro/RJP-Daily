import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import {googleEventPayload,normalizeGoogleEvents,visibleGoogleCalendars} from '../logic/google-events.js';
import {safeCalendarName} from '../logic/calendar-view.js';

// A app só necessita de ler/criar/editar eventos, não gerir calendários nem partilhas.
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CALENDAR_LIST_SCOPE = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';
export const GOOGLE_CALENDAR_SCOPE = CALENDAR_SCOPE;
let initializedClient = null;
let initialization = null;
let accessToken = null;
let displayName = null;

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

function applyResult(answer) {
  const result=answer?.result||answer;
  const fresh=typeof result?.accessToken==='string'
    ? result.accessToken : result?.accessToken?.token;
  if(!fresh)return false;
  accessToken=fresh;
  displayName=result?.profile?.email||result?.profile?.name||displayName||'Conta Google';
  return true;
}

/** Solicita autorização por gesto do utilizador; nunca guarda o token em localStorage. */
export async function connectGoogle(clientId) {
  await initialize(clientId);
  const result=await SocialLogin.login({provider:'google',options:{
    scopes:['email','profile',CALENDAR_SCOPE,CALENDAR_LIST_SCOPE],
    filterByAuthorizedAccounts:false
  }});
  if(!applyResult(result))throw new Error('O Google não concedeu um token de acesso ao Calendar. Confirma permissões, Client ID Web e SHA-1 da APK.');
  return {name:displayName};
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

export async function disconnectGoogle(){
  try{await SocialLogin.logout({provider:'google'})}catch{}
  accessToken=null;displayName=null;
}
export function googleConnected(){return Boolean(accessToken)}
export function googleProfile(){return displayName}

/** O plugin v8 não devolve o token após refresh; em HTTP 401
 * pedir nova autorização em vez de tentar novamente com token expirado. */
async function request(path,options={}){
  if(!accessToken)throw new Error('Liga primeiro a conta Google.');
  const response=await fetch('https://www.googleapis.com/calendar/v3'+path,{
    ...options,
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',...options.headers}
  });
  if(response.status===401){
    accessToken=null;
    throw new Error('A autorização Google expirou. Volta a ligar a conta.');
  }
  if(!response.ok){
    let error={};try{error=await response.json()}catch{}
    if(response.status===403){
      throw new Error('O Google Calendar recusou o acesso. Confirma a Calendar API, o âmbito calendar.events e a autorização da conta.');
    }
    throw new Error(error?.error?.message || `Erro Google Calendar ${response.status}`);
  }
  return response.status===204?null:response.json();
}

export async function upsertGoogle(item){
  const body=JSON.stringify(googleEventPayload(item));
  if(item.googleEventId){
    const x=await request(`/calendars/primary/events/${encodeURIComponent(item.googleEventId)}`,{method:'PATCH',body});
    return x.id;
  }
  const x=await request('/calendars/primary/events',{method:'POST',body});
  return x.id;
}
export async function deleteGoogleEvent(id){
  if(!id || !accessToken)return;
  return request(`/calendars/primary/events/${encodeURIComponent(id)}`,{method:'DELETE'});
}
/** Consulta os calendários visíveis, não apenas o primário.
 * O âmbito calendar.calendarlist.readonly autoriza apenas a listagem de agendas.
 * Se ainda não foi autorizado, recua para o primário e indica a limitação. */
export async function getGoogleSnapshot(from=new Date()){
  const begin=new Date(from.getFullYear(),from.getMonth(),1).toISOString();
  const end=new Date(from.getFullYear(),from.getMonth()+2,1).toISOString();
  let calendars=[];
  let listWarning='';
  try{
    let pageToken;
    do{
      const params=new URLSearchParams({maxResults:'250'});
      if(pageToken)params.set('pageToken',pageToken);
      const result=await request('/users/me/calendarList?'+params.toString());
      calendars.push(...(result.items||[]));
      pageToken=result.nextPageToken;
    }while(pageToken && calendars.length<1000);
    calendars=visibleGoogleCalendars(calendars);
  }catch(error){
    // A versão anterior apenas concedia calendar.events. A aplicação continua
    // útil sem o novo âmbito, mas informa que só lê o calendário principal.
    const message=String(error?.message||'');
    if(/403|permiss|scope|acesso|calendar/i.test(message)){
      calendars=[];
      listWarning='Apenas calendário principal. Autoriza também calendar.calendarlist.readonly para veres as restantes agendas.';
    }else throw error;
  }
  if(!calendars.length){
    calendars=[{id:'primary',summary:'Calendário principal',primary:true}];
    if(!listWarning)listWarning='Não foram encontrados calendários visíveis; a consultar o principal.';
  }
  // Colocar o calendário principal primeiro. A consulta por "primary" garante
  // que o identificador funciona mesmo quando o Google fornece o email como ID.
  calendars.sort((a,b)=>Number(Boolean(b.primary))-Number(Boolean(a.primary)));
  const selected=calendars.slice(0,35);
  const fetchOne=async calendar=>{
    const all=[];let pageToken;
    do{
      const params=new URLSearchParams({timeMin:begin,timeMax:end,singleEvents:'true',
        orderBy:'startTime',maxResults:'250',timeZone:'Europe/Lisbon'});
      if(pageToken)params.set('pageToken',pageToken);
      const result=await request('/calendars/'+encodeURIComponent(calendar.id)+'/events?'+params);
      all.push(...(result.items||[]));
      pageToken=result.nextPageToken;
    }while(pageToken && all.length<2500);
    return normalizeGoogleEvents(all,calendar);
  };
  // Evitar falha global quando uma agenda partilhada foi revogada.
  const settled=await Promise.allSettled(selected.map(fetchOne));
  const failures=settled.filter(x=>x.status==='rejected');
  const events=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);
  if(failures.length===settled.length)throw failures[0].reason;
  const warning=[listWarning,failures.length?`${failures.length} agenda(s) não puderam ser consultadas.`:'',
    calendars.length>selected.length?'A mostrar as primeiras 35 agendas.':''].filter(Boolean).join(' ');
  return {events,calendars:selected.map(x=>({...x,summary:safeCalendarName(x.summary)})),warning};
}
/** Compatibilidade com chamadas anteriores. */
export async function getGoogleEvents(from=new Date()){
  return (await getGoogleSnapshot(from)).events;
}
