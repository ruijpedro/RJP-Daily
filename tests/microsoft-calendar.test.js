import test from 'node:test';import assert from 'node:assert/strict';
import {microsoftUTC,normalizeMicrosoftEvents} from '../src/logic/microsoft-calendar.js';
test('datas UTC do Outlook são interpretadas sem deslocar para outro fuso',()=>{
 assert.equal(microsoftUTC('2026-11-11T09:30:00.0000000'),'2026-11-11T09:30:00.000Z');
});
test('Outlook corporate é apenas leitura e não inclui corpo nem contactos',()=>{
 const cal={id:'one',summary:'Corporate',accountEmail:'corporate@example.com'};
 const [e]=normalizeMicrosoftEvents([{id:'evt1',subject:'Reunião',body:{content:'Privado'},start:{dateTime:'2026-11-11T09:00:00'},end:{dateTime:'2026-11-11T10:00:00'}}],cal);
 assert.equal(e.fromMicrosoft,true);assert.equal(e.category,'Trabalho');
 assert.deepEqual(Object.keys(e).includes('body'),false);
 assert.equal(e.when,'2026-11-11T09:00:00Z');
 assert.equal(e.sourceAccount,'corporate@example.com');
});
test('eventos de dia inteiro do Outlook preservam data civil',()=>{
 const [e]=normalizeMicrosoftEvents([{id:'a',isAllDay:true,start:{dateTime:'2026-11-11T00:00:00'},end:{dateTime:'2026-11-12T00:00:00'}}],{id:'x',summary:'Trabalho',accountEmail:'corporate@example.com'});
 assert.equal(e.when,'2026-11-11');assert.equal(e.end,'2026-11-12');
});
