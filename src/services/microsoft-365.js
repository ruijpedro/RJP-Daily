import {Capacitor,CapacitorHttp} from '@capacitor/core';
import {Browser} from '@capacitor/browser';
import {safeCalendarName} from '../logic/calendar-view.js';
import {normalizeMicrosoftEvents} from '../logic/microsoft-calendar.js';

/**
 * Microsoft 365 corporate calendar: delegated, READ ONLY, public-client PKCE.
 * Requires an Entra app registered/approved by the organisation.
 * Never store OAuth tokens, event contents or refresh tokens in localStorage.
 * The system browser handles login/MFA; the native HTTP bridge redeems codes
 * because an embedded webview cannot redeem a non-SPA code via browser CORS.
 */
export const MICROSOFT_REDIRECT='agenda-rjp://oauth/microsoft';
export const MICROSOFT_SCOPES='openid profile User.Read Calendars.ReadBasic';
let oauthPending=null;
let accessToken=null;
let validUntil=0;
let identity=null;
const CFG_KEY='agenda-rjp-microsoft-approved-config-v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const randomBytes=(length=32)=>{
 const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);
 return bytes;
};
const base64url=bytes=>{
 let binary='';for(const x of bytes)binary+=String.fromCharCode(x);
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const randomString=()=>base64url(randomBytes(40));
const idSafe=v=>String(v||'').trim();
export function readMicrosoftConfig(){
 try{
  const d=JSON.parse(localStorage.getItem(CFG_KEY)||'{}');
  return {clientId:idSafe(d.clientId),tenantId:idSafe(d.tenantId)};
 }catch{return {clientId:'',tenantId:''};}
}
export function saveMicrosoftConfig({clientId,tenantId}){
 const cfg={clientId:idSafe(clientId),tenantId:idSafe(tenantId)};
 // Client and Tenant IDs are identifiers, never client secrets.
 localStorage.setItem(CFG_KEY,JSON.stringify(cfg));return cfg;
}
export function validateMicrosoftConfig({clientId,tenantId}){
 if(!uuid.test(idSafe(clientId)))throw new Error('Indica o Application (client) ID aprovado pelos serviços de informática da IP.');
 if(!uuid.test(idSafe(tenantId)))throw new Error('Indica o Directory (tenant) ID da organização, fornecido pelos serviços de informática.');
 return {clientId:idSafe(clientId),tenantId:idSafe(tenantId)};
}
export function microsoftSignedIn(){return !!accessToken && Date.now()<validUntil;}
export function microsoftIdentity(){return microsoftSignedIn()?identity:null;}
export function microsoftSignOut(){accessToken=null;validUntil=0;identity=null;oauthPending=null;}
export async function beginMicrosoftSignIn(raw){
 if(!Capacitor.isNativePlatform())throw new Error('A ligação corporativa requer a APK Android com autenticação Microsoft.');
 if(oauthPending)throw new Error('A autenticação Microsoft já está em curso.');
 const cfg=validateMicrosoftConfig(raw);
 const verifier=randomString();
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
 const challenge=base64url(new Uint8Array(hash));
 const state=randomString();
 const params=new URLSearchParams({
  client_id:cfg.clientId,response_type:'code',redirect_uri:MICROSOFT_REDIRECT,
  response_mode:'query',scope:MICROSOFT_SCOPES,code_challenge:challenge,
  code_challenge_method:'S256',state,prompt:'select_account'
 });
 oauthPending={...cfg,verifier,state,started:Date.now()};
 try{
  await Browser.open({url:'https://login.microsoftonline.com/'+cfg.tenantId+'/oauth2/v2.0/authorize?'+params.toString()});
 }catch(e){oauthPending=null;throw new Error('Não foi possível abrir a autenticação Microsoft: '+e.message);}
}
export function isMicrosoftCallback(url){
 try{
  const u=new URL(url);
  return u.protocol==='agenda-rjp:'&&u.hostname==='oauth'&&u.pathname==='/microsoft';
 }catch{return false;}
}
async function nativeRequest(options){
 const result=await CapacitorHttp.request(options);
 if(result.status<200||result.status>=300){
  const status=result.status;
  if(status===401){accessToken=null;validUntil=0;}
  if(status===403)throw new Error('A organização IP recusou esta autorização. Pede validação aos serviços de informática.');
  const message=String(result?.data?.error_description||result?.data?.error?.message||result?.data?.error||'').slice(0,220);
  throw new Error('Microsoft 365 ('+status+'): '+(message||'Não foi possível concluir o pedido.'));
 }
 return typeof result.data==='string'?JSON.parse(result.data):result.data;
}
async function graphGet(url,token=accessToken){
 if(!token)throw new Error('A conta Microsoft 365 IP precisa de nova autorização.');
 const target=new URL(url);
 if(target.protocol!=='https:'||target.hostname!=='graph.microsoft.com')throw new Error('Endereço Microsoft Graph inválido.');
 return nativeRequest({url:target.toString(),method:'GET',headers:{
  Authorization:'Bearer '+token,Accept:'application/json',Prefer:'outlook.timezone="UTC"'
 }});
}
/** Captures only the expected redirect with matching state, and redeems once. */
export async function completeMicrosoftSignIn(url){
 if(!isMicrosoftCallback(url))return null;
 const pending=oauthPending;oauthPending=null;
 if(!pending||Date.now()-pending.started>10*60*1000)throw new Error('Sessão Microsoft expirada. Volta a ligar a conta.');
 const params=new URL(url).searchParams;
 if(params.get('state')!==pending.state)throw new Error('Resposta Microsoft inválida (verificação de segurança).');
 if(params.get('error'))throw new Error('Microsoft não autorizou a ligação: '+String(params.get('error_description')||params.get('error')).slice(0,200));
 const code=params.get('code');
 if(!code)throw new Error('Microsoft não devolveu um código de autorização.');
 const body=new URLSearchParams({
  client_id:pending.clientId,grant_type:'authorization_code',code,
  redirect_uri:MICROSOFT_REDIRECT,code_verifier:pending.verifier,
  scope:MICROSOFT_SCOPES
 }).toString();
 const tok=await nativeRequest({
  url:'https://login.microsoftonline.com/'+pending.tenantId+'/oauth2/v2.0/token',
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
  data:body
 });
 if(!tok?.access_token)throw new Error('Microsoft não concedeu acesso ao calendário.');
 const profile=await graphGet('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName',tok.access_token);
 const email=String(profile.mail||profile.userPrincipalName||'').trim();
 if(!email)throw new Error('A conta corporativa não devolveu uma identificação válida.');
 // Token stays only in this JS runtime; no offline access is requested.
 accessToken=tok.access_token;
 validUntil=Date.now()+(Math.max(60,Number(tok.expires_in||3600)-90))*1000;
 identity={email,displayName:String(profile.displayName||email)};
 return identity;
}
export async function getMicrosoftSnapshot(from=new Date()){
 if(!microsoftSignedIn())throw new Error('A autorização corporativa expirou. Volta a ligar a conta Microsoft 365.');
 const start=new Date(from.getFullYear(),from.getMonth()-1,1).toISOString();
 const end=new Date(from.getFullYear(),from.getMonth()+3,1).toISOString();
 const calendars=[],events=[],errors=[];
 let url='https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar&$top=100';
 for(let i=0;url&&i<15;i++){
  const r=await graphGet(url);
  calendars.push(...(r.value||[]).map(c=>({id:c.id,summary:safeCalendarName(c.name),accountEmail:identity.email,fromMicrosoft:true})));
  url=r['@odata.nextLink']||null;
 }
 for(const calendar of calendars){
  const base='https://graph.microsoft.com/v1.0/me/calendars/'+encodeURIComponent(calendar.id)+'/calendarView';
  const params=new URLSearchParams({
   startDateTime:start,endDateTime:end,
   '$select':'id,subject,start,end,isAllDay,isCancelled',
   '$top':'250'
  });
  let next=base+'?'+params.toString(),count=0;
  try{
   while(next&&count++<20){
    const result=await graphGet(next);
    events.push(...normalizeMicrosoftEvents(result.value||[],calendar));
    next=result['@odata.nextLink']||null;
   }
  }catch(e){errors.push(calendar.summary+': '+e.message);}
 }
 if(calendars.length>0&&!events.length&&errors.length===calendars.length)throw new Error('Os calendários IP não puderam ser consultados: '+errors.join(' '));
 return {events,calendars,warning:errors.join(' '),account:identity};
}
