/** OTA web bundles: public GitHub Releases only, scoped to our app and compatible native version. */
export const OTA_ASSET_NAME = 'rjp-daily-web.zip';
export const OTA_TAG_PREFIX = 'ota-v';
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function parseVersion(value) {
  const match = SEMVER.exec(String(value || ''));
  return match ? match.slice(1).map(Number) : null;
}
export function compareVersions(a, b) {
  const left = parseVersion(a), right = parseVersion(b);
  if (!left || !right) throw new Error('Versão OTA inválida.');
  for (let i=0;i<3;i++) if (left[i]!==right[i]) return left[i]>right[i]?1:-1;
  return 0;
}
export function chooseUpdate(releases, currentVersion, nativeVersion, repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return null;
  if (!parseVersion(currentVersion) || !parseVersion(nativeVersion)) return null;
  const eligible = [];
  for (const r of Array.isArray(releases) ? releases : []) {
    if (!r || r.draft || r.prerelease || typeof r.tag_name!=='string') continue;
    if (!r.tag_name.startsWith(OTA_TAG_PREFIX)) continue;
    const version = r.tag_name.slice(OTA_TAG_PREFIX.length);
    if (!parseVersion(version) || compareVersions(version,currentVersion)<=0) continue;
    const body = String(r.body||'');
    const minNative = /^MIN_NATIVE_VERSION:\s*(\d+\.\d+\.\d+)\s*$/mi.exec(body)?.[1];
    const checksum = /^SHA256:\s*([a-f0-9]{64})\s*$/mi.exec(body)?.[1];
    const appId = /^APP_ID:\s*([^\s]+)\s*$/mi.exec(body)?.[1];
    if (!minNative || !checksum || appId !== 'pt.rjp.daily') continue;
    if (compareVersions(nativeVersion,minNative)<0) continue;
    const asset = r.assets?.find(x=>x.name===OTA_ASSET_NAME);
    const expected = `https://github.com/${repository}/releases/download/${r.tag_name}/${OTA_ASSET_NAME}`;
    if (!asset || asset.browser_download_url!==expected) continue;
    if (asset.digest && asset.digest.toLowerCase()!==`sha256:${checksum}`) continue;
    eligible.push({version,url:expected,checksum,minNative});
  }
  eligible.sort((a,b)=>compareVersions(b.version,a.version));
  return eligible[0] || null;
}
