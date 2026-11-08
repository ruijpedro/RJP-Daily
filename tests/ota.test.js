import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseUpdate,compareVersions,parseVersion} from '../src/logic/ota-release.js';
const repo='ruijpedro/RJP-Daily';
const hash='a'.repeat(64);
const release=(v,min='1.1.5',other={})=>({tag_name:`ota-v${v}`,draft:false,prerelease:false,
  body:`APP_ID: pt.rjp.daily\nMIN_NATIVE_VERSION: ${min}\nSHA256: ${hash}`,
  assets:[{name:'rjp-daily-web.zip',browser_download_url:`https://github.com/${repo}/releases/download/ota-v${v}/rjp-daily-web.zip`,digest:`sha256:${hash}`}],...other});
test('semver tem comparação numérica, não textual',()=>{assert.equal(compareVersions('1.1.10','1.1.9'),1);assert.equal(compareVersions('1.2.0','1.10.0'),-1)});
test('versões OTA recusam caracteres inseguros',()=>{assert.equal(parseVersion('1.2.3.zip'),null);assert.equal(parseVersion('v1.1.0'),null)});
test('escolhe atualização compatível mais recente',()=>{assert.equal(chooseUpdate([release('1.1.6'),release('1.1.7')],'1.1.5','1.1.5',repo).version,'1.1.7')});
test('não reinstala versão atual ou anterior',()=>{assert.equal(chooseUpdate([release('1.1.5'),release('1.1.4')],'1.1.5','1.1.5',repo),null)});
test('não aplica OTA com API nativa mais nova',()=>{assert.equal(chooseUpdate([release('1.2.0','1.2.0')],'1.1.5','1.1.5',repo),null)});
test('recusa URLs que não pertencem ao repositório esperado',()=>{let bad=release('1.1.6');bad.assets[0].browser_download_url='https://example.com/x.zip';assert.equal(chooseUpdate([bad],'1.1.5','1.1.5',repo),null)});
test('recusa releases sem hash, SHA incorreto e app errada',()=>{assert.equal(chooseUpdate([release('1.1.6','1.1.5',{body:'APP_ID: pt.rjp.daily'})],'1.1.5','1.1.5',repo),null);assert.equal(chooseUpdate([release('1.1.6','1.1.5',{body:`APP_ID: pt.wrong\nSHA256: ${hash}\nMIN_NATIVE_VERSION: 1.1.5`})],'1.1.5','1.1.5',repo),null)});
test('não instala versões pré-publicadas',()=>{assert.equal(chooseUpdate([release('1.1.6','1.1.5',{prerelease:true})],'1.1.5','1.1.5',repo),null)});
