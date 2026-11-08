import test from 'node:test';
import assert from 'node:assert/strict';
import {clone, normalizeIP, makeProfessionalAgenda, parseIPVoice, asIPBackup, importIPBackup} from '../src/ip/model.js';

test('Prevenções antigas BT/CC mantêm data, tipo e observações, sem exigir horário',()=>{
  const d=clone(); d.guards=[{id:'antiga-bt',date:'2026-11-09',kind:'BT',notes:'Prevenção de serviço'}, {id:'antiga-cc',date:'2026-11-10',kind:'CC',notes:'Linha do Oeste'}];
  const saved=normalizeIP(d);
  assert.deepEqual(saved.guards.map(x=>x.kind),['BT','CC']);
  assert.equal(saved.guards[1].notes,'Linha do Oeste');
  const agenda=makeProfessionalAgenda(saved).filter(x=>x.linkedType==='guards');
  assert.equal(agenda.length,2);assert.equal(agenda[0].allDay,true);assert.equal(agenda[1].allDay,true);
});
test('Ditado para prevenção CC dá formulário correto sem criar horas artificiais',()=>{
  const i=parseIPVoice('Marca prevenção CC amanhã', new Date(2026,10,8,18,0));
  assert.equal(i.type,'guards');assert.equal(i.form.kind,'CC');assert.equal(i.form.date,'2026-11-09');assert.equal(i.form.start,'');
});
test('Importar backup anterior conserva históricos de prevenções e viaturas',async()=>{
  const old=clone();old.guards=[{id:'old',kind:'BT',date:'2026-07-16',notes:'Plantão'}];
  const file={text:async()=>JSON.stringify(old)};
  const imported=await importIPBackup(file);
  assert.equal(imported.guards[0].id,'old');assert.equal(imported.guards[0].notes,'Plantão');
  assert.equal(imported.vehicles.length,3);
  assert.equal(asIPBackup(imported).ip.guards.length,1);
});
