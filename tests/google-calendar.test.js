import test from 'node:test';
import assert from 'node:assert/strict';
import {googleEventPayload,normalizeGoogleEvents} from '../src/logic/google-events.js';

test('Compromisso exportado ao Google tem início, fim e fuso Europe/Lisbon',()=>{
 const payload=googleEventPayload({title:'Ligar ao Eng.º Marco Silva',details:'Electro Campos',
   kind:'evento',when:'2026-11-09T15:30:00+00:00'});
 assert.equal(payload.summary,'Ligar ao Eng.º Marco Silva');
 assert.equal(payload.start.dateTime,'2026-11-09T15:30:00.000Z');
 assert.equal(payload.end.dateTime,'2026-11-09T16:30:00.000Z');
 assert.equal(payload.start.timeZone,'Europe/Lisbon');
});
test('Tarefa enviada para Google não é indevidamente convertida para evento de uma hora',()=>{
 const payload=googleEventPayload({title:'Verificar Auto 2',kind:'tarefa',when:'2026-11-09T09:00:00+00:00'});
 assert.equal(new Date(payload.end.dateTime)-new Date(payload.start.dateTime),15*60*1000);
});
test('Eventos de dia inteiro são apresentados sem hora inventada',()=>{
 const [event]=normalizeGoogleEvents([{id:'abc',summary:'Prevenção BT',start:{date:'2026-11-13'}}]);
 assert.equal(event.allDay,true);assert.equal(event.when,'2026-11-13');assert.equal(event.googleEventId,'abc');
});
test('Eventos cancelados não aparecem na agenda e horários válidos são respeitados',()=>{
 const result=normalizeGoogleEvents([
  {id:'1',status:'cancelled',start:{date:'2026-11-10'}},
  {id:'2',summary:'Reunião',start:{dateTime:'2026-11-09T10:00:00+00:00'}}
 ]);
 assert.equal(result.length,1);assert.equal(result[0].allDay,false);
 assert.equal(result[0].when,'2026-11-09T10:00:00+00:00');
});
test('Google não recebe evento sem data válida',()=>{
 assert.throws(()=>googleEventPayload({title:'Tarefa',kind:'tarefa',when:'errado'}));
});
