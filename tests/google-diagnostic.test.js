import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_GOOGLE_WEB_CLIENT_ID,describeGoogleLoginFailure} from '../src/logic/google-diagnostic.js';

test('Client ID público predefinido é o cliente Web RJP Daily',()=>{
 assert.match(DEFAULT_GOOGLE_WEB_CLIENT_ID,/^74640667441-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/);
});
test('Erro Android 28444 explica assinatura e pacote',()=>{
 const d=describeGoogleLoginFailure(new Error('GetCredentialCustomException: [28444] Developer console is not set up correctly'));
 assert.match(d,/SHA-1/);
 assert.match(d,/pt\.rjp\.daily/);
});
test('Erro 403 menciona âmbito calendar.events',()=>{
 assert.match(describeGoogleLoginFailure(new Error('HTTP 403 Forbidden'),'calendar'),/calendar\.events/);
});
test('Erro de origem explica domínio autorizado da WebApp',()=>{
 assert.match(describeGoogleLoginFailure(new Error('origin_mismatch')),/ruijpedro\.github\.io/);
});
test('Diagnóstico não expõe tokens nem Client ID completo',()=>{
 const message='Failure access_token=SUPERSECRET Bearer KEYVALUE client_id=74640667441-xxxx.apps.googleusercontent.com';
 const output=describeGoogleLoginFailure(new Error(message));
 assert.doesNotMatch(output,/SUPERSECRET|KEYVALUE|74640667441-xxxx/);
});
