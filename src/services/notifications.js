import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
const native = () => Capacitor.isNativePlatform();
export async function permissionStatus() {
 if (!native()) return { native:false, status:'browser' };
 try {
  const p=await LocalNotifications.checkPermissions();
  const exact=await LocalNotifications.checkExactNotificationSetting();
  return {native:true,status:p.display,exact:exact.exact_alarm};
 } catch { return {native:true,status:'unknown',exact:'unknown'}; }
}
export async function requestNotificationPermission() {
 if (!native()) { if('Notification' in window) return (await Notification.requestPermission())==='granted'; return false; }
 const result=await LocalNotifications.requestPermissions();
 await LocalNotifications.createChannel({id:'rjp_daily_reminders',name:'Lembretes RJP Daily',description:'Tarefas e compromissos',importance:5,visibility:1});
 await LocalNotifications.registerActionTypes({types:[{id:'rjp_daily',actions:[{id:'done',title:'Concluído'},{id:'snooze',title:'Adiar 10 min'}]}]});
 return result.display==='granted';
}
export async function requestExactSetting() {
 if(!native())return;
 await LocalNotifications.changeExactNotificationSetting();
}
export async function scheduleItem(item) {
 if(!native() || !item.when || item.done || item.kind==='nota')return {scheduled:false,reason:'no-native'};
 const date=new Date(item.when);
 if(!Number.isFinite(date.getTime()) || date.getTime()<=Date.now())return {scheduled:false,reason:'past'};
 const ok=await requestNotificationPermission();
 if(!ok) return {scheduled:false,reason:'denied'};
 try {
  await LocalNotifications.schedule({ notifications:[{
   id:item.notificationId,
   title:item.kind==='evento'?'Compromisso · RJP Daily':'Lembrete · RJP Daily',
   body:item.title,
   schedule:{at:date,allowWhileIdle:true},
   channelId:'rjp_daily_reminders',
   actionTypeId:'rjp_daily',
   extra:{itemId:item.id}
  }] });
  return {scheduled:true};
 } catch (e) {return {scheduled:false,reason:e?.message||'failed'};}
}
export async function cancelItem(item) {
 if(!native() || !item?.notificationId)return;
 try{await LocalNotifications.cancel({notifications:[{id:item.notificationId}]});}catch{}
}
export async function scheduleDailySummary(hour=8) {
 if(!native())return false;
 if(!(await requestNotificationPermission()))return false;
 try {
  await LocalNotifications.cancel({notifications:[{id:2040000000}]});
  await LocalNotifications.schedule({notifications:[{
   id:2040000000,title:'Bom dia · RJP Daily',body:'Consulta a tua agenda e as tarefas pendentes de hoje.',
   channelId:'rjp_daily_reminders',schedule:{on:{hour:Number(hour),minute:0},repeats:true,allowWhileIdle:true},
  }]});
  return true;
 }catch{return false;}
}
export async function stopDailySummary(){if(native())try{await LocalNotifications.cancel({notifications:[{id:2040000000}]});}catch{}}
export async function onNotificationAction(callback){
 if(!native())return ()=>{};
 const handle=await LocalNotifications.addListener('localNotificationActionPerformed', callback);
 return ()=>handle.remove();
}
