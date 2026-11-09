import test from 'node:test';
import assert from 'node:assert/strict';
import {googleExportCandidates,stableGoogleId} from '../src/logic/google-sync.js';

test('Exportação só escolhe tarefas e compromissos válidos da Agenda RJP',()=>{
 const example=(id,kind,extra={})=>({id,kind,title:'Teste',when:'2026-11-12T15:30',done:false,...extra});
 const items=[
  example('one','tarefa'),example('two','evento'),
  example('note','nota'),example('past','tarefa',{when:''}),
  example('google','evento',{fromGoogle:true}),example('ip','evento',{fromIP:true}),
  example('linked','tarefa',{linkedIPId:'123'}),example('sent','evento',{googleEventId:'abc'}),
  example('done','tarefa',{done:true}),example('bad','tarefa',{when:'inválida'})
 ];
 assert.deepEqual(googleExportCandidates(items).map(x=>x.id),['one','two']);
});
test('IDs estáveis são distintos, compatíveis com a API Google e repetíveis',()=>{
 const x=stableGoogleId('local-abc');
 assert.equal(x,stableGoogleId('local-abc'));
 assert.match(x,/^[0-9a-v]{5,1024}$/);
 assert.notEqual(x,stableGoogleId('local-xyz'));
});
test('ID vazio não produz identificador Google',()=>{
 assert.equal(stableGoogleId(''),null);
});
test('IDs locais unicode não expõem caracteres proibidos',()=>{
 assert.match(stableGoogleId('prevenção-PT'),/^[0-9a-v]{5,1024}$/);
});
