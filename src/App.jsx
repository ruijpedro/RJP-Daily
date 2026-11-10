import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { checkForOta, hasAndroidOta, APP_VERSION } from './services/ota.js';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  Bell, BellRing, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  Cloud, CloudOff, Copy, Download, Edit3, FileText, Filter, Headphones, Home, Info, ListTodo,
  Loader2, Mic, MicOff, MoreVertical, Phone, Plus, RefreshCw, RotateCcw, Search,
  Settings2, ShieldCheck, SquarePen, StickyNote, Trash2, Upload, X, BriefcaseBusiness, CarFront
} from 'lucide-react';
import { parsePtCommand, localDateTime, relativeDay } from './logic/parse.js';
import IPWorkspace from './components/IPWorkspace.jsx';
import {loadIP,saveIP,makeProfessionalAgenda,parseIPVoice,importIPBackup,normalizeIP,localDay,newId} from './ip/model.js';
import { loadItems, saveItems, downloadBackup } from './services/storage.js';
import {makeBackup,parseBackupText,readJsonText,mergeById} from './logic/backup.js';
import {
  permissionStatus, requestNotificationPermission, requestExactSetting,
  scheduleItem, cancelItem, onNotificationAction, scheduleDailySummary, stopDailySummary
} from './services/notifications.js';
import { connectGoogle, restoreGoogleSession, disconnectGoogle, googleConnected, googleProfile, getGoogleSnapshot, getGoogleEvents, upsertGoogle, deleteGoogleEvent } from './services/google.js';
import { DEFAULT_GOOGLE_WEB_CLIENT_ID, describeGoogleLoginFailure } from './logic/google-diagnostic.js';
import {googleExportCandidates} from './logic/google-sync.js';
import {calendarDayKey,groupCalendarMonth,monthCalendarItems} from './logic/calendar-view.js';
import {syncAgendaWidget,clearAgendaWidgetGoogle} from './services/agenda-widget.js';

const categories=['Trabalho','Pessoal','Família','Outros'];
const kindLabels={nota:'Nota',tarefa:'Tarefa',evento:'Compromisso'};
const NAV=[{id:'inicio',icon:Home,text:'Início'},{id:'agenda',icon:CalendarDays,text:'Agenda'},{id:'deslocacoes',icon:CarFront,text:'Deslocações'},{id:'avisos',icon:BellRing,text:'Avisos IP'},{id:'ip',icon:BriefcaseBusiness,text:'IP'},{id:'prevencoes',icon:ShieldCheck,text:'Prevenções'},{id:'tarefas',icon:ListTodo,text:'Tarefas'},{id:'notas',icon:StickyNote,text:'Notas'}];
const startOfDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const dateKey=calendarDayKey;
const toDate=when=>when?new Date(when):null;
const dateFmt=(when,opt={})=>new Intl.DateTimeFormat('pt-PT',{day:'2-digit',month:'short',...opt}).format(toDate(when));
const timeFmt=when=>new Intl.DateTimeFormat('pt-PT',{hour:'2-digit',minute:'2-digit'}).format(toDate(when));
const freshId=()=>globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
const numericId=()=>Math.floor(100000000+Math.random()*1800000000);
function emptyDraft(){return {title:'',details:'',kind:'tarefa',category:'Trabalho',when:'',addToGoogle:false,original:''};}
function createDraft(source=''){return source ? {...emptyDraft(),...parsePtCommand(source),details:'',category:'Trabalho'} : emptyDraft();}

function Card({item,onToggle,onEdit,onDelete,onOpenIP,onSyncGoogle}){
 const fromGoogle=Boolean(item.fromGoogle);
 const fromIP=Boolean(item.fromIP);
 const overdue=item.when && !item.done && new Date(item.when)<new Date() && !fromGoogle;
 const I=item.kind==='nota'?FileText:item.kind==='evento'?CalendarDays:CheckCircle2;
 return <div className={`item-card ${item.done?'is-done':''}`}>
   <span className={`item-kind ${item.kind}`}><I size={18}/></span>
   <div className="item-info">
    <div className="item-heading"><span className="item-title">{item.title}</span>{fromGoogle&&<span className="google-tag">Google</span>}{fromIP&&<span className="google-tag">IP_RJP</span>}{!fromGoogle&&Boolean(item.googleEventId)&&<span className="google-tag">Enviado ao Google</span>}</div>
    {item.details&&<div className="item-details">{item.details}</div>}
    <div className="item-meta">
      <span>{item.category||'Agenda'}</span>
      {item.when&&<><span className="dot"/><span className={overdue?'overdue':''}>{relativeDay(item.when)}{!item.allDay&&` · ${timeFmt(item.when)}`}</span></>}
      {item.done&&<span className="done-tag">Concluído</span>}
      {item.when && !item.done && !item.fromGoogle && !item.fromIP && <Bell size={12}/>}
    </div>
   </div>
   {fromIP&&<button className="mini-btn" title="Abrir módulo IP" onClick={onOpenIP}><ChevronRight size={17}/></button>}
   {!fromGoogle&&!fromIP&&<div className="item-actions">
     {item.kind!=='nota'&&<button aria-label={item.done?'Reabrir tarefa':'Concluir tarefa'} title={item.done?'Reabrir':'Concluir'} onClick={()=>onToggle(item)} className="mini-btn">{item.done?<RotateCcw size={17}/>:<Check size={18}/>}</button>}
     {item.when&&!item.googleEventId&&!item.done&&<button aria-label="Enviar ao Google Calendar" title="Enviar ao Google Calendar" onClick={()=>onSyncGoogle(item)} className="mini-btn"><Cloud size={16}/></button>}
     <button aria-label="Editar" title="Editar" onClick={()=>onEdit(item)} className="mini-btn"><Edit3 size={16}/></button>
     <button aria-label="Eliminar" title="Eliminar" onClick={()=>onDelete(item)} className="mini-btn danger"><Trash2 size={16}/></button>
   </div>}
 </div>
}

