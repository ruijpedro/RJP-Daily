// Avisos da gestão IP e lembretes locais associados: a hora adiada prevalece.
export function professionalAlerts(data,items,now=new Date()){
 const linked=new Map((items||[]).filter(x=>x.linkedIPId).map(x=>[x.linkedIPType+':'+x.linkedIPId,x]));
 return ['trips','guards','activities'].flatMap(type=>(data?.[type]||[]).flatMap(record=>{
  const item=linked.get(type+':'+record.id);
  const when=item?.when||record.reminderAt;
  if(!when||!Number.isFinite(new Date(when).getTime()))return [];
  return [{type,record,item,when,title:type==='trips'?'Deslocação: '+(record.from||'Origem')+' → '+(record.to||'Destino'):type==='guards'?'Prevenção '+record.kind:(record.type||'Atividade')+' · '+(record.place||'IP'),status:item?.done?'Concluído':new Date(when)>now?'Futuro':'Hora passada'}];
 })).sort((a,b)=>new Date(a.when)-new Date(b.when));
}

export const professionalAlertDay=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
export function summarizeProfessionalAlerts(alerts,now=new Date()){
 const dateKey=professionalAlertDay;
 const today=dateKey(now);
 return {pending:alerts.filter(a=>a.status!=='Concluído').length,today:alerts.filter(a=>a.status!=='Concluído'&&dateKey(a.when)===today).length,overdue:alerts.filter(a=>a.status==='Hora passada').length,completed:alerts.filter(a=>a.status==='Concluído').length};
}
export function changeProfessionalAlert(alert,action,now=new Date(),notificationId){
 const current=alert.item;
 const item={...current,id:current?.id||'ip-alert:'+alert.record.id,linkedIPId:alert.record.id,linkedIPType:alert.type,kind:'tarefa',title:alert.title,category:'Trabalho',notificationId:current?.notificationId||alert.record.notificationId||notificationId,when:alert.when,done:false};
 if(action==='done')return {...item,done:true};
 if(action==='snooze')return {...item,when:new Date(now.getTime()+10*60000).toISOString()};
 if(action==='reopen')return {...item,done:false};
 throw new Error('Ação de aviso desconhecida.');
}
