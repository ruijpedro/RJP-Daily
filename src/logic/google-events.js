/** Lógica independente do SDK Google, testável sem autenticação. */
const dateObj=iso=>({dateTime:new Date(iso).toISOString(),timeZone:'Europe/Lisbon'});
export function googleEventPayload(item){
  if(!item?.when || Number.isNaN(new Date(item.when).getTime()))throw new Error('O evento necessita de data e hora válidas.');
  const start=new Date(item.when);
  const end=new Date(start.getTime()+(item.kind==='evento'?60:15)*60000);
  return {summary:item.title,description:`Criado pela RJP Daily.\n${item.details||''}`,
    start:dateObj(start),end:dateObj(end)};
}
export function normalizeGoogleEvents(events){
  return (Array.isArray(events)?events:[]).filter(e=>e?.status!=='cancelled').map(e=>({
    id:'google:'+e.id,googleEventId:e.id,kind:'evento',title:e.summary||'(Sem título)',
    details:e.description||'',when:e.start?.dateTime||e.start?.date||'',
    fromGoogle:true,allDay:!e.start?.dateTime
  }));
}
