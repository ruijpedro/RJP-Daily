import test from 'node:test';
import assert from 'node:assert/strict';
import {isoWeek,addWeekDays,weekCalendarDays} from '../src/logic/week-planner.js';
test('Semana ISO 46 de 2026 decorre de segunda 9 a domingo 15 novembro',()=>{
 const w=isoWeek('2026-11-11');assert.deepEqual([w.year,w.week,w.start,w.end],[2026,46,'2026-11-09','2026-11-15']);
});
test('Mudança de ano usa semana ISO e ano correto',()=>{
 const w=isoWeek('2027-01-01');assert.deepEqual([w.year,w.week,w.start,w.end],[2026,53,'2026-12-28','2027-01-03']);
 assert.equal(isoWeek('2027-01-04').week,1);
});
test('Semana 48 e dias Google de vários dias',()=>{
 const w=weekCalendarDays([{id:'1',when:'2026-11-27T10:00:00Z',title:'Reunião'}, {id:'2',when:'2026-11-29',end:'2026-12-02',allDay:true,title:'Obra'}], '2026-11-26');
 assert.equal(w.week,48);assert.equal(w.start,'2026-11-23');assert.equal(w.end,'2026-11-29');
 assert.equal(w.groups['2026-11-29'].length,1);
 assert.equal(addWeekDays('2026-12-31',1),'2027-01-01');
});
