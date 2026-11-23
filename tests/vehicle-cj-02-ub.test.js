import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,normalizeIP} from '../src/ip/model.js';

test('Toyota CJ-02-UB disponível em novas instalações',()=>{
 const data=clone();
 const car=data.vehicles.find(v=>v.plate==='CJ-02-UB');
 assert.equal(car?.brand,'Toyota');
 assert.equal(car?.color,'Branco');
 assert.equal(car?.active,true);
 assert.equal(data.defaultVehiclePlate,'CJ-02-UB');
});
test('migração v1 adiciona Toyota sem alterar viaturas, deslocações e preferência',()=>{
 const previous={...clone(),vehiclesCatalogVersion:1,vehicles:[{id:'own',plate:'AA-00-AA',brand:'Outra',active:true}],defaultVehiclePlate:'AA-00-AA',trips:[{id:'trip1',date:'2026-11-23',vehiclePlate:'AA-00-AA'}]};
 const migrated=normalizeIP(previous);
 assert.deepEqual(migrated.vehicles.map(v=>v.plate),['AA-00-AA','CJ-02-UB']);
 assert.equal(migrated.defaultVehiclePlate,'CJ-02-UB');
 assert.equal(migrated.trips[0].vehiclePlate,'AA-00-AA');
 assert.equal(normalizeIP(migrated).vehicles.length,2);
});

test('migração v2 altera apenas uma vez a matrícula por defeito',()=>{
 const data={...clone(),vehiclesCatalogVersion:2,defaultVehiclePlate:'03-ZQ-46'};
 const migrated=normalizeIP(data);
 assert.equal(migrated.defaultVehiclePlate,'CJ-02-UB');
 const userChoice=normalizeIP({...migrated,defaultVehiclePlate:'23-ZP-64'});
 assert.equal(userChoice.defaultVehiclePlate,'23-ZP-64');
});
