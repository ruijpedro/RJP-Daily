import { SocialLogin } from '@capgo/capacitor-social-login';
const scope='https://www.googleapis.com/auth/calendar.events';
let configuredId=null;
let token=null;
let displayName=null;
export async function connectGoogle(clientId) {
 if(!clientId?.endsWith('.apps.googleusercontent.com')) throw new Error('Indica um Client ID Web válido do Google Cloud.');
 if(configuredId!==clientId) { await SocialLogin.initialize({google:{webClientId:clientId,mode:'online'}}); configuredId=clientId; }
 const answer=await SocialLogin.login({provider:'google',options:{scopes:[scope]}});
 token=answer?.result?.accessToken?.token || null;
 displayName=answer?.result?.profile?.name || answer?.result?.profile?.email || 'Conta Google';
 if(!token)throw new Error('O Google não forneceu autorização para o Calendar. Confirma as permissões e o SHA-1 da APK.');
 return {name:displayName};
}
export async function disconnectGoogle() {
 try{await SocialLogin.logout({provider:'google'});}catch{}
 token=null; displayName=null;
}
export function googleConnected(){return Boolean(token);}
export function googleProfile(){return displayName;}
async function request(url, options={}) {
 if(!token)throw new Error('Liga primeiro a conta Google.');
 const response=await fetch('https://www.googleapis.com/calendar/v3'+url,{
  ...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers}
 });
 if(!response.ok) {
  if(response.status===401){token=null;throw new Error('A sessão Google expirou. Volta a ligar a conta.');}
  let d={};try{d=await response.json();}catch{}
  throw new Error(d?.error?.message || `Erro Google Calendar ${response.status}`);
 }
 return response.status===204?null:response.json();
}
const dateObj = (iso) => ({dateTime:new Date(iso).toISOString(),timeZone:'Europe/Lisbon'});
function payload(item){
 const start=new Date(item.when);
 const end=new Date(start.getTime()+(item.kind==='evento'?60:15)*60000);
 return {summary:item.title,description:`Criado pela RJP Daily.\n${item.details||''}`,start:dateObj(start),end:dateObj(end)};
}
export async function upsertGoogle(item){
 if(!item.when)throw new Error('O evento necessita de data e hora.');
 if(item.googleEventId){
  const x=await request(`/calendars/primary/events/${encodeURIComponent(item.googleEventId)}`,{method:'PATCH',body:JSON.stringify(payload(item))});
  return x.id;
 }
 const x=await request('/calendars/primary/events',{method:'POST',body:JSON.stringify(payload(item))});
 return x.id;
}
export async function deleteGoogleEvent(id){if(!id||!token)return;return request(`/calendars/primary/events/${encodeURIComponent(id)}`,{method:'DELETE'});}
export async function getGoogleEvents(from=new Date()){
 const begin=new Date(from.getFullYear(),from.getMonth(),from.getDate()-7).toISOString();
 const end=new Date(from.getFullYear(),from.getMonth()+2,from.getDate()+1).toISOString();
 const all=[]; let pageToken;
 do {
  const p=new URLSearchParams({timeMin:begin,timeMax:end,singleEvents:'true',orderBy:'startTime',maxResults:'250'});
  if(pageToken)p.set('pageToken',pageToken);
  const x=await request('/calendars/primary/events?'+p.toString());
  all.push(...(x.items||[])); pageToken=x.nextPageToken;
 }while(pageToken && all.length<1000);
 return all.filter(e=>e.status!=='cancelled').map(e=>({id:'google:'+e.id,googleEventId:e.id,kind:'evento',title:e.summary||'(Sem título)',details:e.description||'',when:e.start?.dateTime||e.start?.date||'',fromGoogle:true,allDay:!e.start?.dateTime}));
}
