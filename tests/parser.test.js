import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePtCommand } from '../src/logic/parse.js';
const ref = new Date(2026, 10, 8, 16, 30);
test('Auto 2 amanhã: propõe 09:00 e confirmação', () => {
 const r=parsePtCommand('Amanhã lembra-me de verificar o Auto 2 da empreitada de motorização da Linha do Oeste',ref);
 assert.equal(r.kind,'tarefa'); assert.equal(r.when,'2026-11-09T09:00'); assert.equal(r.suggestedHour,true);
 assert.match(r.title,/Auto 2/);
});
test('chamada com hora explícita', () => {
 const r=parsePtCommand('Amanhã ligar ao engenheiro Marco Silva da Electro Campos às 15h30',ref);
 assert.equal(r.when,'2026-11-09T15:30'); assert.equal(r.kind,'tarefa'); assert.match(r.title,/Marco Silva/);
});
test('nota ditada sem prazo',()=>{
 const r=parsePtCommand('Anota que há infiltrações na cobertura',ref);
 assert.equal(r.kind,'nota'); assert.equal(r.when,'');
});
test('dia da semana seguinte',()=>{
 const r=parsePtCommand('Terça-feira às 10h fazer inspeção',ref);
 assert.equal(r.when,'2026-11-10T10:00');
});
test('sem sobrepor horas já passadas',()=>{
 const r=parsePtCommand('Ligar às 14:15',ref);
 assert.equal(r.when,'2026-11-09T14:15');
});
