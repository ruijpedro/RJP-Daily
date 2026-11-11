import {calendarDayKey,calendarItemDays} from './calendar-view.js';
const dayUTC=key=>new Date(key+'T12:00:00Z');
export const addWeekDays=(key,n)=>{const d=dayUTC(key);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function isoWeek(input=new Date()){
 const key=calendarDayKey(input);
 const d=dayUTC(key), weekday=(d.getUTCDay()+6)%7;
 const monday=addWeekDays(key,-weekday);
 const thursday=dayUTC(addWeekDays(key,3-weekday));
 const year=thursday.getUTCFullYear();
 const first=new Date(Date.UTC(year,0,4,12));
 const firstMonday=addWeekDays(first.toISOString().slice(0,10),-((first.getUTCDay()+6)%7));
 const week=Math.floor((dayUTC(monday)-dayUTC(firstMonday))/604800000)+1;
 return {year,week,start:monday,end:addWeekDays(monday,6),days:Array.from({length:7},(_,i)=>addWeekDays(monday,i))};
}
export function weekCalendarDays(items,reference=new Date()){
 const w=isoWeek(reference),days=Object.fromEntries(w.days.map(d=>[d,[]]));
 for(const item of items||[]){
  if(!item?.when||item.done||item.kind==='nota')continue;
  for(const key of calendarItemDays(item))if(days[key])days[key].push(item);
 }
 for(const day of w.days)days[day].sort((a,b)=>Number(!a.allDay)-Number(!b.allDay)||new Date(a.when)-new Date(b.when));
 return {...w,groups:days};
}
