import {calendarDayKey,calendarItemDays} from './calendar-view.js';
import {isoWeek} from './week-planner.js';

const timeFormatter=new Intl.DateTimeFormat('pt-PT',{timeZone:'Europe/Lisbon',hour:'2-digit',minute:'2-digit',hour12:false});
const DATE=/^\d{4}-\d{2}-\d{2}$/;

/** Dados mínimos, sem notas, credenciais ou identificadores de contas Google. */
export function agendaWidgetEvents(items,now=new Date()){
  const today=isoWeek(now).start;
  const max=new Date(now.getTime()+28*86400000);
  const endDay=calendarDayKey(max);
  const seen=new Set();
  return (Array.isArray(items)?items:[])
    .filter(i=>i?.when && !i.done && i.kind!=='nota')
    .flatMap(i=>{
      const dates=calendarItemDays(i);
      const fullDay=Boolean(i.allDay || typeof i.when==='string'&&DATE.test(i.when));
      return dates.map((date,index)=>{
        const allDay=fullDay || index>0;
        const stamp=allDay?Date.parse(date+'T12:00:00Z'):new Date(i.when).getTime();
        if(!date||!Number.isFinite(stamp))return null;
        return {date,allDay,timestamp:stamp,
          title:String(i.title||'Compromisso').trim().slice(0,140),
          time:allDay?'':timeFormatter.format(new Date(stamp)),
          source:i.fromGoogle?'Google':i.fromIP?'IP':'RJP',
          type:i.fromGoogle?'Google':i.fromIP?(i.linkedType==='guards'?(/\bCC\b/i.test(i.title||'')?'CC':'BT'):i.linkedType==='trips'?'Deslocação':'IP'):i.kind==='tarefa'?'Tarefa':'RJP'};
      });
    })
    .filter(x=>x&&x.date>=today && x.date<=endDay && Number.isFinite(x.timestamp))
    .filter(x=>{
      const key=x.date+'|'+x.timestamp+'|'+x.title+'|'+x.source;
      if(seen.has(key))return false;
      seen.add(key);return true;
    })
    .sort((a,b)=>a.timestamp-b.timestamp)
    .slice(0,200);
}
