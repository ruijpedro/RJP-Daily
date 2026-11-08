import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { version as WEB_VERSION } from '../../package.json';
import { chooseUpdate } from '../logic/ota-release.js';

export const APP_VERSION = WEB_VERSION;
const REPO = import.meta.env.VITE_RJP_OTA_REPO || 'ruijpedro/RJP-Daily';
const API_URL = `https://api.github.com/repos/${REPO}/releases?per_page=20`;
const CHECK_COOLDOWN_MS=30*60*1000;
let activeCheck=null;
let lastCheckAt=0;
let stagedVersion=null;
export const hasAndroidOta = () => Capacitor.getPlatform()==='android';

/** Confirm a newly activated bundle promptly, otherwise native rollback is triggered. */
export async function notifyOtaReady() {
  if (!hasAndroidOta()) return;
  try { await CapacitorUpdater.notifyAppReady(); }
  catch(e) { console.warn('OTA notifyAppReady:',e); }
}

async function fetchReleases() {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(REPO)) throw new Error('Repositório OTA mal configurado.');
  const response=await fetch(API_URL,{method:'GET',cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
  if (response.status===404) throw new Error('O repositório OTA ainda não está público ou não existe.');
  if (response.status===403 || response.status===429) throw new Error('O GitHub limitou as verificações. Tenta mais tarde.');
  if (!response.ok) throw new Error(`GitHub OTA indisponível (${response.status}).`);
  const data=await response.json();
  if (!Array.isArray(data)) throw new Error('Resposta OTA inesperada.');
  return data;
}

export async function checkForOta({force=false,onStatus=()=>{}}={}) {
  if (!hasAndroidOta()) { onStatus({type:'web',message:'A WebApp atualiza-se através do alojamento web.'}); return; }
  if (activeCheck) return activeCheck;
  if (!force && Date.now()-lastCheckAt<CHECK_COOLDOWN_MS) return;
  lastCheckAt=Date.now();
  activeCheck=(async()=>{
    onStatus({type:'checking',message:'A procurar atualizações…'});
    try {
      const [appInfo, current, releases] = await Promise.all([
        App.getInfo(), CapacitorUpdater.current(), fetchReleases()
      ]);
      const installedVersion=current?.bundle?.version && current.bundle.version!=='builtin'
        ? current.bundle.version : APP_VERSION;
      const nativeVersion=appInfo?.version || APP_VERSION;
      const release=chooseUpdate(releases,installedVersion,nativeVersion,REPO);
      if (!release) { onStatus({type:'current',message:`Versão ${installedVersion} atualizada.`}); return; }
      if (stagedVersion===release.version) {
        onStatus({type:'ready',version:release.version,message:`Versão ${release.version} preparada; será aplicada ao reabrir a app.`});return;
      }
      onStatus({type:'downloading',version:release.version,message:`A descarregar atualização ${release.version}…`});
      // SHA256 is checked by the native updater before marking the download usable.
      const bundle=await CapacitorUpdater.download({url:release.url,version:release.version,checksum:release.checksum});
      if (!bundle?.id) throw new Error('A transferência não devolveu um identificador válido.');
      await CapacitorUpdater.next({id:bundle.id});
      stagedVersion=release.version;
      onStatus({type:'ready',version:release.version,message:`Atualização ${release.version} preparada. Será aplicada ao fechar e reabrir a app.`});
    } catch(e) {
      onStatus({type:'error',message:`Atualização OTA: ${e?.message||'erro de ligação'}`});
      if (!force) console.warn('RJP Daily OTA:', e);
    } finally {activeCheck=null;}
  })();
  return activeCheck;
}
