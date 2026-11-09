import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDayKey,calendarItemDays,groupCalendarMonth,monthCalendarItems,safeCalendarName} from '../src/logic/calendar-view.js';
import {normalizeGoogleEvents} from '../src/logic/google-events.js';

test('Datas Google no verão são convertidas para o dia Europe/Lisbon',()=>{
  assert.equal(calendarDayKey('2026-06-01T23:30:00Z'),'2026-06-02');
});
test('Eventos de dia inteiro preservam a data literal sem passagem de fuso',()=>{
  assert.equal(calendarDayKey('2026-06-01'),'2026-06-01');
});
test('Eventos Google aparecem no mês mesmo quando filtro de tarefas estava noutra categoria',()=>{
  const items=[{id:'g1',title:'Consulta',when:'2026-11-11T10:00:00Z',fromGoogle:true,category:undefined}];
  const group=groupCalendarMonth(items,2026,10);
  assert.equal(group['2026-11-11'].length,1);
  assert.equal(monthCalendarItems(group)[0].title,'Consulta');
});
test('Evento de vários dias aparece em cada dia, excluindo o dia do fim',()=>{
  const item={id:'g2',when:'2026-11-10',end:'2026-11-13',allDay:true,fromGoogle:true};
  assert.deepEqual(calendarItemDays(item),['2026-11-10','2026-11-11','2026-11-12']);
  const group=groupCalendarMonth([item],2026,10);
  assert.equal(Object.keys(group).length,3);
  assert.equal(monthCalendarItems(group).length,1);
});
test('Os calendários em outros meses não são confundidos com o mês selecionado',()=>{
  const items=[{id:'nov',when:'2026-11-15',fromGoogle:true},{id:'dec',when:'2026-12-15',fromGoogle:true}];
  assert.deepEqual(monthCalendarItems(groupCalendarMonth(items,2026,10)).map(x=>x.id),['nov']);
});
test('Títulos de calendários subscritos não mostram URL nem token',()=>{
  const title='InfoEstudante · https://ead.example/2026/calendar/export.php?userid=123&authtoken=ABC123';
  const safe=safeCalendarName(title);
  assert.equal(safe,'InfoEstudante');
  assert.doesNotMatch(safe,/ABC123|userid|authtoken|https:/);
  assert.equal(safeCalendarName('https://ead.example/?token=x'),'Calendário subscrito');
});
test('Normalização Google conserva o fim de uma prevenção de dia inteiro',()=>{
  const [e]=normalizeGoogleEvents([{id:'evt',summary:'Prevenção BT',start:{date:'2026-11-11'},end:{date:'2026-11-12'}}],{id:'trabalho',summary:'Profissional'});
  assert.deepEqual(calendarItemDays(e),['2026-11-11']);
});
