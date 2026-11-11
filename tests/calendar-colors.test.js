import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarPresentation,prioritySort,calendarChoices} from '../src/logic/calendar-colors.js';
test('IP é profissional e a conta académica tem destaque',()=>{
 const ip=calendarPresentation({fromIP:true});assert.equal(ip.role,'profissional');
 const academic=calendarPresentation({fromGoogle:true,calendarName:'IPL',sourceAccount:'aluno@example.com',calendarId:'2'});
 assert.equal(academic.role,'academico');
});
test('cores específicas e categoria editável por conta/calendário',()=>{
 const event={fromGoogle:true,sourceAccount:'u@example.com',calendarId:'work'};
 const preferences={'google:u@example.com:work':{role:'academico',color:'#123ABC'}};
 assert.equal(calendarPresentation(event,preferences).color,'#123ABC');
 assert.equal(calendarPresentation(event,preferences).priority,1);
 assert.equal(calendarPresentation(event,{'google:u@example.com:work':{color:'url(unsafe)'}}).color,'#8B5CF6');
});
test('destaque profissional e académico antes do pessoal',()=>{
 const records=[{when:'2026-11-11T08:00:00Z',category:'Pessoal'},{when:'2026-11-11T09:00:00Z',fromIP:true},{when:'2026-11-11T10:00:00Z',fromGoogle:true,calendarName:'Universidade'}];
 records.sort((a,b)=>prioritySort(a,b));
 assert.deepEqual(records.map(x=>calendarPresentation(x).role),['profissional','academico','pessoal']);
});
test('nomes de calendários e contas permanecem distintos',()=>{
 const rows=calendarChoices([{id:'one',summary:'Agenda',accountEmail:'first@example.com'},{id:'one',summary:'Agenda',accountEmail:'second@example.com'}]);
 assert.equal(rows.length,3);
});
