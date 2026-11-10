import test from 'node:test';
import assert from 'node:assert/strict';
import {agendaWidgetEvents} from '../src/logic/widget-events.js';

const now=new Date('2026-11-09T09:00:00+00:00');
test('widget mostra eventos Google, deslocações IP e tarefas por data sem notas nem concluídas',()=>{
 const list=agendaWidgetEvents([
  {id:'x',title:'Reunião pessoal',when:'2026-11-10T14:00:00Z',fromGoogle:true,kind:'evento'},
  {id:'y',title:'Deslocação a Leiria',when:'2026-11-09T13:00:00Z',fromIP:true,kind:'evento'},
  {id:'z',title:'Telefonar',when:'2026-11-11T10:00:00Z',kind:'tarefa'},
  {id:'note',title:'Segredo',when:'2026-11-09T11:00:00Z',kind:'nota'},
  {id:'done',title:'Tarefa terminada',when:'2026-11-09T12:00:00Z',kind:'tarefa',done:true},
 ],now);
 assert.deepEqual(list.map(x=>x.title),['Deslocação a Leiria','Reunião pessoal','Telefonar']);
 assert.deepEqual(list.map(x=>x.source),['IP','Google','RJP']);
 assert.equal(list[1].time,'14:00');
});
test('widget conserva eventos de dia inteiro na data sem deslocação UTC',()=>{
 const list=agendaWidgetEvents([{title:'Feriado',when:'2026-11-10',allDay:true,fromGoogle:true}],now);
 assert.equal(list[0].date,'2026-11-10');assert.equal(list[0].allDay,true);
});
test('widget não exibe conteúdo das notas pessoais nem URLs privadas no payload',()=>{
 const list=agendaWidgetEvents([{title:'Trabalho',details:'NIF e dados confidenciais',googleEventId:'SECRET',
  calendarId:'https://private.example/?auth=secret',when:'2026-11-09T13:00:00Z',kind:'evento'}],now);
 assert.equal(list.length,1);assert.deepEqual(Object.keys(list[0]).sort(),
  ['allDay','date','source','time','timestamp','title','type'].sort());
});
test('widget elimina duplicados e compromissos de datas anteriores',()=>{
 const item={title:'Treino',when:'2026-11-10T20:00:00Z',kind:'evento'};
 const list=agendaWidgetEvents([item,{...item,id:'duplicate'},{title:'Antigo',when:'2026-11-01',kind:'evento'}],now);
 assert.equal(list.length,1);assert.equal(list[0].title,'Treino');
});

test('widget distingue BT, CC, deslocações e tarefas',()=>{
 const x=agendaWidgetEvents([{title:'Prevenção BT',when:'2026-11-09',fromIP:true,linkedType:'guards'},{title:'Prevenção CC',when:'2026-11-10',fromIP:true,linkedType:'guards'},{title:'Deslocação',when:'2026-11-11',fromIP:true,linkedType:'trips'},{title:'Telefonar',when:'2026-11-12',kind:'tarefa'}],now);
 assert.deepEqual(x.map(e=>e.type),['BT','CC','Deslocação','Tarefa']);
});
