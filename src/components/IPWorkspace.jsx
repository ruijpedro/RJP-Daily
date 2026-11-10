import React,{useEffect,useMemo,useRef,useState} from 'react';
import {BriefcaseBusiness,CarFront,ShieldCheck,ClipboardCheck,ChartColumn,Plus,Trash2,Copy,Edit3,FileDown,Download,Upload,Save,Clock3,CalendarDays,X,Search,Check,Settings2,MapPin,Star} from 'lucide-react';
import {localDateTime} from '../logic/parse.js';
import {activeTrip,startQuickTrip,finishQuickTrip,elapsedTripMinutes,tripDaySummary,tripMinutes,correctQuickTrip} from '../ip/quick-trip.js';
import {localDay,newId,durationMinutes,minsText,getDefaultVehiclePlate} from '../ip/model.js';
import {exportIPCSV,exportIPXLSX,exportIPPDF,exportIPJSON} from '../ip/reports.js';
import {professionalAlerts,summarizeProfessionalAlerts,professionalAlertDay} from '../logic/professional-alerts.js';
import {BellRing} from 'lucide-react';

const labels={trips:'Deslocações',guards:'Prevenções BT/CC',activities:'Atividades'};
const actions=[{key:'resumo',label:'Resumo',Icon:ChartColumn},{key:'trips',label:'Deslocações',Icon:CarFront},{key:'alerts',label:'Avisos IP',Icon:BellRing},{key:'guards',label:'Prevenções',Icon:ShieldCheck},{key:'activities',label:'Atividades',Icon:ClipboardCheck},{key:'vehicles',label:'Viaturas',Icon:Settings2},{key:'reports',label:'Relatórios',Icon:FileDown}];
const emptyForm=(type,data)=>type==='trips'?{date:localDay(),from:data.places[0]||'',to:data.places[1]||'',vehiclePlate:getDefaultVehiclePlate(data),out:'08:00',in:'',activity:'',notes:'',reminderAt:'',addToGoogle:false}:type==='guards'?{date:localDay(),kind:'BT',start:'',end:'',notes:'',reminderAt:'',addToGoogle:false}:{date:localDay(),type:data.activityTypes[0]||'Outro',place:data.places[0]||'',start:'09:00',end:'',notes:'',reminderAt:'',addToGoogle:false};
const toMonth=x=>String(x.date||'').slice(0,7);
const dateLabel=x=>{try{return new Date(`${x.date}T12:00:00`).toLocaleDateString('pt-PT',{day:'2-digit',month:'short'})}catch{return x.date}};
const formTime=(date,time)=>date&&time?`${date}T${time}`:'';
function Field({label,children}){return <label className="ip-field"><span>{label}</span>{children}</label>}
function Input({field,form,update,...p}){return <input className="text-field" value={form[field]??''} onChange={e=>update(field,e.target.value)} {...p}/>}
function ProfessionalList({type,records,onEdit,onDelete,onDuplicate,query}){
 const list=records.filter(r=>JSON.stringify(r).toLocaleLowerCase('pt-PT').includes(query.toLocaleLowerCase('pt-PT'))).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 return <div className="ip-records">{list.length?list.map(r=><div className="ip-record" key={r.id}>
  <div className="ip-record-icon">{type==='trips'?<CarFront size={19}/>:type==='guards'?<ShieldCheck size={19}/>:<ClipboardCheck size={19}/>}</div>
  <div className="ip-record-body"><b>{type==='trips'?`${r.from} → ${r.to}`:type==='guards'?<><span className={`guard-type ${String(r.kind).toLowerCase()}`}>{r.kind}</span> Prevenção {r.kind}</>:`${r.type||'Atividade'}`}</b>
   <small>{dateLabel(r)} · {type==='trips'?`${r.vehiclePlate||'Sem viatura'} · ${r.out||'--:--'}–${r.in||'--:--'}`:type==='guards'?`${r.start||'Sem hora definida'}${r.end?'–'+r.end:''}`:`${r.place||'Local por definir'} · ${r.start||'--:--'}–${r.end||'--:--'}`}</small>
   {(r.activity||r.notes)&&<p>{[r.activity,r.notes].filter(Boolean).join(' · ')}</p>}
   <div className="ip-tags">{type==='trips'&&r.quickStartedAt&&!r.in&&<span><Clock3 size={11}/> Em curso</span>}{r.reminderAt&&<span> <Clock3 size={11}/> Lembrete</span>}{r.googleEventId&&<span><CalendarDays size={11}/> Google</span>}</div>
  </div>
  <div className="ip-record-actions"><button title="Editar" onClick={()=>onEdit(type,r)}><Edit3 size={17}/></button><button title="Duplicar" onClick={()=>onDuplicate(type,r)}><Copy size={16}/></button><button title="Eliminar" className="danger" onClick={()=>onDelete(type,r)}><Trash2 size={16}/></button></div>
 </div>):<div className="empty compact">Ainda não existem registos neste período.</div>}</div>;
}
export default function IPWorkspace({initialSection='resumo',data,reminders=[],onAlertAction,setData,onPersist,onDelete,voiceIntent,onVoiceConsumed,onImport,onToast,googleConnected}){
 const [section,setSection]=useState(initialSection);
 const [guardFilter,setGuardFilter]=useState('Todas');
 const [alertFilter,setAlertFilter]=useState('Pendentes');
 const [alertClock,setAlertClock]=useState(()=>new Date());
 useEffect(()=>{const id=setInterval(()=>setAlertClock(new Date()),30000);return()=>clearInterval(id);},[]);
 const alerts=professionalAlerts(data,reminders,alertClock);
 const counts=summarizeProfessionalAlerts(alerts,alertClock);
 const [alertType,setAlertType]=useState('all');
 const [alertSearch,setAlertSearch]=useState('');
 const [alertBusy,setAlertBusy]=useState('');
 const visibleAlerts=alerts.filter(x=>(alertType==='all'||x.type===alertType)&&x.title.toLocaleLowerCase('pt-PT').includes(alertSearch.toLocaleLowerCase('pt-PT').trim())&&(alertFilter==='Todos'||(alertFilter==='Hoje'&&x.status!=='Concluído'&&professionalAlertDay(x.when)===professionalAlertDay(alertClock))||(alertFilter==='Pendentes'&&x.status!=='Concluído')||(alertFilter==='Futuros'&&x.status==='Futuro')||(alertFilter==='Hora passada'&&x.status==='Hora passada')||(alertFilter==='Concluídos'&&x.status==='Concluído')));
 async function alertAction(x,action){if(alertBusy)return;setAlertBusy(x.type+':'+x.record.id);try{await onAlertAction?.(x,action);}finally{setAlertBusy('');}}
 const [month,setMonth]=useState(()=>localDay().slice(0,7));
 const [search,setSearch]=useState('');
 const [formType,setFormType]=useState(null);
 const [form,setForm]=useState({});
 const [editing,setEditing]=useState(null);
 const [saving,setSaving]=useState(false);
 const [quickOpen,setQuickOpen]=useState(false);
 const [quickBusy,setQuickBusy]=useState(false);
 const quickLock=useRef(false);
 const [quickNow,setQuickNow]=useState(()=>new Date());
 const [quickForm,setQuickForm]=useState(()=>({from:data.places[0]||'',to:data.places[1]||'',vehiclePlate:getDefaultVehiclePlate(data),activity:''}));
 const runningTrip=activeTrip(data.trips);
 const todayTrips=tripDaySummary(data.trips,localDay(quickNow));
 const todayActivities=data.activities.filter(x=>x.date===localDay(quickNow));
 useEffect(()=>{const tick=()=>setQuickNow(new Date());tick();const id=setInterval(tick,runningTrip?1000:30000);return()=>clearInterval(id);},[runningTrip?.id]);
 async function beginTrip(e){
  e.preventDefault();if(quickLock.current||runningTrip)return;quickLock.current=true;setQuickBusy(true);
  try{const record=startQuickTrip(quickForm,new Date(),newId());await onPersist('trips',record);setQuickOpen(false);setMonth(record.date.slice(0,7));setSection('trips');}
  catch(e){onToast('Não foi possível iniciar: '+e.message);}finally{quickLock.current=false;setQuickBusy(false);}
 }
 async function endTrip(){
  if(quickLock.current||!runningTrip)return;quickLock.current=true;setQuickBusy(true);
  try{const record=finishQuickTrip(runningTrip,new Date());await onPersist('trips',record,runningTrip);setMonth(record.date.slice(0,7));onToast('Deslocação terminada · '+minsText(tripMinutes(record)));}
  catch(e){onToast('Não foi possível terminar: '+e.message);}finally{quickLock.current=false;setQuickBusy(false);}
 }
 const [carDraft,setCarDraft]=useState({plate:'',brand:'',model:'',color:'Branco',type:'Viatura de serviço',active:true});
 const [editingVehicle,setEditingVehicle]=useState(null);
 const importRef=useRef(null);
 const lists=useMemo(()=>Object.fromEntries(['trips','guards','activities'].map(key=>[key,data[key].filter(r=>toMonth(r)===month)])),[data,month]);
 const bt=lists.guards.filter(g=>g.kind==='BT').length,cc=lists.guards.filter(g=>g.kind==='CC').length;
 const tripHours=minsText(lists.trips.reduce((sum,r)=>sum+tripMinutes(r),0));
 const actHours=minsText(lists.activities.reduce((sum,r)=>sum+durationMinutes(r.start,r.end),0));
 const update=(k,v)=>setForm(p=>({...p,[k]:v}));
 const open=(type,record=null,prefill=null)=>{
  const v={...emptyForm(type,data),...(record||{}),...(prefill||{})};
  if(v.reminderAt&&Number.isFinite(new Date(v.reminderAt).getTime()))v.reminderAt=localDateTime(new Date(v.reminderAt));
  // No ditado sem matrícula explícita, não substituir a viatura preferida por texto vazio.
  if(type==='trips'&&!record&&!v.vehiclePlate)v.vehiclePlate=getDefaultVehiclePlate(data);
  // Não criar um novo evento Google por simples duplicação de registo.
  if(prefill&&!record){v.googleEventId=null;v.addToGoogle=false;v.reminderAt='';}
  setForm(v);setFormType(type);setEditing(record);setSection(type);
  if(v.date)setMonth(v.date.slice(0,7));
 };
 useEffect(()=>{if(!voiceIntent)return;open(voiceIntent.type,null,voiceIntent.form);onVoiceConsumed?.();},[voiceIntent]);
 const duplicate=(type,record)=>open(type,null,{...record,id:undefined,date:localDay(),googleEventId:null,notificationId:null,quickStartedAt:undefined,quickFinishedAt:undefined,reminderAt:'',addToGoogle:false});
 async function submit(e){
  e.preventDefault();
  if(!form.date){onToast('Escolhe a data.');return;}
  if(formType==='trips'&&(!form.from.trim()||!form.to.trim())){onToast('Indica origem e destino.');return;}
  if(formType==='guards'&&!['BT','CC'].includes(form.kind)){onToast('O tipo de prevenção tem de ser BT ou CC.');return;}
  if(form.reminderAt&&new Date(form.reminderAt).getTime()!==new Date(editing?.reminderAt||'').getTime()&&new Date(form.reminderAt)<=new Date()){onToast('O lembrete tem de ser futuro.');return;}
  setSaving(true);
  try{
   const record={...form,...(editing||{}),...form,id:editing?.id||newId(),createdAt:editing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
   const corrected=formType==='trips'?correctQuickTrip(record,editing):record;
   if(formType==='trips'&&corrected.quickStartedAt&&!corrected.in&&runningTrip&&runningTrip.id!==corrected.id)throw new Error('Termina primeiro a deslocação em curso.');
   await onPersist(formType,corrected,editing);setFormType(null);
  }catch(err){onToast(`Não foi possível guardar: ${err.message}`)}finally{setSaving(false)}
 }
 const payload={month,profile:data.profile,...lists};
 const runExport=async fn=>{try{await fn();}catch(e){onToast('Falha a exportar/partilhar: '+e.message)}};
 function updateVehicles(callback){setData(prev=>{
  const vehicles=callback(prev.vehicles);
  const isDefaultActive=vehicles.some(v=>v.plate===prev.defaultVehiclePlate&&v.active!==false);
  const defaultVehiclePlate=isDefaultActive?prev.defaultVehiclePlate:(vehicles.find(v=>v.active!==false)?.plate||'');
  return {...prev,vehicles,defaultVehiclePlate};
 });}
 const makeDefault=(plate)=>{setData(prev=>({...prev,defaultVehiclePlate:plate}));onToast('Matrícula por defeito guardada: '+plate);};
 function saveVehicle(e){e.preventDefault();const plate=carDraft.plate.trim().toUpperCase();if(!plate)return;
  if(data.vehicles.some(v=>v.plate===plate&&v.id!==editingVehicle)){onToast('Esta matrícula já está registada.');return;}
  // A preferência acompanha a alteração de matrícula da viatura seleccionada.
  const previous=data.vehicles.find(v=>v.id===editingVehicle);
  const wasDefault=previous?.plate===data.defaultVehiclePlate;
  setData(prev=>{
   const vehicles=editingVehicle?prev.vehicles.map(v=>v.id===editingVehicle?{...v,...carDraft,plate}:v):[...prev.vehicles,{...carDraft,plate,id:newId()}];
   return {...prev,vehicles,defaultVehiclePlate:wasDefault?plate:(getDefaultVehiclePlate(prev)||plate)};
  });
  setCarDraft({plate:'',brand:'',model:'',color:'Branco',type:'Viatura de serviço',active:true});setEditingVehicle(null);onToast('Viatura guardada.');
 }
 const recordsTotal=lists.trips.length+lists.guards.length+lists.activities.length;
 return <>
 <div className="page-intro"><div className="eyebrow">GESTÃO PROFISSIONAL · IP_RJP</div><h1>{initialSection==='trips'?'Deslocações de serviço':initialSection==='alerts'?'Notificações profissionais':initialSection==='guards'?'Prevenções BT / CC':'Gestão profissional'}</h1><p>{initialSection==='trips'?'Regista viagens de serviço, horários, viaturas e lembretes.':initialSection==='alerts'?'Consulta os avisos de deslocações, prevenções BT/CC e atividades, e abre os registos associados.':initialSection==='guards'?'Registos por dia, tipo BT/CC, observações, histórico e relatórios.':'Registos de serviço, atividades, viaturas e relatórios num só local.'}</p></div>
 {section!=='alerts'&&<div className="ip-month-row"><label htmlFor="ip-month">Mês de referência</label><input id="ip-month" type="month" value={month} onChange={e=>setMonth(e.target.value||localDay().slice(0,7))}/></div>}
 <div className="ip-section-tabs">{actions.map(({key,label,Icon})=><button key={key} className={section===key?'active':''} onClick={()=>setSection(key)}><Icon size={16}/>{label}</button>)}</div>
 {['resumo','trips'].includes(section)&&<div className="quick-trip-panel">
  <div className="quick-trip-heading"><CarFront size={23}/><div><strong>{runningTrip?'Deslocação em curso':'Deslocações rápidas'}</strong><small>{runningTrip?'Registo guardado no telemóvel':'Regista a saída e chegada automaticamente'}</small></div></div>
  {runningTrip?<><div className="quick-trip-route"><b>{runningTrip.from} → {runningTrip.to}</b><small>{runningTrip.vehiclePlate||'Sem viatura'} · Saída {runningTrip.out} · {runningTrip.date}</small></div><div className="quick-trip-timer"><Clock3 size={22}/><strong>{minsText(elapsedTripMinutes(runningTrip,quickNow))}</strong><small>Tempo decorrido</small></div><div className="quick-trip-buttons"><button type="button" className="primary-action" disabled={quickBusy} onClick={endTrip}><Check size={18}/> Terminar viagem</button><button type="button" className="light-action" onClick={()=>open('trips',runningTrip)}><Edit3 size={16}/> Corrigir</button></div></>:<>
   {!quickOpen?<button type="button" className="primary-action quick-trip-start" onClick={()=>{setQuickForm({from:data.places[0]||'',to:data.places[1]||'',vehiclePlate:getDefaultVehiclePlate(data),activity:''});setQuickOpen(true);}}><CarFront size={19}/> Iniciar deslocação</button>:<form onSubmit={beginTrip} className="quick-trip-form">
    <div className="ip-form-grid"><Field label="Origem"><input className="text-field" list="quick-trip-places" required value={quickForm.from} onChange={e=>setQuickForm(v=>({...v,from:e.target.value}))}/></Field><Field label="Destino"><input className="text-field" list="quick-trip-places" required value={quickForm.to} onChange={e=>setQuickForm(v=>({...v,to:e.target.value}))}/></Field><Field label="Viatura"><input className="text-field" list="quick-trip-vehicles" value={quickForm.vehiclePlate} onChange={e=>setQuickForm(v=>({...v,vehiclePlate:e.target.value.toUpperCase()}))}/></Field><Field label="Motivo (opcional)"><input className="text-field" value={quickForm.activity} onChange={e=>setQuickForm(v=>({...v,activity:e.target.value}))}/></Field></div>
    <datalist id="quick-trip-places">{data.places.map(v=><option key={v} value={v}/>)}</datalist><datalist id="quick-trip-vehicles">{data.vehicles.filter(v=>v.active!==false).map(v=><option key={v.id} value={v.plate}/>)}</datalist><div className="quick-trip-buttons"><button className="primary-action" type="submit" disabled={quickBusy}><Check size={17}/> Registar saída agora</button><button className="light-action" type="button" onClick={()=>setQuickOpen(false)}>Cancelar</button></div>
   </form>}
  </>}
  <div className="quick-trip-summary"><span>Hoje <b>{todayTrips.count} viagens</b></span><span>Terminadas <b>{todayTrips.finished}</b></span><span>Tempo <b>{minsText(todayTrips.minutes)}</b></span></div>
 </div>}
 {section==='resumo'&&<>
   <div className="settings-card"><div className="settings-title"><ClipboardCheck size={20}/><h2>Diário profissional de hoje</h2></div><div className="setting-line"><span>Atividades registadas</span><span className="setting-value">{todayActivities.length}</span></div><div className="setting-line"><span>Prevenções BT/CC</span><span className="setting-value">{data.guards.filter(x=>x.date===localDay(quickNow)).length}</span></div><button className="primary-action" onClick={()=>open('activities',null,{date:localDay(),start:new Date().toTimeString().slice(0,5)})}><Plus size={16}/> Nova atividade</button>{todayActivities.length>0&&<ProfessionalList type="activities" records={todayActivities} onEdit={open} onDelete={onDelete} onDuplicate={duplicate} query=""/>}</div>
   <div className="ip-stat-grid">
     {[{n:lists.trips.length,t:'Deslocações',Icon:CarFront,key:'trips'},{n:bt,t:'Prevenções BT',Icon:ShieldCheck,key:'guards'},{n:cc,t:'Prevenções CC',Icon:ShieldCheck,key:'guards'},{n:lists.activities.length,t:'Atividades',Icon:ClipboardCheck,key:'activities'}].map(({n,t,Icon,key})=><button key={t} onClick={()=>setSection(key)} className="ip-stat"><Icon size={21}/><strong>{n}</strong><small>{t}</small></button>)}
   </div>
   <div className="settings-card"><div className="settings-title"><ChartColumn size={20}/><h2>Resumo mensal</h2></div><div className="setting-line"><span>Total de registos</span><span className="setting-value">{recordsTotal}</span></div><div className="setting-line"><span>Tempo em deslocações</span><span className="setting-value">{tripHours}</span></div><div className="setting-line"><span>Tempo em atividades</span><span className="setting-value">{actHours}</span></div><p className="fineprint">Durações apuradas pelas horas introduzidas. Não representam automaticamente valores de abonos.</p></div>
   <div className="section-heading"><h2>Adicionar registo</h2></div><div className="ip-shortcuts"><button onClick={()=>open('trips')}><CarFront/> Deslocação</button><button onClick={()=>open('guards')}><ShieldCheck/> Prevenção BT/CC</button><button onClick={()=>open('activities')}><ClipboardCheck/> Atividade</button></div>
   <div className="settings-card"><div className="settings-title"><CalendarDays size={20}/><h2>Agenda integrada</h2></div><p>Cada registo profissional também aparece na agenda geral. Os lembretes podem criar notificações Android e os eventos escolhidos podem ser enviados para o Google Calendar.</p></div>
 </>}
 {section==='guards'&&<div className="guard-quick-panel">
   <div className="guard-quick-intro"><ShieldCheck size={20}/><strong>Nova prevenção</strong><span>Seleciona o tipo para preencher o registo.</span></div>
   <div className="guard-quick-buttons"><button type="button" onClick={()=>open('guards',null,{kind:'BT'})}><span className="guard-type bt">BT</span> Registar prevenção BT</button><button type="button" onClick={()=>open('guards',null,{kind:'CC'})}><span className="guard-type cc">CC</span> Registar prevenção CC</button></div>
   <div className="guard-counts"><span>Este mês: <b>{lists.guards.length}</b></span><span>BT: <b>{bt}</b></span><span>CC: <b>{cc}</b></span></div>
  </div>}
 {section==='alerts'&&<>
  <div className="ip-topline"><h2>Avisos profissionais</h2><button className="primary-action" onClick={()=>open('trips')}><Plus size={16}/> Nova deslocação</button></div>
  <div className="ip-alert-stats">{[{n:counts.pending,t:'Pendentes',filter:'Pendentes'},{n:counts.today,t:'Hoje',filter:'Hoje'},{n:counts.overdue,t:'Em atraso',filter:'Hora passada'},{n:counts.completed,t:'Concluídos',filter:'Concluídos'}].map(x=><button type="button" key={x.t} onClick={()=>{setAlertFilter(x.filter);setAlertType('all');setAlertSearch('');}}><strong>{x.n}</strong><small>{x.t}</small></button>)}</div>
  <div className="guard-filter" aria-label="Filtrar avisos">{['Pendentes','Hoje','Futuros','Hora passada','Concluídos','Todos'].map(k=><button type="button" key={k} aria-pressed={alertFilter===k} className={alertFilter===k?'active':''} onClick={()=>setAlertFilter(k)}>{k}</button>)}</div>
  <div className="guard-filter" aria-label="Tipo de aviso">{[['all','Todos os tipos'],['trips','Deslocações'],['guards','Prevenções'],['activities','Atividades']].map(([k,label])=><button type="button" key={k} aria-pressed={alertType===k} className={alertType===k?'active':''} onClick={()=>setAlertType(k)}>{label}</button>)}</div>
  <div className="search"><Search size={18}/><input aria-label="Pesquisar avisos IP" value={alertSearch} onChange={e=>setAlertSearch(e.target.value)} placeholder="Pesquisar origem, destino ou aviso…"/></div>
  <p className="fineprint">Todos os meses · {visibleAlerts.length} avisos. Os estados representam lembretes registados, não comprovam entrega Android.</p>
  <div className="ip-records">{visibleAlerts.map(x=><div className="ip-alert-card" key={x.type+':'+x.record.id}>
    <div className="ip-record"><div className="ip-record-icon"><BellRing size={19}/></div><div className="ip-record-body"><b>{x.title}</b><small>{new Date(x.when).toLocaleString('pt-PT',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})} · {x.status}</small><div className="ip-tags"><span>{labels[x.type]}</span></div></div></div>
    <div className="ip-alert-actions"><button type="button" disabled={!!alertBusy} onClick={()=>open(x.type,x.record)}><Edit3 size={15}/> Abrir</button>{x.status==='Concluído'?<button type="button" disabled={!!alertBusy} onClick={()=>alertAction(x,'reopen')}>Reabrir</button>:<><button type="button" disabled={!!alertBusy} onClick={()=>alertAction(x,'snooze')}><Clock3 size={15}/> +10 min</button><button type="button" disabled={!!alertBusy} onClick={()=>alertAction(x,'done')}><Check size={15}/> Concluir</button></>}</div>
  </div>)}
  {!visibleAlerts.length&&<div className="empty compact">Não há avisos neste filtro. Define um lembrete ao criar ou editar um registo profissional.</div>}</div>
 </>}
 {['trips','guards','activities'].includes(section)&&<>
   <div className="ip-topline"><h2>{labels[section]}</h2><button className="primary-action" onClick={()=>open(section)}><Plus size={16}/> {section==='trips'?'Nova deslocação':'Novo registo'}</button></div>
   <div className="search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar registos deste mês…"/></div>
   {section==='guards'&&<div className="guard-filter" aria-label="Filtrar por tipo de prevenção">{['Todas','BT','CC'].map(k=><button type="button" key={k} aria-pressed={guardFilter===k} className={guardFilter===k?'active':''} onClick={()=>setGuardFilter(k)}>{k}</button>)}</div>}
   <ProfessionalList type={section} records={section==='guards'?lists.guards.filter(g=>guardFilter==='Todas'||g.kind===guardFilter):lists[section]} onEdit={open} onDelete={onDelete} onDuplicate={duplicate} query={search}/>
 </>}
 {section==='vehicles'&&<>
  <div className="ip-topline"><h2>Viaturas de serviço</h2></div>
  <p className="fineprint">A matrícula por defeito aparece automaticamente em cada nova deslocação e pode ser alterada no próprio registo. A preferência fica guardada no telemóvel.</p>
  {data.vehicles.map(v=><div className="ip-vehicle" key={v.id}><CarFront size={21}/><div><b>{v.plate}{getDefaultVehiclePlate(data)===v.plate?' · Por defeito':''}</b><small>{`${v.brand||''} ${v.model||''}`.trim()} · {v.type||'Viatura'} · {v.color||''}</small></div><button type="button" disabled={getDefaultVehiclePlate(data)===v.plate||v.active===false} className="ip-default-button" aria-label={`Definir ${v.plate} como viatura por defeito`} onClick={()=>makeDefault(v.plate)}><Star size={14}/>{getDefaultVehiclePlate(data)===v.plate?'Principal':'Definir'}</button><button aria-label="Editar viatura" onClick={()=>{setCarDraft({...v});setEditingVehicle(v.id)}}><Edit3 size={16}/></button><button className="danger" aria-label="Apagar viatura" onClick={()=>{if(window.confirm('Eliminar viatura da lista? As deslocações históricas ficam preservadas.'))updateVehicles(a=>a.filter(x=>x.id!==v.id))}}><Trash2 size={16}/></button></div>)}
  <form className="settings-card ip-form" onSubmit={saveVehicle}><div className="settings-title"><CarFront size={20}/><h2>{editingVehicle?'Editar viatura':'Adicionar viatura'}</h2></div>
   <div className="ip-form-grid"><Field label="Matrícula"><input required className="text-field" value={carDraft.plate} onChange={e=>setCarDraft(p=>({...p,plate:e.target.value}))} placeholder="00-AA-00"/></Field><Field label="Marca"><input className="text-field" value={carDraft.brand} onChange={e=>setCarDraft(p=>({...p,brand:e.target.value}))}/></Field><Field label="Modelo"><input className="text-field" value={carDraft.model} onChange={e=>setCarDraft(p=>({...p,model:e.target.value}))}/></Field><Field label="Tipo"><input className="text-field" value={carDraft.type} onChange={e=>setCarDraft(p=>({...p,type:e.target.value}))}/></Field><Field label="Cor"><input className="text-field" value={carDraft.color} onChange={e=>setCarDraft(p=>({...p,color:e.target.value}))}/></Field></div>
   <button className="primary-action" type="submit"><Save size={17}/> Guardar viatura</button>{editingVehicle&&<button type="button" className="light-action" onClick={()=>{setEditingVehicle(null);setCarDraft({plate:'',brand:'',model:'',color:'Branco',type:'Viatura de serviço',active:true})}}>Cancelar edição</button>}
  </form>
  <div className="settings-card"><div className="settings-title"><MapPin size={20}/><h2>Locais habituais e atividades</h2></div><p>Uma opção por linha. Estes locais aparecem como sugestões nas deslocações e atividades.</p><Field label="Locais"><textarea className="text-field" rows={5} value={data.places.join('\n')} onChange={e=>setData(prev=>({...prev,places:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)}))}/></Field><Field label="Tipos de atividade"><textarea className="text-field" rows={5} value={data.activityTypes.join('\n')} onChange={e=>setData(prev=>({...prev,activityTypes:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)}))}/></Field></div>
 </>}
 {section==='reports'&&<>
  <div className="settings-card"><div className="settings-title"><FileDown size={21}/><h2>Relatórios de {month}</h2></div><p>Exportação mensal das deslocações, prevenções BT/CC e atividades, para arquivo, impressão e apoio à conferência de abonos.</p>
   <div className="ip-report-buttons"><button onClick={()=>runExport(()=>exportIPPDF(payload))}><FileDown size={19}/> PDF</button><button onClick={()=>runExport(()=>exportIPCSV(payload))}><Download size={19}/> CSV</button><button onClick={()=>runExport(()=>exportIPXLSX(payload))}><Download size={19}/> Excel (.xlsx)</button></div>
   <p className="fineprint">Estes relatórios são registos auxiliares e não substituem formulários oficiais da IP.</p>
  </div>
  <div className="settings-card"><div className="settings-title"><Save size={21}/><h2>Histórico e migração IP_RJP</h2></div><p>Exporta a base profissional completa ou importa um backup JSON da antiga IP_RJP. A importação permite conservar deslocações, prevenções, atividades, viaturas e destinos.</p><div className="settings-row"><button className="light-action" onClick={()=>runExport(()=>exportIPJSON(data))}><Download size={16}/> Backup profissional</button><button className="light-action" onClick={()=>importRef.current?.click()}><Upload size={16}/> Importar IP_RJP</button></div>
   <input ref={importRef} type="file" accept="*/*" hidden onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(file)await onImport(file);input.value='';}}/>
  </div>
 </>}
 {formType&&<div className="modal-backdrop"><form className="modal ip-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label={`Registar ${labels[formType]}`}>
  <div className="modal-head"><div><div className="eyebrow">{editing?'EDITAR':'CONFIRMAR NOVO'} REGISTO</div><h2>{formType==='trips'?'Deslocação':formType==='guards'?'Prevenção BT/CC':'Atividade profissional'}</h2></div><button type="button" aria-label="Fechar" onClick={()=>setFormType(null)}><X size={20}/></button></div>
  <div className="ip-form-grid"><Field label="Data"><Input field="date" form={form} update={update} type="date" required/></Field>
  {formType==='trips'&&<>
   <Field label="Escolher matrícula"><div className="ip-plate-list" role="group" aria-label="Viatura para esta deslocação">{data.vehicles.filter(v=>v.active!==false).map(v=><button type="button" key={v.id} aria-pressed={form.vehiclePlate===v.plate} className={`ip-plate-option ${form.vehiclePlate===v.plate?'selected':''}`} onClick={()=>update('vehiclePlate',v.plate)}><CarFront size={16}/><span><b>{v.plate}</b><small>{[v.brand,v.model].filter(Boolean).join(' ')}</small></span>{form.vehiclePlate===v.plate&&<Check size={15}/>}</button>)}</div><input className="text-field" list="ip-vehicles" value={form.vehiclePlate||''} onChange={e=>update('vehiclePlate',e.target.value.toUpperCase())} placeholder="Ou escrever outra matrícula"/><datalist id="ip-vehicles">{data.vehicles.map(v=><option value={v.plate} key={v.id}>{v.brand} {v.model}</option>)}</datalist><small className="fineprint">Pré-selecionada: {getDefaultVehiclePlate(data)||'nenhuma'}. A escolha nesta deslocação não altera a viatura por defeito.</small></Field>
   <Field label="Origem"><input required className="text-field" list="ip-places" value={form.from||''} onChange={e=>update('from',e.target.value)}/></Field>
   <Field label="Destino"><input required className="text-field" list="ip-places" value={form.to||''} onChange={e=>update('to',e.target.value)}/></Field>
   <Field label="Hora de saída"><Input field="out" form={form} update={update} type="time"/></Field><Field label="Hora de chegada"><Input field="in" form={form} update={update} type="time"/></Field>
   <Field label="Atividade associada"><Input field="activity" form={form} update={update} placeholder="Visita de obra, vistoria…"/></Field>
  </>}
  {formType==='guards'&&<><p className="guard-help">Tal como na antiga IP_RJP, apenas a data, o tipo (BT/CC) e as observações são necessários. As horas e os avisos são opcionais.</p><Field label="Tipo de prevenção"><select className="text-field" value={form.kind} onChange={e=>update('kind',e.target.value)}><option value="BT">BT</option><option value="CC">CC</option></select></Field><Field label="Início (opcional)"><Input field="start" form={form} update={update} type="time"/></Field><Field label="Fim (opcional)"><Input field="end" form={form} update={update} type="time"/></Field></>}
  {formType==='activities'&&<><Field label="Tipo de atividade"><input list="ip-activities" className="text-field" value={form.type||''} onChange={e=>update('type',e.target.value)}/><datalist id="ip-activities">{data.activityTypes.map(x=><option key={x} value={x}/>)}</datalist></Field><Field label="Local"><input list="ip-places" className="text-field" value={form.place||''} onChange={e=>update('place',e.target.value)}/></Field><Field label="Hora de início"><Input field="start" form={form} update={update} type="time"/></Field><Field label="Hora de fim"><Input field="end" form={form} update={update} type="time"/></Field></>}
  </div><datalist id="ip-places">{data.places.map(p=><option value={p} key={p}/>)}</datalist>
  <Field label="Observações"><textarea className="text-field" rows={3} value={form.notes||''} onChange={e=>update('notes',e.target.value)} placeholder="Notas da deslocação, empreitada, atividade…"/></Field>
  <div className="ip-reminder-box">{formType==='guards'&&<div className="guard-reminder-presets"><strong>Lembrar-me da prevenção</strong><div><button type="button" onClick={()=>{const v=`${form.date}T08:00`;if(new Date(v)<=new Date()){onToast('Essa hora já passou. Escolhe uma data/hora futura.');return;}update('reminderAt',v)}}>No próprio dia · 08h00</button><button type="button" onClick={()=>{const d=new Date(`${form.date}T12:00:00`);if(!Number.isFinite(d.getTime()))return;d.setDate(d.getDate()-1);const v=`${localDay(d)}T18:00`;if(new Date(v)<=new Date()){onToast('Esse aviso já seria passado. Escolhe outra data/hora.');return;}update('reminderAt',v)}}>Na véspera · 18h00</button><button type="button" onClick={()=>update('reminderAt','')}>Sem aviso</button></div></div>}<Field label="Notificação (opcional)"><Input field="reminderAt" form={form} update={update} type="datetime-local"/></Field><p>Se definires uma data/hora futura, a APK agenda um aviso local.</p>
   <label className="toggle-line"><span><strong>Adicionar ao Google Calendar</strong><small>Envia o registo após confirmação e autorização Google{googleConnected?'':' (ainda não ligada)'}. </small></span><input type="checkbox" checked={Boolean(form.addToGoogle)} onChange={e=>update('addToGoogle',e.target.checked)}/></label></div>
  <div className="modal-bottom"><button type="button" className="light-action" onClick={()=>setFormType(null)}>Cancelar</button><button className="primary-action" disabled={saving} type="submit"><Check size={17}/>{saving?'A guardar…':'Guardar registo'}</button></div>
 </form></div>}
 </>;
}
