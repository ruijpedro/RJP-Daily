import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

// A app só necessita de ler/criar/editar eventos, não gerir calendários nem partilhas.
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
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
  displayName=result?.profile?.name||result?.profile?.email||displayName||'Conta Google';
  return true;
}

/** Solicita autorização por gesto do utilizador; nunca guarda o token em localStorage. */
export async function connectGoogle(clientId) {
  await initialize(clientId);
  const result=await SocialLogin.login({provider:'google',options:{
    scopes:['email','profile',CALENDAR_SCOPE],
    filterByAuthorizedAccounts:false
  }});
  if(!applyResult(result))throw new Error('O Google não concedeu um token de acesso ao Calendar. Confirma permissões, Client ID Web e SHA-1 da APK.');
  return {name:displayName};
}

/** Restaurar sessão apenas em Android; Web necessita de nova autorização após recarregar. */
export async function restoreGoogleSession(clientId){
  if(!Capacitor.isNativePlatform() || !clientId || !clientIsValid(clientId))return null;
  try {
    await initialize(clientId);
    const state=await SocialLogin.isLoggedIn({provider:'google'});
    if(!state?.isLoggedIn)return null;
    const refreshed=await SocialLogin.refresh({provider:'google',options:{}});
    return applyResult(refreshed)?{name:displayName}:null;
  } catch {
    accessToken=null;
    return null;
  }
}

async function refreshAccess(){
  if(!Capacitor.isNativePlatform())return false;
  try {
    const refreshed=await SocialLogin.refresh({provider:'google',options:{}});
    return applyResult(refreshed);
  }catch{return false}
}

export async function disconnectGoogle(){
  try{await SocialLogin.logout({provider:'google'})}catch{}
  accessToken=null;displayName=null;
}
export function googleConnected(){return Boolean(accessToken)}
export function googleProfile(){return displayName}

/** Uma repetição após HTTP 401 com refresh nativo; no browser pede novo login. */
async function request(path,options={},retried=false){
  if(!accessToken)throw new Error('Liga primeiro a conta Google.');
  const response=await fetch('https://www.googleapis.com/calendar/v3'+path,{
    ...options,
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',...options.headers}
  });
  if(response.status===401){
    if(!retried && await refreshAccess())return request(path,options,true);
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

const dateObj=iso=>({dateTime:new Date(iso).toISOString(),timeZone:'Europe/Lisbon'});
export function googleEventPayload(item){
  if(!item?.when || Number.isNaN(new Date(item.when).getTime()))throw new Error('O evento necessita de data e hora válidas.');
  const start=new Date(item.when);
  const end=new Date(start.getTime()+(item.kind==='evento'?60:15)*60000);
  return {summary:item.title,description:`Criado pela RJP Daily.\n${item.details||''}`,
    start:dateObj(start),end:dateObj(end)};
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
export async function getGoogleEvents(from=new Date()){
  const begin=new Date(from.getFullYear(),from.getMonth(),from.getDate()-7).toISOString();
  const end=new Date(from.getFullYear(),from.getMonth()+2,from.getDate()+1).toISOString();
  const all=[];let pageToken;
  do{
    const params=new URLSearchParams({timeMin:begin,timeMax:end,singleEvents:'true',orderBy:'startTime',maxResults:'250'});
    if(pageToken)params.set('pageToken',pageToken);
    const x=await request('/calendars/primary/events?'+params.toString());
    all.push(...(x.items||[]));pageToken=x.nextPageToken;
  }while(pageToken && all.length<1000);
  return all.filter(e=>e.status!=='cancelled').map(e=>({
    id:'google:'+e.id,googleEventId:e.id,kind:'evento',title:e.summary||'(Sem título)',
    details:e.description||'',when:e.start?.dateTime||e.start?.date||'',
    fromGoogle:true,allDay:!e.start?.dateTime
  }));
}
