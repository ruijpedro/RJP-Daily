import {Capacitor,registerPlugin} from '@capacitor/core';
const Diagnostic=registerPlugin('CalendarDiagnostic');

/** Diagnostic metadata only; never reads event titles, descriptions or attendees. */
export async function calendarProviderStatus(){
  if(Capacitor.getPlatform()!=='android')return {supported:false,granted:false};
  return {supported:true,...await Diagnostic.status()};
}
export async function requestDeviceCalendarAccess(){
  if(Capacitor.getPlatform()!=='android')return {granted:false};
  return Diagnostic.requestCalendarAccess();
}
export async function listDeviceCalendars(){
  if(Capacitor.getPlatform()!=='android')throw new Error('Diagnóstico disponível apenas na APK Android.');
  return (await Diagnostic.listCalendars()).calendars||[];
}
