import {Capacitor,registerPlugin} from '@capacitor/core';
import {agendaWidgetEvents} from '../logic/widget-events.js';

// O plugin é criado pelo build Android, não existe nas APK anteriores nem na WebApp.
// Quando ausente, a agenda continua funcional e a sincronização do widget é ignorada.
const NativeWidget=registerPlugin('AgendaWidget');
export async function syncAgendaWidget(items,googleConnected=false){
  if(Capacitor.getPlatform()!=='android')return false;
  try{
    await NativeWidget.update({events:agendaWidgetEvents(items),retainGoogle:!googleConnected});
    return true;
  }catch{return false;}
}
export async function clearAgendaWidgetGoogle(){
  if(Capacitor.getPlatform()!=='android')return;
  try{await NativeWidget.clearGoogle();}catch{}
}
