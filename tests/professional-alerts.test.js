import test from 'node:test';
import assert from 'node:assert/strict';
import {professionalAlerts} from '../src/logic/professional-alerts.js';
const data={trips:[{id:'t',from:'Leiria',to:'Caldas',reminderAt:'2026-11-10T10:00:00Z'}],guards:[{id:'g',kind:'BT',reminderAt:'2026-11-10T08:00:00Z'}],activities:[{id:'a',type:'Visita'}]};
test('avisos IP incluem apenas registos com hora válida, refletem adiamento e conclusão',()=>{
 const items=[{linkedIPId:'t',linkedIPType:'trips',when:'2026-11-10T11:00:00Z'},{linkedIPId:'g',linkedIPType:'guards',when:'2026-11-10T08:00:00Z',done:true}];
 const x=professionalAlerts(data,items,new Date('2026-11-10T09:00:00Z'));
 assert.deepEqual(x.map(y=>[y.type,y.status,y.when]),[['guards','Concluído','2026-11-10T08:00:00Z'],['trips','Futuro','2026-11-10T11:00:00Z']]);
});
test('aviso sem tarefa associada mantém hora profissional e não afirma entrega',()=>{const x=professionalAlerts(data,[],new Date('2026-11-10T12:00:00Z'));assert.deepEqual(x.map(y=>y.status),['Hora passada','Hora passada']);});
