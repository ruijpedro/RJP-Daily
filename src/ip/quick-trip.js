import {localDay,durationMinutes} from './model.js';
const clock=d=>new Date(d).toTimeString().slice(0,5);
export const activeTrip=trips=>(trips||[]).find(t=>t.quickStartedAt&&!t.quickFinishedAt&&!t.in)||null;
export function startQuickTrip(values,now=new Date(),id){
 const from=String(values.from||'').trim(),to=String(values.to||'').trim();
 if(!from||!to)throw new Error('Indica origem e destino.');
 if(!id)throw new Error('Identificador em falta.');
 return {id,date:localDay(now),from,to,vehiclePlate:values.vehiclePlate||'',out:clock(now),in:'',activity:values.activity||'',notes:'',reminderAt:'',addToGoogle:false,quickStartedAt:now.toISOString(),createdAt:now.toISOString(),updatedAt:now.toISOString()};
}
export function finishQuickTrip(trip,now=new Date()){
 if(!trip?.quickStartedAt||trip.quickFinishedAt||trip.in)throw new Error('Não existe uma deslocação em curso.');
 if(now.getTime()<new Date(trip.quickStartedAt).getTime())throw new Error('A chegada não pode anteceder a saída.');
 return {...trip,in:clock(now),quickFinishedAt:now.toISOString(),updatedAt:now.toISOString()};
}
export function elapsedTripMinutes(trip,now=new Date()){
 if(!trip?.quickStartedAt)return 0;
 const elapsed=new Date(trip.quickFinishedAt||now).getTime()-new Date(trip.quickStartedAt).getTime();
 return Number.isFinite(elapsed)?Math.max(0,Math.floor(elapsed/60000)):0;
}
export function tripMinutes(trip){
 if(!trip.in)return 0;
 if(trip.quickStartedAt&&trip.quickFinishedAt&&localDay(trip.quickStartedAt)===trip.date&&clock(trip.quickStartedAt)===trip.out&&clock(trip.quickFinishedAt)===trip.in)return elapsedTripMinutes(trip);
 return durationMinutes(trip.out,trip.in);
}
export function correctQuickTrip(record,previous,now=new Date()){
 if(!previous?.quickStartedAt)return record;
 const next={...record};
 if(record.date!==previous.date||record.out!==previous.out){
  const start=new Date(record.date+'T'+record.out);
  if(!Number.isFinite(start.getTime()))throw new Error('Indica uma hora de saída válida.');
  if(!record.in&&start>now)throw new Error('A saída de uma viagem em curso não pode ser futura.');
  next.quickStartedAt=start.toISOString();
 }
 if(record.in!==previous.in||record.date!==previous.date||record.out!==previous.out){
  if(record.in){
   const end=new Date(record.date+'T'+record.in);
   const start=new Date(next.quickStartedAt);
   if(end<start)end.setDate(end.getDate()+1);
   next.quickFinishedAt=end.toISOString();
  }else{delete next.quickFinishedAt;}
 }
 return next;
}
export function tripDaySummary(trips,day=localDay()){
 const rows=(trips||[]).filter(t=>t.date===day);
 return {count:rows.length,finished:rows.filter(t=>t.in).length,minutes:rows.reduce((n,t)=>n+tripMinutes(t),0)};
}
