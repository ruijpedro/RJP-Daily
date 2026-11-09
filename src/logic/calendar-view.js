/** Datas e grupos da agenda da RJP Daily (fuso Europe/Lisbon). */
const ZONE='Europe/Lisbon';
const DAY=/^\d{4}-\d{2}-\d{2}$/;

export function calendarDayKey(input){
  if(typeof input==='string' && DAY.test(input))return input; // Google: dia inteiro (sem conversão UTC).
  const d=input instanceof Date?input:new Date(input);
  if(Number.isNaN(d.getTime()))return '';
  const p=Object.fromEntries(
    new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'})
      .formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
}

function addDays(dateKey,amount){
  const t=new Date(dateKey+'T12:00:00Z');
  t.setUTCDate(t.getUTCDate()+amount);
  return t.toISOString().slice(0,10);
}
export function calendarItemDays(item){
  const first=calendarDayKey(item?.when);
  if(!first)return [];
  const rawEnd=item?.end;
  if(!rawEnd)return [first];
  let last;
  if(item.allDay && typeof rawEnd==='string' && DAY.test(rawEnd)){
    last=addDays(rawEnd,-1); // Google end.date é exclusivo.
  }else{
    const end=new Date(rawEnd);
    if(Number.isNaN(end.getTime()))return [first];
    last=calendarDayKey(new Date(end.getTime()-1)); // end exclusivo nos eventos com hora.
  }
  if(!last || last<first)return [first];
  const days=[];
  for(let date=first;date<=last&&days.length<60;date=addDays(date,1))days.push(date);
  return days.length?days:[first];
}
export function groupCalendarMonth(items,year,monthZero){
  const prefix=String(year)+'-'+String(monthZero+1).padStart(2,'0')+'-';
  const grouped={};
  for(const item of Array.isArray(items)?items:[]){
    if(!item?.when)continue;
    for(const date of calendarItemDays(item)){
      if(!date.startsWith(prefix))continue;
      (grouped[date]??=[]).push(item);
    }
  }
  return grouped;
}
export function monthCalendarItems(grouped){
  const seen=new Set();
  const result=[];
  for(const key of Object.keys(grouped||{}).sort()){
    for(const item of grouped[key]){
      const id=item.id||JSON.stringify([item.title,item.when,item.calendarId]);
      if(!seen.has(id)){seen.add(id);result.push(item);}
    }
  }
  return result;
}
export function safeCalendarName(name){
  const cleaned=String(name||'').replace(/https?:\/\/[^\s]+/gi,'').replace(/\b(?:authtoken|access_token|token|key|signature)\s*[=:]\s*[^\s&]+/gi,'[oculto]').replace(/\s*[·—-]\s*$/,'').trim();
  return cleaned||'Calendário subscrito';
}