function App(){
 const [items,setItems]=useState(loadItems);
 const [ipData,setIPData]=useState(loadIP);
 const [ipVoice,setIPVoice]=useState(null);
 const [tab,setTab]=useState('inicio');
 const [modal,setModal]=useState(null);
 const [draft,setDraft]=useState(emptyDraft);
 const [originalItem,setOriginalItem]=useState(null);
 const [filter,setFilter]=useState('Todos');
 const [search,setSearch]=useState('');
 const [listDay,setListDay]=useState(()=>startOfDay(new Date()));
 const [listMonth,setListMonth]=useState(()=>new Date().getMonth());
 const [listYear,setListYear]=useState(()=>new Date().getFullYear());
 const [busy,setBusy]=useState(false);
 const [listening,setListening]=useState(false);
 const [speechText,setSpeechText]=useState('');
 const speechRef=useRef(''); const recognition=useRef(null);const listener=useRef(null);
 const [toast,setToast]=useState('');
 const [clientId,setClientId]=useState(()=>localStorage.getItem('rjp-daily-google-client-id')||import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID||DEFAULT_GOOGLE_WEB_CLIENT_ID);
 const [googleError,setGoogleError]=useState('');
 const [googleWriteStatus,setGoogleWriteStatus]=useState('');
 const [autoGoogleNew,setAutoGoogleNew]=useState(()=>localStorage.getItem('agenda-rjp-google-auto-new')==='1');
 const [connected,setConnected]=useState(false);
 const [account,setAccount]=useState('');
 const [remoteEvents,setRemoteEvents]=useState([]);
 const [googleCalendarInfo,setGoogleCalendarInfo]=useState({loading:false,count:0,calendars:[],warning:'',error:''});
 const [permissions,setPermissions]=useState({});
 const [dailySummary,setDailySummary]=useState(()=>localStorage.getItem('rjp-daily-summary')==='1');
 const fileInput=useRef(null);
 const [backupText,setBackupText]=useState('');
 const [backupDraft,setBackupDraft]=useState(null);
 const [backupBusy,setBackupBusy]=useState(false);
 const [backupMode,setBackupMode]=useState('');
 const webDelivered=useRef(new Set());
 const [clock,setClock]=useState(()=>new Date());
 const [otaStatus,setOtaStatus]=useState({type:'idle',message:'Verificação automática ao abrir a app.'});
 const lastOtaNotice=useRef('');

 const notify=(s)=>{setToast(s);};
 useEffect(()=>{
  let mounted=true;
  const seen=localStorage.getItem('rjp-daily-last-opened-version');
  if(hasAndroidOta() && seen && seen!==APP_VERSION){
   setToast('Agenda RJP atualizada para a versão '+APP_VERSION+'.');
  }
  if(hasAndroidOta())localStorage.setItem('rjp-daily-last-opened-version',APP_VERSION);
  const status=s=>{
   if(!mounted)return;
   setOtaStatus(s);
   if(s.type==='ready' && s.version && lastOtaNotice.current!==s.version){
    lastOtaNotice.current=s.version;
    setToast('Atualização '+s.version+' descarregada. Será aplicada ao passar para segundo plano ou reabrir a app.');
   }
  };
  void checkForOta({onStatus:status});
  const timer=setInterval(()=>{void checkForOta({onStatus:status})},30*60*1000);
  const online=()=>{if(hasAndroidOta())void checkForOta({force:true,onStatus:status})};
  window.addEventListener('online',online);
  let listener;
  if(hasAndroidOta())void CapacitorApp.addListener('resume',()=>{void checkForOta({onStatus:status})}).then(h=>{if(mounted)listener=h;else void h.remove()}).catch(()=>{});
  return ()=>{mounted=false;clearInterval(timer);window.removeEventListener('online',online);if(listener)void listener.remove()};
 },[]);
 // A sessão Google é recuperada em Android, sem guardar tokens no armazenamento local.
 useEffect(()=>{
  if(!Capacitor.isNativePlatform() || !clientId.trim())return;
  let active=true;
  void (async()=>{
   const session=await restoreGoogleSession(clientId.trim());
   if(!session || !active)return;
   try{
    const events=await getGoogleEvents();
    if(active){setAccount(session.name);setConnected(true);setRemoteEvents(events);}
   }catch(e){if(active){setConnected(false);setAccount('');setRemoteEvents([]);}}
  })();
  return ()=>{active=false};
 },[]);
 // Atualizar calendários do mês e expor contagens/erros na agenda.
 useEffect(()=>{
  if(!connected)return;
  let active=true;
  setGoogleCalendarInfo(prev=>({...prev,loading:true,error:''}));
  void getGoogleSnapshot(new Date(listYear,listMonth,1))
    .then(snapshot=>{
      if(!active)return;
      setRemoteEvents(snapshot.events);
      setGoogleCalendarInfo({loading:false,count:snapshot.events.length,calendars:snapshot.calendars,warning:snapshot.warning,error:''});
    })
    .catch(error=>{
      if(!active)return;
      if(!googleConnected()){setConnected(false);setAccount('');setRemoteEvents([]);}
      setGoogleCalendarInfo(prev=>({...prev,loading:false,error:error.message||'Erro ao consultar o Google Calendar'}));
    });
  return ()=>{active=false};
 },[connected,listYear,listMonth]);
 useEffect(()=>{saveItems(items);},[items]);
 useEffect(()=>{saveIP(ipData);},[ipData]);
 useEffect(()=>{const timer=setInterval(()=>setClock(new Date()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),6000);return()=>clearTimeout(t);},[toast]);
 // Web: notificações apenas enquanto a página estiver em execução; não são push de fundo.
 useEffect(()=>{
  if(Capacitor.isNativePlatform() || !('Notification' in window))return;
  const tick=()=>{
   if(Notification.permission!=='granted')return;
   const now=Date.now();
   for(const item of items){
    if(item.done || !item.when || item.kind==='nota')continue;
    const when=new Date(item.when).getTime();
    const k=`${item.id}:${item.when}`;
    if(now>=when && now-when<90000 && !webDelivered.current.has(k)){
      webDelivered.current.add(k);
      try {new Notification('Agenda RJP · Lembrete',{body:item.title,tag:k});}catch{}
    }
   }
  };
  tick();const timer=setInterval(tick,15000);return()=>clearInterval(timer);
 },[items]);

 useEffect(()=>{
  let active=true;permissionStatus().then(s=>{if(active)setPermissions(s)});
  let dispose=()=>{};
  onNotificationAction(action=>{
   const id=action?.notification?.extra?.itemId;
   if(!id)return;
   if(id.startsWith('ip-alert:') && !['done','snooze'].includes(action.actionId))setTab('avisos');
   if(action.actionId==='done'){
     setItems(prev=>prev.map(x=>x.id===id?{...x,done:true}:x));
   }
   if(action.actionId==='snooze'){
     const all=loadItems();const item=all.find(x=>x.id===id);
     if(item){const updated={...item,when:localDateTime(new Date(Date.now()+10*60000)),done:false};
       setItems(prev=>prev.map(x=>x.id===id?updated:x));scheduleItem(updated);
     }
   }
  }).then(fn=>{if(active)dispose=fn;else fn()}).catch(()=>{});
  return ()=>{active=false;dispose();};
 },[]);
 // A reconciliação evita perder lembretes após alterações do estado da app.
 useEffect(()=>{
  if(!Capacitor.isNativePlatform())return;
  (async()=>{
   const p=await permissionStatus(); if(p.status!=='granted')return;
   const pending=await LocalNotifications.getPending();
   const ids=new Set(pending.notifications.map(x=>x.id));
   for(const item of items){if(item.when && !item.done && !ids.has(item.notificationId) && new Date(item.when)>new Date())await scheduleItem(item);}
  })().catch(()=>{});
 },[]); // Reconciliar apenas no arranque

 const professionalAgenda=useMemo(()=>makeProfessionalAgenda(ipData),[ipData]);
 const localOpen=useMemo(()=>items.filter(i=>!i.done),[items]);
 const googlePending=useMemo(()=>googleExportCandidates(items),[items]);
 const visibleAll=useMemo(()=>{
  const known = new Set([...items.map(i=>i.googleEventId),...ipData.trips.map(i=>i.googleEventId),...ipData.guards.map(i=>i.googleEventId),...ipData.activities.map(i=>i.googleEventId)].filter(Boolean));
  const professionalIds=new Set(items.map(i=>i.linkedIPId).filter(Boolean));
  return [...items,...professionalAgenda.filter(e=>!professionalIds.has(e.linkedId)),...remoteEvents.filter(e=>!known.has(e.googleEventId))];
 },[items,remoteEvents,professionalAgenda,ipData]);
 // Reflete no launcher apenas títulos/horas, sem descrições, tokens ou NIF.
 // Na APK antiga o plugin ainda não existe: o serviço ignora silenciosamente.
 useEffect(()=>{void syncAgendaWidget(visibleAll,connected);},[visibleAll,connected]);
 const todays=useMemo(()=>visibleAll.filter(i=>i.when && dateKey(i.when)===dateKey(clock)&&!i.done),[visibleAll,clock]);
 const pending=useMemo(()=>items.filter(i=>i.kind==='tarefa'&&!i.done&&i.when&&new Date(i.when)<clock),[items,clock]);
 const upcoming=useMemo(()=>visibleAll.filter(i=>!i.done&&i.when&&new Date(i.when)>=clock).sort((a,b)=>new Date(a.when)-new Date(b.when)),[visibleAll,clock]);
 const applyFilters=(a)=>a.filter(i=>(filter==='Todos'||i.category===filter||filter==='Pendentes'&&!i.done)&&(search.trim()===''||`${i.title} ${i.details||''}`.toLocaleLowerCase('pt-PT').includes(search.trim().toLocaleLowerCase('pt-PT'))));
 const prepare=(text='')=>{const d=createDraft(text);setDraft({...d,addToGoogle:Boolean(connected&&autoGoogleNew&&d.kind!=='nota')});setOriginalItem(null);setModal('editor');};
 const edit=(item)=>{setDraft({...emptyDraft(),...item,when:item.when?localDateTime(item.when):''});setOriginalItem(item);setModal('editor');};
 const updateDraft=(k,value)=>setDraft(prev=>({...prev,[k]:value}));

 async function commit(){
  const title=draft.title.trim();if(!title){notify('Escreve um título para guardar.');return;}
  const when=draft.when||'';
  if(when && Number.isNaN(new Date(when).getTime())){notify('Data ou hora inválida.');return;}
  if(draft.kind==='nota' && when){notify('Notas não criam alertas: seleciona Tarefa ou Compromisso.');return;}
  if(when && new Date(when)<=new Date() && draft.kind!=='nota'){notify('Escolhe uma data/hora futura para o lembrete.');return;}
  const item={...emptyDraft(),...draft,title,details:(draft.details||'').trim(),when,
   id:originalItem?.id||freshId(),googleEventId:originalItem?.googleEventId||draft.googleEventId||null,notificationId:originalItem?.notificationId||numericId(),
   done:originalItem?.done||false,updatedAt:new Date().toISOString(),createdAt:originalItem?.createdAt||new Date().toISOString()};
  setBusy(true);
  try{
   if(originalItem)await cancelItem(originalItem);
   setItems(prev=>originalItem?prev.map(i=>i.id===item.id?item:i):[item,...prev]);
   const result=await scheduleItem(item);
   if(when && draft.kind!=='nota' && Capacitor.isNativePlatform() && !result.scheduled){
     notify('Guardado, mas o aviso ainda não ficou agendado. Verifica as permissões de notificação.');
   }
   if(item.addToGoogle && item.when){
    if(!googleConnected())notify('Guardado localmente. Liga o Google Calendar para sincronizar este compromisso.');
    else {
     try{const googleEventId=await upsertGoogle(item);setItems(prev=>prev.map(i=>i.id===item.id?{...i,googleEventId}:i));setGoogleWriteStatus('Compromisso enviado com sucesso para o calendário principal da conta Google.');notify('Guardado e enviado ao Google Calendar.');await refreshGoogle(true);}
     catch(e){setGoogleWriteStatus('Erro ao enviar: '+e.message);notify('Registo guardado na Agenda RJP; envio Google falhou. Consulta as Definições.');}
    }
   } else if (!Capacitor.isNativePlatform()) notify('Guardado. Na WebApp, os alertas com o navegador fechado não estão garantidos; usa a APK Android.');
   else if(result.scheduled)notify('Guardado com notificação agendada.');
   else if(!when)notify('Nota guardada.');
   setModal(null);
  } finally {setBusy(false);}
 }
 async function toggleDone(item){
  if(!item.done)await cancelItem(item);
  const reopened={...item,done:!item.done};
  setItems(prev=>prev.map(x=>x.id===item.id?reopened:x));
  if(item.done)await scheduleItem(reopened);
 }
 async function remove(item){
  if(!window.confirm(`Eliminar «${item.title}» da Agenda RJP?`))return;
  if(item.googleEventId && connected && window.confirm('Eliminar também o evento associado no Google Calendar?')){
   try{await deleteGoogleEvent(item.googleEventId);}catch(e){notify('Não foi possível eliminar no Google: '+e.message)}
  }
  await cancelItem(item);setItems(prev=>prev.filter(x=>x.id!==item.id));notify('Registo eliminado.');
 }
 async function refreshGoogle(silent=false){
  if(!googleConnected())return;
  setGoogleCalendarInfo(prev=>({...prev,loading:true,error:''}));
  try{
    const snapshot=await getGoogleSnapshot(new Date(listYear,listMonth,1));
    setRemoteEvents(snapshot.events);
    setGoogleCalendarInfo({loading:false,count:snapshot.events.length,calendars:snapshot.calendars,warning:snapshot.warning,error:''});
    if(!silent)notify('Google Calendar: '+snapshot.events.length+' compromisso(s) em '+snapshot.calendars.length+' calendário(s).');
  }catch(e){
    setGoogleCalendarInfo(prev=>({...prev,loading:false,error:e.message||'Falha ao ler a agenda'}));
    if(!silent)notify('Não foi possível atualizar os eventos Google. Consulta Definições.');
    setConnected(googleConnected());
  }
 }
 // Exportação sempre iniciada pelo utilizador. Não partilhar notas ou
 // deslocações/prevenções IP implicitamente com a conta Google.
 async function syncOneGoogle(item){
  if(busy)return;
  if(!googleConnected()){
   setGoogleWriteStatus('Liga a conta Google antes de enviar o compromisso.');
   notify('A conta Google não está ligada.');return;
  }
  if(!googleExportCandidates([item]).length){
   notify('Este registo já está sincronizado ou não tem data/hora.');return;
  }
  setBusy(true);
  setGoogleWriteStatus('A enviar «'+item.title+'»…');
  try{
   const googleEventId=await upsertGoogle(item);
   setItems(prev=>prev.map(x=>x.id===item.id?{...x,googleEventId,addToGoogle:true}:x));
   setGoogleWriteStatus('Enviado para o calendário principal: «'+item.title+'».');
   notify('Compromisso enviado ao Google Calendar.');
   await refreshGoogle(true);
  }catch(error){
   setGoogleWriteStatus('Não foi possível enviar «'+item.title+'»: '+error.message);
   notify('Google Calendar: envio falhou. Consulta Definições.');
  }finally{setBusy(false)}
 }
 async function syncPendingGoogle(){
  if(busy)return;
  if(!googleConnected()){setGoogleWriteStatus('Volta a ligar a conta Google para sincronizar.');return;}
  const all=googleExportCandidates(items);
  if(!all.length){setGoogleWriteStatus('Não existem compromissos locais por enviar.');return;}
  const batch=all.slice(0,50);
  const question='Enviar '+batch.length+' tarefa(s) e compromisso(s) da Agenda RJP para o calendário principal de '+(account||'Google')+'?'
   +'\n\nInclui título, data/hora e descrição. Notas sem data, deslocações e prevenções IP ficam de fora.'
   +(all.length>batch.length?'\n\nSerão enviados os primeiros 50; poderás repetir depois.':'');
  if(!window.confirm(question))return;
  setBusy(true);
  let ok=0;
  let failed=0;
  for(const item of batch){
   try{
    const googleEventId=await upsertGoogle(item);
    setItems(prev=>prev.map(x=>x.id===item.id?{...x,googleEventId,addToGoogle:true}:x));
    ok++;
   }catch(error){
    failed++;
    setGoogleWriteStatus('Falha ao enviar «'+item.title+'»: '+error.message);
    // Não insistir se a sessão expirou: evita pedidos desnecessários.
    if(!googleConnected())break;
   }
  }
  setBusy(false);
  setGoogleWriteStatus(ok+' compromisso(s) enviado(s); '+failed+' falha(s). Os restantes mantêm-se na app.');
  notify(ok+' compromisso(s) exportado(s) para o Google Calendar.');
  if(ok)await refreshGoogle(true);
 }
 async function googleConnect(){
  setBusy(true);setGoogleError('');
  let phase='login';
  try{
   const id=clientId.trim();
   const u=await connectGoogle(id);
   phase='calendar';
   // Só apresentar «Ligado» depois de uma chamada real à Google Calendar API.
   const snapshot=await getGoogleSnapshot(new Date(listYear,listMonth,1));
   localStorage.setItem('rjp-daily-google-client-id',id);
   setAccount(u.name);setConnected(true);setRemoteEvents(snapshot.events);
   setGoogleCalendarInfo({loading:false,count:snapshot.events.length,calendars:snapshot.calendars,warning:snapshot.warning,error:''});
   notify('Google Calendar ligado: '+snapshot.events.length+' compromisso(s) encontrados.');
  }catch(e){
   const diagnostic=describeGoogleLoginFailure(e,phase);
   setGoogleError(diagnostic);
   setConnected(false);setAccount('');setRemoteEvents([]);
   notify('Falha ao ligar o Google Calendar. Vê a explicação em Definições.');
  }
  finally{setBusy(false)}
 }
 async function googleDisconnect(){await disconnectGoogle();await clearAgendaWidgetGoogle();setConnected(false);setAccount('');setRemoteEvents([]);notify('Conta Google desligada.');}
 async function startVoice(){
  if(listening)return;
  speechRef.current='';setSpeechText('');setListening(true);setModal('voice');
  if(Capacitor.isNativePlatform()){
   try{
    await SpeechRecognition.requestPermissions();
    const available=await SpeechRecognition.available();
    if(!available.available)throw new Error('Reconhecimento de voz indisponível neste dispositivo.');
    listener.current=await SpeechRecognition.addListener('partialResults',({matches})=>{
     const txt=matches?.[0]||''; if(txt){speechRef.current=txt;setSpeechText(txt);}
    });
    await SpeechRecognition.start({language:'pt-PT',maxResults:1,partialResults:true});
   }catch(e){setListening(false);notify(`Microfone: ${e.message}`);}
  } else {
   const API=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(!API){setListening(false);notify('Este navegador não disponibiliza ditado. Usa Chrome ou a APK Android.');return;}
   const r=new API();r.lang='pt-PT';r.interimResults=true;r.continuous=false;
   r.onresult=(event)=>{const t=Array.from(event.results).map(v=>v[0].transcript).join(' ');speechRef.current=t;setSpeechText(t);};
   r.onerror=(event)=>{setListening(false);notify('Ditado: '+event.error);};
   r.onend=()=>setListening(false);recognition.current=r;
   try{r.start();}catch(e){setListening(false);notify(e.message);}
  }
 }
 async function stopVoice(){
  try{if(Capacitor.isNativePlatform())await SpeechRecognition.stop(); else recognition.current?.stop();}catch{}
  try{await listener.current?.remove();}catch{}listener.current=null;
  setListening(false);
 }
 async function finishVoice(){
  await stopVoice();
  const text=speechRef.current.trim()||speechText.trim();
  if(!text){notify('Não foi captado texto. Podes voltar a ditar ou escrever manualmente.');return;}
  const query=/\b(o que tenho|mostra(?:-me)? (?:a )?agenda|consulta(?:r)? (?:a )?agenda)\b/i.test(text);
  if(query){const parsed=parsePtCommand(text);const d=parsed.when?new Date(parsed.when):new Date();setListDay(startOfDay(d));setListMonth(d.getMonth());setListYear(d.getFullYear());setTab('agenda');setModal(null);notify('Agenda aberta.');return;}
  const ip=parseIPVoice(text);
  if(ip){setIPVoice(ip);setTab(ip.type==='trips'?'deslocacoes':ip.type==='guards'?'prevencoes':'ip');setModal(null);return;}
  const d=createDraft(text);setDraft({...d,addToGoogle:Boolean(connected&&autoGoogleNew&&d.kind!=='nota')});setOriginalItem(null);setModal('editor');
 }
 // Atalhos do widget: URI explícito Android, validado no arranque e em execução.
 const widgetActionRef=useRef(null);
 widgetActionRef.current=(action)=>{
   if(action==='alerts'){setModal(null);setTab('avisos');return;}
   const d=new Date();setListDay(startOfDay(d));setListMonth(d.getMonth());setListYear(d.getFullYear());setTab('agenda');
   if(action==='new'){prepare();setDraft(prev=>({...prev,kind:'evento',when:localDateTime(d),addToGoogle:Boolean(connected&&autoGoogleNew)}));}
   else if(action==='voice'){void startVoice();}
 };
 useEffect(()=>{
   if(Capacitor.getPlatform()!=='android')return;
   let active=true,subscription=null,lastUrl='',lastAt=0;
   const handle=({url}={})=>{
     if(!active||!/^agenda-rjp:\/\/widget\/(agenda|new|voice|alerts)$/.test(url||''))return;
     if(url===lastUrl&&Date.now()-lastAt<1500)return;
     lastUrl=url;lastAt=Date.now();
     widgetActionRef.current?.(url.split('/').pop());
   };
   void (async()=>{
     subscription=await CapacitorApp.addListener('appUrlOpen',handle);
     if(!active){await subscription.remove();return;}
     const launch=await CapacitorApp.getLaunchUrl();if(launch)handle(launch);
   })().catch(()=>{});
   return ()=>{active=false;void subscription?.remove();};
 },[]);
 async function usePermissions(){
  const ok=await requestNotificationPermission();setPermissions(await permissionStatus());
  notify(ok?'Permissão para notificações concedida.':'Notificações não autorizadas.');
 }
 async function toggleSummary(){
  const next=!dailySummary;
  const ok=next?await scheduleDailySummary(8):(await stopDailySummary(),true);
  if(!ok){notify('Não foi possível ativar o resumo; verifica as permissões Android.');return;}
  setDailySummary(next);localStorage.setItem('rjp-daily-summary',next?'1':'0');notify(next?'Resumo diário ativado para as 08h00.':'Resumo diário desativado.');
 }
 async function importBackup(file){
  setBackupDraft(null);
  try{setBackupDraft(parseBackupText(await readJsonText(file)));setTab('definicoes');notify('Backup lido. Confirma os registos a importar.');}
  catch(e){notify(e.message||'Não foi possível ler o backup.');}
 }
 function previewBackupText(){
  setBackupDraft(null);
  try{setBackupDraft(parseBackupText(backupText));notify('JSON validado. Confirma a importação.');}catch(e){notify(e.message);}
 }
 async function exportCompleteBackup(){
  setBackupBusy(true);
  try{const mode=await downloadBackup(items,ipData);notify(mode==='share'?'Escolhe onde guardar o JSON na janela de partilha (ex.: Drive).':'Backup JSON descarregado.');}
  catch(e){notify('Falha na exportação: '+(e.message||'erro de ficheiro')+'. Podes usar Mostrar JSON.');}
  finally{setBackupBusy(false);}
 }
 async function applyBackup(){
  if(!backupDraft)return;
  setBackupBusy(true);
  try{
   const parsed=backupDraft;
   const imported=parsed.items?.map(i=>({...i,notificationId:i.notificationId||numericId()}))||[];
   const data=parsed.ip?normalizeIP(parsed.ip):null;
   const nextItems=parsed.items?mergeById(items,imported):items;
   let nextIP=ipData;
   if(data){
    nextIP={...ipData,profile:{...ipData.profile,...data.profile},vehicles:[...new Map([...ipData.vehicles,...data.vehicles].map(v=>[v.plate,v])).values()],defaultVehiclePlate:data.defaultVehiclePlate||ipData.defaultVehiclePlate,places:[...new Set([...ipData.places,...data.places])],activityTypes:[...new Set([...ipData.activityTypes,...data.activityTypes])]};
    for(const key of ['trips','guards','activities'])nextIP[key]=mergeById(ipData[key],data[key]);
   }
   // Preservar uma cópia local anterior à importação; nunca apagar a base atual.
   localStorage.setItem('rjp-daily-before-import',JSON.stringify(makeBackup(items,ipData)));
   saveItems(nextItems);saveIP(nextIP);setItems(nextItems);setIPData(nextIP);
   setBackupDraft(null);setBackupText('');setBackupMode('');
   notify('Importação concluída: '+imported.length+' registos de agenda e '+(data?data.trips.length+data.guards.length+data.activities.length:0)+' profissionais. Os restantes foram mantidos.');
   for(const i of imported){if(i.when&&!i.done&&new Date(i.when)>new Date())await scheduleItem(i).catch(()=>{});}
  }catch(e){notify('Falha ao importar: '+e.message);}
  finally{setBackupBusy(false);}
 }
 const ipAgendaGoogle=(key,r)=>({
  kind:'evento', title:key==='trips'?`Deslocação IP: ${r.from} → ${r.to}`:key==='guards'?`Prevenção ${r.kind} · IP`: `${r.type||'Atividade'} · ${r.place||'IP'}`,
  details:[r.activity,r.notes,r.vehiclePlate&&`Viatura ${r.vehiclePlate}`].filter(Boolean).join(' · '),
  when:`${r.date}T${key==='trips'?(r.out||'09:00'):(r.start||'09:00')}`,
  googleEventId:r.googleEventId||null,id:'ip-'+key+'-'+r.id
 });
 async function persistProfessional(key,record,previous=null){
  // A persistência local é sempre prioritária; as ligações externas são opcionais.
  const next={...record,notificationId:record.notificationId||previous?.notificationId||numericId()};
  if(next.addToGoogle){
   if(!googleConnected())notify('Registo guardado localmente. Liga a conta Google para enviar o evento.');
   else if(key==='guards'&&!next.start)notify('Prevenção guardada localmente. Indica uma hora de início para sincronizar com Google.');
   else {
    try{next.googleEventId=await upsertGoogle(ipAgendaGoogle(key,next));notify('Evento profissional enviado para o Google Calendar.');await refreshGoogle(true);}
    catch(e){notify('Registo local guardado; Google Calendar: '+e.message);}
   }
  }
  if(previous?.reminderAt)await cancelItem({notificationId:previous.notificationId});
  const linkedId=`ip-alert:${next.id}`;
  const linked={id:linkedId,linkedIPId:next.id,linkedIPType:key,kind:'tarefa',title:ipAgendaGoogle(key,next).title,
   details:ipAgendaGoogle(key,next).details,category:'Trabalho',when:next.reminderAt||'',notificationId:next.notificationId,
   done:false,createdAt:next.createdAt,updatedAt:next.updatedAt};
  setItems(prev=>{
   const filtered=prev.filter(i=>i.id!==linkedId);
   return next.reminderAt?[linked,...filtered]:filtered;
  });
  setIPData(prev=>({...prev,[key]:previous?prev[key].map(r=>r.id===next.id?next:r):[next,...prev[key]]}));
  if(next.reminderAt){
   const result=await scheduleItem(linked);
   if(result.scheduled)notify('Registo guardado e aviso profissional agendado.');
   else notify('Registo guardado, mas o aviso não foi agendado. Confirma as permissões Android.');
  } else if(!next.addToGoogle)notify('Registo profissional guardado.');
 }
 async function deleteProfessional(key,record){
  if(!window.confirm('Eliminar este registo profissional?'))return;
  if(record.notificationId)await cancelItem({notificationId:record.notificationId});
  setItems(prev=>prev.filter(i=>i.id!==`ip-alert:${record.id}`));
  setIPData(prev=>({...prev,[key]:prev[key].filter(x=>x.id!==record.id)}));
  if(record.googleEventId&&googleConnected()&&window.confirm('Eliminar também o evento do Google Calendar?')){
   try{await deleteGoogleEvent(record.googleEventId);await refreshGoogle(true);}catch(e){notify('Eliminado localmente, mas o Google respondeu: '+e.message);}
  }
  notify('Registo profissional eliminado.');
 }
 async function importProfessional(file){await importBackup(file);}
 const openProfessional=()=>setTab('ip');
 const openTrips=()=>setTab('deslocacoes');
 const openAlerts=()=>setTab('avisos');
 const openGuards=()=>setTab('prevencoes');
 const dateTitle=clock.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 // O calendário não herda pesquisas e filtros dos separadores Tarefas/Notas.
 const monthGroups=useMemo(()=>groupCalendarMonth(visibleAll,listYear,listMonth),[visibleAll,listYear,listMonth]);
 const monthEvents=useMemo(()=>monthCalendarItems(monthGroups),[monthGroups]);
 const monthlyGoogle=monthEvents.filter(x=>x.fromGoogle);
 const dayRows=[...(monthGroups[dateKey(listDay)]||[])].sort((a,b)=>new Date(a.when)-new Date(b.when));
 const monthDate=new Date(listYear,listMonth,1);
 const monthFirst=new Date(listYear,listMonth,1).getDay();
 const offset=(monthFirst+6)%7; const daysInMonth=new Date(listYear,listMonth+1,0).getDate();
 const monthCells=Array.from({length:Math.ceil((offset+daysInMonth)/7)*7},(_,i)=>{const day=i-offset+1;return day>=1&&day<=daysInMonth?day:null;});
 const monthLabel=monthDate.toLocaleDateString('pt-PT',{month:'long',year:'numeric'});
 const countDate=d=>(monthGroups[dateKey(new Date(listYear,listMonth,d))]||[]).length;
 const shiftMonth=n=>{const m=new Date(listYear,listMonth+n,1);setListMonth(m.getMonth());setListYear(m.getFullYear());setListDay(m)};

 return <div className="app">
   <header className="topbar">
     <div className="brand-mark"><img className="brand-image" src="./icon-192.png" alt="RJP" /></div>
     <div className="brand"><strong>Agenda <span>RJP</span></strong><small>AGENDA & VOZ</small></div>
     <div className="top-actions"><span className={`connection-indicator ${connected?'on':''}`} title={connected?'Google Calendar ligado':'Google Calendar desligado'}><Cloud size={18}/></span><button aria-label="Definições" className="header-icon" onClick={()=>setTab('definicoes')}><Settings2 size={20}/></button></div>
   </header>
   <main className="main">
    {tab==='inicio'&&<>
      <section className="welcome"><div className="eyebrow">A TUA ASSISTENTE DIÁRIA</div><h1>Bom {clock.getHours()<12?'dia':clock.getHours()<20?'tarde':'noite'}! <span className="hello-dot">●</span></h1><p className="date-title">{dateTitle}</p></section>
      <section className="stats">
       <button onClick={()=>{setTab('agenda');setListDay(startOfDay(new Date()))}}><span className="stat-icon blue"><CalendarDays size={19}/></span><strong>{todays.length}</strong><small>Para hoje</small></button>
       <button onClick={()=>{setTab('tarefas');setFilter('Pendentes')}}><span className="stat-icon teal"><ListTodo size={19}/></span><strong>{localOpen.filter(i=>i.kind==='tarefa').length}</strong><small>Tarefas</small></button>
       <button onClick={()=>{setTab('tarefas');setFilter('Pendentes')}}><span className="stat-icon amber"><BellRing size={19}/></span><strong>{pending.length}</strong><small>Em atraso</small></button>
      </section>
      <button className="voice-hero" onClick={startVoice}><span className="voice-round"><Mic size={26}/></span><span><strong>O que precisas de registar?</strong><small>Toca e fala naturalmente em português.</small></span><span className="voice-chevron"><ChevronRight size={21}/></span></button>
      <div className="section-heading"><h2>Agenda de hoje</h2><button className="text-button" onClick={()=>setTab('agenda')}>Ver agenda <ChevronRight size={16}/></button></div>
      {todays.length ? todays.sort((a,b)=>new Date(a.when)-new Date(b.when)).map(i=><Card key={i.id} item={i} onToggle={toggleDone} onEdit={edit} onDelete={remove} onOpenIP={openProfessional} onSyncGoogle={syncOneGoogle}/>) : <div className="empty"><CalendarDays size={25}/><strong>Sem tarefas marcadas para hoje</strong><p>Adiciona um compromisso ou dita uma nova nota.</p></div>}
      <div className="section-heading"><h2>Próximos compromissos e lembretes</h2><button className="text-button" onClick={()=>{setTab('tarefas');setFilter('Todos')}}>Ver todos <ChevronRight size={16}/></button></div>
      {upcoming.slice(0,4).map(i=><Card key={i.id} item={i} onToggle={toggleDone} onEdit={edit} onDelete={remove} onOpenIP={openProfessional} onSyncGoogle={syncOneGoogle}/>)}
      {!upcoming.length&&<div className="empty compact">Ainda não tens lembretes futuros.</div>}
      <button className="ip-home-link" onClick={openTrips}><CarFront size={20}/><span><b>Deslocações de serviço</b><small>Registar e consultar · {ipData.trips.length} deslocações</small></span><ChevronRight size={19}/></button>
      <button className="guard-home-link" onClick={openAlerts}><BellRing size={22}/><span><b>Notificações profissionais</b><small>Deslocações, prevenções e atividades · consultar avisos</small></span><ChevronRight size={19}/></button>
      <button className="ip-home-link" onClick={openProfessional}><CarFront size={20}/><span><b>Gestão profissional · IP_RJP</b><small>{ipData.trips.length} deslocações · {ipData.guards.length} prevenções · {ipData.activities.length} atividades</small></span><ChevronRight size={19}/></button>
      <button className="guard-home-link" onClick={openGuards}><ShieldCheck size={22}/><span><b>Prevenções BT / CC</b><small>Aceder aos registos da antiga IP_RJP · {ipData.guards.length} registadas</small></span><ChevronRight size={19}/></button>
      <div className="section-heading"><h2>Registos rápidos</h2></div>
      <div className="quick-actions"><button onClick={()=>{prepare();setDraft(prev=>({...prev,kind:'tarefa'}))}}><ListTodo size={20}/> Nova tarefa</button><button onClick={()=>{prepare();setDraft(prev=>({...prev,kind:'nota'}))}}><StickyNote size={20}/> Nova nota</button></div>
    </>}
    {tab==='agenda'&&<>
      <div className="page-intro"><div className="eyebrow">PLANEAMENTO</div><h1>Calendário</h1><p>Os teus compromissos e lembretes num só lugar.</p></div>
      {connected&&<div className="google-calendar-summary" role="status">
        <Cloud size={18}/>
        <div className="google-calendar-summary-text">
          <strong>{googleCalendarInfo.loading?'A atualizar Google Calendar…':googleCalendarInfo.count+' eventos Google · '+googleCalendarInfo.calendars.length+' calendários'}</strong>
          {googleCalendarInfo.warning&&<small>{googleCalendarInfo.warning}</small>}
          {googleCalendarInfo.error&&<small>Erro de leitura: {googleCalendarInfo.error}</small>}
        </div>
        <button type="button" aria-label="Atualizar Google Calendar" onClick={()=>refreshGoogle()}><RefreshCw size={17}/></button>
      </div>}
      <div className="month-card">
       <div className="month-heading"><button aria-label="Mês anterior" onClick={()=>shiftMonth(-1)}><ChevronLeft/></button><h2>{monthLabel}</h2><button aria-label="Mês seguinte" onClick={()=>shiftMonth(1)}><ChevronRight/></button></div>
       <div className="calendar-grid">{['S','T','Q','Q','S','S','D'].map((d,i)=><span className="weekday" key={i}>{d}</span>)}
        {monthCells.map((day,i)=><button key={i} disabled={!day} className={`day-cell ${day&&dateKey(new Date(listYear,listMonth,day))===dateKey(listDay)?'selected':''} ${day&&dateKey(new Date(listYear,listMonth,day))===dateKey(clock)?'today':''}`}
          aria-label={day?day+' de '+monthLabel+', '+countDate(day)+' registos':'Fora do mês'} onClick={()=>day&&setListDay(new Date(listYear,listMonth,day))}>
          {day||''}{day&&<><span className="day-indicators">
            {ipData.guards.some(g=>g.date===localDay(new Date(listYear,listMonth,day))&&g.kind==='BT')&&<i className="guard-indicator bt" title="Prevenção BT"/>}
            {ipData.guards.some(g=>g.date===localDay(new Date(listYear,listMonth,day))&&g.kind==='CC')&&<i className="guard-indicator cc" title="Prevenção CC"/>}
            {(monthGroups[dateKey(new Date(listYear,listMonth,day))]||[]).some(e=>e.fromGoogle)&&<i className="guard-indicator google" title="Evento Google Calendar"/>}
            {(monthGroups[dateKey(new Date(listYear,listMonth,day))]||[]).some(e=>!e.fromGoogle&&!e.fromIP)&&<i className="guard-indicator other" title="Compromisso RJP"/>}
          </span>{countDate(day)>0&&<span className="day-count">{countDate(day)}</span>}</>}</button>)}
       </div>
      </div>
      <div className="guard-calendar-legend"><span><i className="guard-indicator google"/> Google</span><span><i className="guard-indicator bt"/> Prevenção BT</span><span><i className="guard-indicator cc"/> Prevenção CC</span><span><i className="guard-indicator other"/> RJP</span></div>
      <div className="section-heading"><h2>{listDay.toLocaleDateString('pt-PT',{day:'numeric',month:'long'})}</h2>{connected&&<button className="text-button" onClick={()=>refreshGoogle()}><RefreshCw size={16}/> Atualizar</button>}</div>
      {dayRows.length?dayRows.map(i=><Card key={i.id} item={i} onToggle={toggleDone} onEdit={edit} onDelete={remove} onOpenIP={openProfessional} onSyncGoogle={syncOneGoogle}/>):<div className="empty compact">Sem registos neste dia.</div>}
      <button className="outline-full" onClick={()=>{prepare();setDraft(prev=>({...prev,kind:'evento',when:localDateTime(new Date(listDay.getFullYear(),listDay.getMonth(),listDay.getDate(),9,0))}))}}><Plus size={18}/> Adicionar compromisso neste dia</button>
      <div className="section-heading"><h2>Compromissos de {monthLabel}</h2><span className="counter">{monthEvents.length}</span></div>
      {monthlyGoogle.length>0&&<p className="monthly-google-count">Google Calendar: {monthlyGoogle.length} evento(s) neste mês. Os restantes eventos consultados podem ser de meses seguintes.</p>}
      {monthEvents.length?<div className="month-events-list">
        {monthEvents.map(item=><button type="button" className="month-event-row" key={item.id} onClick={()=>{
          const key=dateKey(item.when);
          if(key)setListDay(new Date(key+'T12:00:00'));
        }}>
          <span className="month-event-date">{item.when?dateFmt(item.when,{month:'short'}):'—'}{!item.allDay&&item.when?' · '+timeFmt(item.when):''}</span>
          <span className="month-event-body"><strong>{item.title}</strong><small>{item.fromGoogle?'Google · '+(item.calendarName||'Calendário'):item.fromIP?'Gestão profissional IP' :'Agenda RJP'}</small></span>
          <ChevronRight size={15}/>
        </button>)}
      </div>:<div className="empty compact">Não existem compromissos visíveis neste mês. Experimenta mudar de mês.</div>}
    </>}
    {['deslocacoes','avisos','prevencoes','ip'].includes(tab)&&<IPWorkspace key={tab} initialSection={tab==='deslocacoes'?'trips':tab==='avisos'?'alerts':tab==='prevencoes'?'guards':'resumo'} data={ipData} reminders={items} setData={setIPData} onPersist={persistProfessional} onDelete={deleteProfessional} voiceIntent={ipVoice} onVoiceConsumed={()=>setIPVoice(null)} onImport={importProfessional} onToast={notify} googleConnected={connected}/>}
    {tab==='tarefas'&&<>
      <div className="page-intro"><div className="eyebrow">ORGANIZAÇÃO</div><h1>Tarefas</h1><p>O que falta fazer e o que já ficou resolvido.</p></div>
      <div className="search"><Search size={18}/><input aria-label="Pesquisar tarefas" placeholder="Pesquisar por assunto, pessoa ou obra…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="chips">{['Todos','Pendentes',...categories].map(f=><button key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f}</button>)}</div>
      <div className="section-heading"><h2>Tarefas registadas</h2><span className="counter">{applyFilters(items.filter(i=>i.kind==='tarefa'||i.kind==='evento')).length}</span></div>
      {applyFilters(items.filter(i=>i.kind==='tarefa'||i.kind==='evento')).sort((a,b)=>Number(a.done)-Number(b.done)||(a.when&&b.when?new Date(a.when)-new Date(b.when):a.when?-1:b.when?1:0)).map(i=><Card key={i.id} item={i} onToggle={toggleDone} onEdit={edit} onDelete={remove} onOpenIP={openProfessional} onSyncGoogle={syncOneGoogle}/>)}
      {applyFilters(items.filter(i=>i.kind==='tarefa'||i.kind==='evento')).length===0&&<div className="empty compact">Nenhuma tarefa encontrada.</div>}
      <button className="outline-full" onClick={()=>prepare()}><Plus size={18}/> Adicionar tarefa</button>
    </>}
    {tab==='notas'&&<>
      <div className="page-intro"><div className="eyebrow">APONTAMENTOS</div><h1>Notas</h1><p>Informações ditadas ou escritas, sempre à mão.</p></div>
      <div className="search"><Search size={18}/><input aria-label="Pesquisar notas" placeholder="Pesquisar nas notas…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      {items.filter(i=>i.kind==='nota'&&`${i.title} ${i.details||''}`.toLocaleLowerCase('pt-PT').includes(search.toLocaleLowerCase('pt-PT'))).map(i=><Card key={i.id} item={i} onToggle={toggleDone} onEdit={edit} onDelete={remove} onOpenIP={openProfessional} onSyncGoogle={syncOneGoogle}/>)}
      {items.filter(i=>i.kind==='nota').length===0&&<div className="empty"><StickyNote size={25}/><strong>As tuas notas vão aparecer aqui</strong><p>Fala ou escreve aquilo de que precisas de te lembrar.</p></div>}
      <button className="outline-full" onClick={()=>{prepare();setDraft(prev=>({...prev,kind:'nota'}))}}><Plus size={18}/> Nova nota</button>
    </>}
    {tab==='definicoes'&&<>
      <div className="page-intro"><div className="eyebrow">PERSONALIZAÇÃO</div><h1>Definições</h1><p>Notificações, Google Calendar e segurança dos dados.</p></div>
      <div className="settings-card"><div className="settings-title"><Cloud size={21}/><h2>Google Calendar</h2>{connected&&<span className="connected-pill">Ligado</span>}</div>
       <p>Mostra eventos do teu calendário e permite adicionar compromissos após confirmação. A ligação exige credenciais OAuth do teu próprio projeto Google Cloud.</p>
       {connected?<><div className="account">{account}</div>
        <p className="fineprint">Os eventos criados na Agenda RJP não são enviados por defeito sem a tua escolha. O destino é o calendário principal da conta acima.</p>
        <div className="setting-line"><span>Tarefas/compromissos por enviar</span><strong>{googlePending.length}</strong></div>
        <button type="button" className="primary-action stretch" disabled={busy||googlePending.length===0} onClick={syncPendingGoogle}><Cloud size={16}/> Enviar {googlePending.length} compromisso(s) para o Google</button>
        <label className="toggle-line"><span><strong>Enviar automaticamente novos compromissos</strong><small>Quando a conta está ligada, pré-seleciona «Adicionar ao Google Calendar» nas novas tarefas e reuniões. Podes desmarcar antes de guardar. Não inclui notas ou módulos IP.</small></span>
          <input type="checkbox" checked={autoGoogleNew} onChange={e=>{const yes=e.target.checked;setAutoGoogleNew(yes);localStorage.setItem('agenda-rjp-google-auto-new',yes?'1':'0')}}/></label>
        {googleWriteStatus&&<p role="status" className="fineprint"><strong>Envio Google:</strong> {googleWriteStatus}</p>}
        <div className="setting-line"><span>Eventos lidos</span><strong>{googleCalendarInfo.loading?'A atualizar…':googleCalendarInfo.count}</strong></div>
        <div className="setting-line"><span>Calendários encontrados</span><strong>{googleCalendarInfo.calendars.length}</strong></div>
        {googleCalendarInfo.calendars.length>0&&<p className="fineprint">Calendários: {googleCalendarInfo.calendars.map(x=>x.summary||'Sem nome').join(' · ')}</p>}
        {googleCalendarInfo.warning&&<p role="status" className="fineprint">{googleCalendarInfo.warning}</p>}
        {googleCalendarInfo.error&&<p role="alert" className="fineprint">Erro ao consultar os calendários: {googleCalendarInfo.error}</p>}
        <div className="settings-row"><button className="primary-action" onClick={()=>refreshGoogle()}><RefreshCw size={16}/> Atualizar agenda</button><button onClick={googleDisconnect} className="light-action">Desligar</button></div></>:<>
        <label className="field-label" htmlFor="google-client">Client ID Web (Google OAuth)</label>
        <input id="google-client" className="text-field" placeholder="…apps.googleusercontent.com" value={clientId} onChange={e=>{setClientId(e.target.value);setGoogleError('');localStorage.setItem('rjp-daily-google-client-id',e.target.value)}}/>
        <button type="button" className="light-action" onClick={()=>{setClientId(DEFAULT_GOOGLE_WEB_CLIENT_ID);setGoogleError('');localStorage.setItem('rjp-daily-google-client-id',DEFAULT_GOOGLE_WEB_CLIENT_ID)}}>Usar Client ID Agenda RJP</button>
        <button onClick={googleConnect} disabled={busy||!clientId.trim()} className="primary-action stretch"><Cloud size={17}/> {busy?'A ligar…':'Ligar conta Google'}</button>
        {googleError&&<div role="alert" className="fineprint"><strong>Diagnóstico de ligação:</strong> {googleError}<p>Confirma a SHA-1 da APK instalada, o pacote pt.rjp.daily e os utilizadores de teste do Google Cloud. Se não resolver, envia uma imagem desta mensagem (sem tokens ou Client Secret).</p></div>}
        <p className="fineprint">Configuração única: no Google Cloud, ativa a Calendar API e cria clientes OAuth Web e Android. Usa o <b>Client ID Web</b> aqui na app. No cliente Android, indica <b>pt.rjp.daily</b> e a impressão digital SHA-1 da APK instalada.</p>
        <p className="fineprint">Na versão de testes v1.1.5 que disponibilizámos, a SHA-1 é <code>13:11:9C:DD:39:F6:BB:7C:DD:D3:93:32:33:74:89:76:44:B9:5C:E5</code>. Se instalaste outra APK, a assinatura pode ser diferente.</p>
        <p className="fineprint">Para a WebApp publicada em GitHub Pages, autoriza a origem JavaScript <code>https://ruijpedro.github.io</code>. Se usares outro domínio, adiciona essa origem.</p>
        <p className="fineprint"><a href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener noreferrer">Abrir clientes OAuth Google Cloud</a> · <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer">Ativar Google Calendar API</a> · <a href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noopener noreferrer">Adicionar conta de teste</a></p>
       </>}
      </div>
      <div className="settings-card">
        <div className="settings-title"><CalendarDays size={21}/><h2>Widgets do ecrã inicial</h2></div>
        <p>Na APK Android com widgets nativos, podes adicionar «Agenda RJP · Compacto» (2×2) e «Agenda RJP · Completo» (4×3) no ecrã inicial. Mantém premido um espaço vazio no ecrã inicial, escolhe Widgets e procura Agenda RJP.</p>
        <p className="fineprint">Mostram os últimos compromissos sincronizados, incluindo os do Google Calendar, quando a conta estiver autorizada. Atualizam quando abres a app ou alteras registos; com a app fechada o Android pode atualizar a apresentação periodicamente a partir dos últimos dados guardados.</p>
        <button type="button" className="light-action" onClick={async()=>{const ok=await syncAgendaWidget(visibleAll,connected);notify(ok?'Conteúdo dos widgets atualizado.':'Os widgets exigem a próxima APK nativa; não estão disponíveis nesta instalação.')}}><RefreshCw size={16}/> Atualizar widgets</button>
      </div>
      <div className="settings-card"><div className="settings-title"><Bell size={21}/><h2>Notificações Android</h2></div>
       <p>Os avisos, incluindo os de deslocações e prevenções, são agendados localmente na APK. A precisão depende das permissões de notificações e de alarmes do Android.</p>
       <div className="setting-line"><span>Notificações</span><span className="setting-value">{permissions.status==='granted'?'Autorizadas':permissions.status==='browser'?'WebApp':permissions.status||'Por autorizar'}</span></div>
       {permissions.native&&<div className="setting-line"><span>Alarmes exatos</span><span className="setting-value">{permissions.exact||'Por verificar'}</span></div>}
       <div className="settings-row"><button className="light-action" onClick={usePermissions}><ShieldCheck size={16}/> Permitir avisos</button>{permissions.native&&<button className="light-action" onClick={requestExactSetting}><Clock3 size={16}/> Alarmes exatos</button>}</div>
       <label className="toggle-line"><span><strong>Resumo diário · 08h00</strong><small>Notificação para consultar a agenda do dia (Android)</small></span><input type="checkbox" checked={dailySummary} onChange={toggleSummary}/></label>
      </div>
      <div className="settings-card"><div className="settings-title"><RefreshCw size={21}/><h2>Atualização OTA</h2></div>
       <p>Na APK Android, a app procura versões novas automaticamente ao abrir e quando regressas à aplicação. Descarrega-as sem precisares de carregar num botão; serão ativadas depois de fechares e voltares a abrir. As notas, prevenções e deslocações não são apagadas.</p>
       <div className="setting-line"><span>Versão da app</span><span className="setting-value">{APP_VERSION}</span></div>
       <div className="setting-line"><span>Estado</span><span className="setting-value" role="status">{otaStatus.message||'Por verificar'}</span></div>
       <button type="button" className="light-action" disabled={otaStatus.type==='checking'||otaStatus.type==='downloading'} onClick={()=>{void checkForOta({force:true,onStatus:setOtaStatus})}}><RefreshCw size={16}/> Verificar atualização</button>
       <p className="fineprint">OTA atualiza a agenda, interface e correções Web automaticamente. A base Android com widgets e atalhos (1.1.14) recebe as futuras atualizações compatíveis. Alterações a widgets, permissões, plugins nativos ou assinatura exigem uma nova APK. O repositório de distribuição GitHub tem de ser público e possuir uma release OTA válida. Na WebApp usa-se a publicação web.</p>
      </div>
      <div className="settings-card"><div className="settings-title"><Download size={21}/><h2>Cópia de segurança</h2></div>
       <p>Backup completo: notas, tarefas, compromissos locais, deslocações, prevenções, atividades e viaturas. Os eventos Google são consultados na conta Google.</p>
       <div className="settings-row"><button type="button" className="light-action" disabled={backupBusy} onClick={exportCompleteBackup}><Download size={16}/> Exportar JSON completo</button><label className="light-action"><Upload size={16}/> Importar ficheiro<input ref={fileInput} type="file" style={{position:'absolute',width:1,height:1,opacity:0}} accept={Capacitor.isNativePlatform()?'*/*':'.json,application/json'} onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(file)await importBackup(file);input.value='';}}/></label></div>
       <p className="fineprint">No Android, escolhe Drive ou outra app para guardar o ficheiro na janela de partilha. Se o seletor não abrir, usa Colar JSON.</p>
       <div className="settings-row"><button type="button" className="light-action" onClick={()=>{setBackupMode('export');setBackupText(JSON.stringify(makeBackup(items,ipData),null,2));}}><Copy size={16}/> Mostrar JSON</button><button type="button" className="light-action" onClick={()=>{setBackupMode('import');setBackupText('');setBackupDraft(null);}}>Colar JSON</button></div>
       {backupMode&&<div><textarea className="text-field" rows={6} aria-label="Conteúdo JSON" value={backupText} readOnly={backupMode==='export'} onChange={e=>setBackupText(e.target.value)} placeholder="Cola aqui o conteúdo do backup JSON"/>
        <div className="settings-row">{backupMode==='import'?<button type="button" className="light-action" onClick={previewBackupText}>Validar JSON</button>:<button type="button" className="light-action" onClick={async()=>{try{await navigator.clipboard.writeText(backupText);notify('JSON copiado.');}catch{notify('Seleciona o texto e copia manualmente.');}}}>Copiar JSON</button>}<button type="button" className="light-action" onClick={()=>{setBackupMode('');setBackupText('');}}>Fechar</button></div></div>}
       {backupDraft&&<div role="status" className="info-note"><div><strong>Confirmar importação</strong><p>{backupDraft.items?.length||0} registos de agenda · {backupDraft.ip?backupDraft.ip.trips.length+backupDraft.ip.guards.length+backupDraft.ip.activities.length:0} registos profissionais.</p><p>Os IDs coincidentes serão atualizados. Os outros registos serão mantidos.</p><div className="settings-row"><button type="button" className="primary-action" disabled={backupBusy} onClick={applyBackup}>Confirmar importação</button><button type="button" className="light-action" onClick={()=>setBackupDraft(null)}>Cancelar</button></div></div></div>}
      </div>
      <div className="info-note"><Info size={18}/><p>Versão {APP_VERSION} · Português de Portugal. A análise dos comandos de voz é local à aplicação; o reconhecimento pode depender dos serviços de voz do dispositivo. A WebApp necessita de estar aberta para avisos do navegador.</p></div>
    </>}
   </main>
   <nav className="bottom-nav" aria-label="Navegação principal">
    {NAV.map(({id,icon:I,text})=><button key={id} onClick={()=>{setTab(id);setSearch('');setFilter('Todos')}} className={tab===id?'active':''}><I size={22} strokeWidth={tab===id?2.4:1.8}/><span>{text}</span></button>)}
   </nav>
   <button className="floating" aria-label="Criar nota ou tarefa por voz" title="Falar para criar" onClick={startVoice}><Mic size={23}/></button>
   {toast&&<div role="status" className="toast"><Info size={17}/>{toast}<button aria-label="Fechar aviso" onClick={()=>setToast('')}><X size={16}/></button></div>}
   {modal==='voice'&&<div className="modal-backdrop"><section className="modal voice-modal" role="dialog" aria-modal="true" aria-label="Ditar nota ou tarefa">
     <button className="modal-x" aria-label="Fechar" onClick={async()=>{await stopVoice();setModal(null)}}><X size={21}/></button>
     <div className="voice-big"><Mic size={35}/></div><h2>{listening?'Estou a ouvir…':'O que disseste?'}</h2>
     <p className="voice-instruction">Diz: «Amanhã ligar ao Eng.º Marco Silva às 15h30» ou «Regista deslocação de Leiria para Coimbra amanhã às 8h» ou «Marca prevenção BT próxima sexta». </p>
     <textarea className="voice-transcript" rows={4} value={speechText} onChange={e=>{speechRef.current=e.target.value;setSpeechText(e.target.value)}} placeholder="O texto reconhecido aparece aqui. Também podes corrigir manualmente." />
     <div className="modal-bottom"><button className="light-action" onClick={listening?stopVoice:startVoice}>{listening?<><MicOff size={17}/> Parar</>:<><Mic size={17}/> Voltar a falar</>}</button><button className="primary-action" onClick={finishVoice}><Check size={17}/> Interpretar</button></div>
   </section></div>}
   {modal==='editor'&&<div className="modal-backdrop"><section className="modal edit-modal" role="dialog" aria-modal="true" aria-label="Editar registo">
     <div className="modal-head"><div><div className="eyebrow">CONFIRMAR REGISTO</div><h2>{originalItem?'Editar registo':'Novo registo'}</h2></div><button aria-label="Fechar" onClick={()=>setModal(null)}><X size={21}/></button></div>
     <label className="field-label">Tipo</label><div className="type-tabs">{['tarefa','evento','nota'].map(k=><button key={k} className={draft.kind===k?'chosen':''} onClick={()=>setDraft(p=>({...p,kind:k,when:k==='nota'?'':p.when,addToGoogle:k==='nota'?false:p.addToGoogle}))}>{kindLabels[k]}</button>)}</div>
     <label className="field-label" htmlFor="draft-title">Assunto</label><input id="draft-title" className="text-field" autoFocus placeholder="O que precisas de fazer?" value={draft.title} onChange={e=>updateDraft('title',e.target.value)}/>
     <label className="field-label" htmlFor="draft-details">Descrição / notas (opcional)</label><textarea id="draft-details" className="text-field" rows={3} placeholder="Informações adicionais…" value={draft.details||''} onChange={e=>updateDraft('details',e.target.value)}/>
     <label className="field-label" htmlFor="draft-cat">Categoria</label><select id="draft-cat" className="text-field" value={draft.category} onChange={e=>updateDraft('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select>
     {draft.kind!=='nota'&&<><label className="field-label" htmlFor="draft-when">Data e hora do aviso</label><input id="draft-when" type="datetime-local" className="text-field" value={draft.when||''} onChange={e=>updateDraft('when',e.target.value)}/>
       {draft.suggestedHour&&<p className="suggested"><Info size={15}/> Hora das 09h00 sugerida. Confirma ou altera.</p>}
       <label className="toggle-line google-check"><span><strong>Adicionar ao Google Calendar</strong><small>Envia o assunto e a descrição para a conta Google ligada.</small></span><input type="checkbox" checked={Boolean(draft.addToGoogle)} onChange={e=>updateDraft('addToGoogle',e.target.checked)}/></label>
      </>}
     {draft.original&&<p className="original-text">Ditado: “{draft.original}”</p>}
     <div className="modal-bottom"><button className="light-action" onClick={()=>setModal(null)}>Cancelar</button><button className="primary-action" disabled={busy} onClick={commit}>{busy?<Loader2 size={17} className="spin"/>:<Check size={17}/>} Guardar</button></div>
   </section></div>}
 </div>;
}
export default App;
