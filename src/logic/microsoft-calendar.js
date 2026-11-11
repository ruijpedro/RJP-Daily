/** Normalização isolada, sem persistência em disco e sem descrições corporativas. */
export function microsoftUTC(value){
 if(!value)return '';
 const text=String(value).replace(/(\.\d{3})\d+/,'$1');
 if(/[zZ]$|[+-]\d\d:\d\d$/.test(text))return text;
 return text+'Z'; // Prefer: outlook.timezone="UTC" no Microsoft Graph.
}
export function normalizeMicrosoftEvents(events,calendar){
 return (Array.isArray(events)?events:[]).filter(e=>e?.id&&!e.isCancelled).map(e=>{
  const start=e.start?.dateTime,finish=e.end?.dateTime;
  const allDay=Boolean(e.isAllDay);
  return {
   id:'microsoft:'+encodeURIComponent(calendar.accountEmail||'')+':'+encodeURIComponent(calendar.id)+':'+e.id,
   calendarId:calendar.id,calendarName:calendar.summary,sourceAccount:calendar.accountEmail,
   fromMicrosoft:true,kind:'evento',category:'Trabalho',title:String(e.subject||'Compromisso profissional').slice(0,160),
   when:allDay?String(start||'').slice(0,10):microsoftUTC(start),
   end:allDay?String(finish||'').slice(0,10):microsoftUTC(finish),
   allDay
  };
 }).filter(e=>e.when);
}
