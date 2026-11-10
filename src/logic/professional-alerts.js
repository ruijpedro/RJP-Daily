// Avisos da gestão IP e lembretes locais associados: a hora adiada prevalece.
export function professionalAlerts(data,items,now=new Date()){
 const linked=new Map((items||[]).filter(x=>x.linkedIPId).map(x=>[x.linkedIPType+':'+x.linkedIPId,x]));
 return ['trips','guards','activities'].flatMap(type=>(data?.[type]||[]).flatMap(record=>{
  const item=linked.get(type+':'+record.id);
  const when=item?.when||record.reminderAt;
  if(!when||!Number.isFinite(new Date(when).getTime()))return [];
  return [{type,record,when,title:type==='trips'?'Deslocação: '+(record.from||'Origem')+' → '+(record.to||'Destino'):type==='guards'?'Prevenção '+record.kind:(record.type||'Atividade')+' · '+(record.place||'IP'),status:item?.done?'Concluído':new Date(when)>now?'Futuro':'Hora passada'}];
 })).sort((a,b)=>new Date(a.when)-new Date(b.when));
}
