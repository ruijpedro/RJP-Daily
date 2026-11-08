import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIPVoice,normalizeIP,makeProfessionalAgenda,durationMinutes,minsText,clone,localDay,getDefaultVehiclePlate,completeVehicleCatalog,vehicleKey} from '../src/ip/model.js';
const at=new Date(2026,10,8,16,37);
test('Reconhece deslocação profissional ditada e confirma os campos',()=>{
 const x=parseIPVoice('Regista uma deslocação de Caldas da Rainha para Coimbra amanhã às 8 horas com a viatura de matrícula 23-ZP-64',at);
 assert.equal(x.type,'trips');assert.equal(x.form.from,'Caldas da Rainha');assert.equal(x.form.to,'Coimbra');assert.equal(x.form.date,'2026-11-09');assert.equal(x.form.out,'08:00');assert.equal(x.form.vehiclePlate,'23-ZP-64');
});
test('Reconhece prevenção BT e CC por voz',()=>{
 const bt=parseIPVoice('Marca prevenção BT amanhã',at);
 const cc=parseIPVoice('Regista prevenção CC próxima sexta-feira',at);
 assert.equal(bt.type,'guards');assert.equal(bt.form.kind,'BT');assert.equal(bt.form.date,'2026-11-09');
 assert.equal(cc.type,'guards');assert.equal(cc.form.kind,'CC');assert.match(cc.form.date,/^2026-11-/);
});
test('Reconhece atividade e deixa confirmar antes de guardar',()=>{
 const x=parseIPVoice('Regista uma inspeção de edifício amanhã às 10h00',at);
 assert.equal(x.type,'activities');assert.equal(x.form.type,'Inspeção de edifício');assert.equal(x.form.start,'10:00');
});
test('Não interpreta tarefas normais como deslocações',()=>{
 assert.equal(parseIPVoice('Amanhã ligar ao engenheiro Marco Silva às 15h30',at),null);
});
test('Normaliza dados e restringe prevenções a BT e CC',()=>{
 const x=normalizeIP({...clone(),guards:[{id:'x',date:'2026-11-09',kind:'BT'},{id:'y',date:'2026-11-09',kind:'XXX'}]});
 assert.equal(x.guards.length,1);assert.equal(x.vehicles.length,3);
});
test('Registos IP aparecem na agenda e durações têm cálculo correto',()=>{
 const x=clone();x.trips=[{id:'t1',date:'2026-11-09',from:'Leiria',to:'Coimbra',out:'08:00',in:'10:30'}];
 assert.equal(makeProfessionalAgenda(x)[0].title,'Deslocação: Leiria → Coimbra');
 assert.equal(durationMinutes('08:00','10:30'),150);
 assert.equal(minsText(150),'2h30');
});
test('Pedido de lembrete de prevenção propõe aviso e não o guarda automaticamente',()=>{
 const x=parseIPVoice('Amanhã lembra-me da prevenção BT às 15h30',at);
 assert.equal(x.type,'guards');assert.equal(x.form.reminderAt,'2026-11-09T15:30');
});

test('Matrícula por defeito replica a primeira viatura existente na aplicação antiga',()=>{
 const data=clone();
 assert.equal(getDefaultVehiclePlate(data),'03-ZQ-46');
 const restored=normalizeIP({...data,defaultVehiclePlate:'23-ZP-64'});
 assert.equal(getDefaultVehiclePlate(restored),'23-ZP-64');
});
test('Viatura desativada ou removida faz fallback sem alterar deslocações históricas',()=>{
 const data=clone();data.defaultVehiclePlate='23-ZP-64';data.vehicles=data.vehicles.filter(v=>v.plate!=='23-ZP-64');
 data.trips=[{id:'t1',date:'2026-11-09',vehiclePlate:'23-ZP-64'}];
 assert.equal(getDefaultVehiclePlate(data),'03-ZQ-46');
 assert.equal(normalizeIP(data).trips[0].vehiclePlate,'23-ZP-64');
});

test('Atualização acrescenta as três matrículas à base antiga sem duplicar nem apagar uma viatura extra',()=>{
 const old={...clone(),vehicles:[{id:'custom',plate:'AA-22-BB',brand:'Outra'},{id:'fiat',plate:'03-ZQ-46',brand:'Fiat atualizada'}]};
 delete old.vehiclesCatalogVersion;
 const updated=normalizeIP(old);
 assert.deepEqual(updated.vehicles.map(v=>v.plate),['AA-22-BB','03-ZQ-46','23-ZP-64','87-HN-72']);
 assert.equal(updated.vehicles.find(v=>v.plate==='03-ZQ-46').brand,'Fiat atualizada');
 assert.equal(updated.vehiclesCatalogVersion,1);
});
test('Remoção voluntária após migração não volta a adicionar a matrícula e a preferência continua válida',()=>{
 const current=clone();current.vehicles=current.vehicles.filter(v=>v.plate!=='87-HN-72');
 const loaded=normalizeIP(current);
 assert.equal(loaded.vehicles.length,2);
 assert.equal(getDefaultVehiclePlate(loaded),'03-ZQ-46');
});
test('Reconhece matrícula com separadores alternativos ao verificar catálogo antigo',()=>{
 const legacy={vehicles:[{plate:'03 ZQ 46',brand:'Fiat'}]};
 const all=completeVehicleCatalog(legacy);
 assert.equal(all.length,3);
 assert.equal(vehicleKey('03-ZQ-46'),vehicleKey('03 ZQ 46'));
});
