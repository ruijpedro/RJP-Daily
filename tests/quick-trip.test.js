import test from 'node:test';
import assert from 'node:assert/strict';
import {activeTrip,startQuickTrip,finishQuickTrip,elapsedTripMinutes,tripDaySummary,tripMinutes,correctQuickTrip} from '../src/ip/quick-trip.js';
import {normalizeIP,localDay} from '../src/ip/model.js';
test('viagem rápida persiste e termina mantendo id e duração',()=>{
 const start=new Date(2026,10,10,10,15,0),end=new Date(2026,10,10,11,0,0);
 const trip=startQuickTrip({from:'Leiria',to:'Caldas',vehiclePlate:'AA-00-AA'},start,'t1');
 assert.equal(activeTrip(normalizeIP({trips:[trip]}).trips).id,'t1');
 const done=finishQuickTrip(trip,end);assert.equal(done.id,'t1');assert.equal(done.in,'11:00');assert.equal(tripMinutes(done),45);assert.equal(activeTrip([done]),null);
 assert.equal(tripDaySummary([done],localDay(start)).minutes,45);
});
test('viagem que atravessa meia-noite e correção manual',()=>{
 const start=new Date(2026,10,10,23,40),end=new Date(2026,10,11,0,20);
 const trip=startQuickTrip({from:'A',to:'B'},start,'t2');
 assert.equal(elapsedTripMinutes(trip,end),40);
 const done=finishQuickTrip(trip,end);assert.equal(tripMinutes(done),40);
 const corrected=correctQuickTrip({...done,in:'00:30'},done,end);assert.equal(tripMinutes(corrected),50);
});
test('valida origem destino e chegada anterior',()=>{
 const now=new Date(2026,10,10,12);assert.throws(()=>startQuickTrip({from:'',to:'B'},now,'t3'));
 const trip=startQuickTrip({from:'A',to:'B'},now,'t3');assert.throws(()=>finishQuickTrip(trip,new Date(2026,10,10,11)));
});
