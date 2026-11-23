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
test('Normaliza dados e restringe prevenções a BT e CC',async()=>{
 const {clone,normalizeIP}= await import('../src/ip/model.js');
 const old={...clone(),vehiclesCatalogVersion:4,guards:[{id:'g1',date:'2026-11-23',kind:'BT'},{id:'g2',date:'2026-11-23',kind:'CC'},{id:'bad',date:'2026-11-23',kind:'OUTRO'}]};
 const result=normalizeIP(old);
 assert.deepEqual(result.guards.map(g=>g.kind),['BT','CC']);
 assert.equal(result.vehicles.length,6);
 assert.equal(result.vehicles.some(v=>v.plate==='03-ZQ-46'),false);
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

test('Matrícula por defeito passa a Toyota CJ-02-UB depois da migração',async()=>{
 const {clone,normalizeIP,getDefaultVehiclePlate}= await import('../src/ip/model.js');
 const old={...clone(),vehiclesCatalogVersion:2,defaultVehiclePlate:'03-ZQ-46'};
 const result=normalizeIP(old);
 assert.equal(result.defaultVehiclePlate,'CJ-02-UB');
 assert.equal(getDefaultVehiclePlate(result),'CJ-02-UB');
});
test('Viatura desativada ou removida faz fallback sem alterar deslocações históricas',async()=>{
 const {clone,getDefaultVehiclePlate,normalizeIP}= await import('../src/ip/model.js');
 const base=clone();
 const data={...base,vehiclesCatalogVersion:5,vehicles:base.vehicles.map(v=>({...v,active:v.plate!=='CJ-02-UB'})),trips:[{id:'t1',date:'2026-11-23',vehiclePlate:'03-ZQ-46'}]};
 assert.equal(getDefaultVehiclePlate(data),'23-ZP-64');
 const result=normalizeIP(data);
 assert.equal(result.trips[0].vehiclePlate,'03-ZQ-46');
 assert.equal(getDefaultVehiclePlate(result),'23-ZP-64');
});
test('Atualização migra catálogo antigo preservando viaturas extra e sem duplicados',async()=>{
 const {clone,normalizeIP}= await import('../src/ip/model.js');
 const old={...clone(),vehiclesCatalogVersion:0,vehicles:[{id:'custom',plate:'AA-22-BB',active:true}],defaultVehiclePlate:'03-ZQ-46'};
 const result=normalizeIP(old);
 assert.deepEqual(result.vehicles.map(v=>v.plate),['AA-22-BB','23-ZP-64','87-HN-72','CJ-02-UB','CM-32-DF','CM-28-AU','CM-53-DE']);
 assert.equal(result.defaultVehiclePlate,'CJ-02-UB');
 assert.equal(new Set(result.vehicles.map(v=>v.plate)).size,result.vehicles.length);
});
test('Remoção voluntária após migração não volta a adicionar a matrícula e a preferência continua válida',async()=>{
 const {clone,normalizeIP}= await import('../src/ip/model.js');
 const base=clone();
 const data={...base,vehiclesCatalogVersion:5,vehicles:base.vehicles.filter(v=>v.plate!=='CM-32-DF'),defaultVehiclePlate:'CM-28-AU'};
 const result=normalizeIP(data);
 assert.equal(result.vehicles.some(v=>v.plate==='CM-32-DF'),false);
 assert.equal(result.defaultVehiclePlate,'CM-28-AU');
 assert.equal(normalizeIP(result).vehicles.length,result.vehicles.length);
});
test('Reconhece matrícula com separadores alternativos ao verificar catálogo antigo',async()=>{
 const {clone,normalizeIP,vehicleKey}= await import('../src/ip/model.js');
 const base=clone();
 const data={...base,vehiclesCatalogVersion:0,vehicles:[{id:'t',plate:'CJ02UB',active:true}]};
 const result=normalizeIP(data);
 assert.equal(result.vehicles.filter(v=>vehicleKey(v.plate)==='CJ02UB').length,1);
 assert.equal(result.vehicles.some(v=>vehicleKey(v.plate)==='03ZQ46'),false);
});
