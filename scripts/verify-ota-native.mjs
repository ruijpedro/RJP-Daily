import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { compareVersions, parseVersion } from '../src/logic/ota-release.js';

// A compatibilidade OTA é aferida contra a APK nativa instalada, não só
// contra o commit anterior: assim, mudanças nativas em commits intermédios
// não são distribuídas inadvertidamente como HTML/CSS/JS.
const baseline = JSON.parse(readFileSync('config/ota-native-baseline.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const capacitor = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const minNative = process.argv[2] || baseline.nativeVersion;
const deps = Object.fromEntries(
  Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter(([name]) => /^(@capacitor\/|@capgo\/|capacitor-)/.test(name))
);
const patchSha = execFileSync('git', ['hash-object', 'scripts/patch-android.mjs'], { encoding: 'utf8' }).trim();

try {
  assert.ok(parseVersion(minNative), 'Versão mínima Android inválida');
  assert.ok(parseVersion(pkg.version), 'Versão OTA inválida');
  assert.ok(compareVersions(minNative, baseline.nativeVersion) >= 0, 'A versão mínima não pode anteceder a APK base');
  assert.ok(compareVersions(pkg.version, minNative) > 0, 'A versão OTA tem de ser superior à versão Android mínima');
  assert.deepEqual(deps, baseline.nativeDependencies, 'Dependências nativas mudaram: é necessária uma nova APK');
  // O nome visto sob o ícone Android é cosmético: não altera plugins,
  // armazenamento nem capacidades JS. A OTA funciona nas APKs antigas e novas.
  const expectedConfig={...capacitor,appName:baseline.capacitorConfig.appName};
  assert.deepEqual(expectedConfig,baseline.capacitorConfig,
    'Configuração Capacitor mudou além do nome: é necessária uma nova APK');
  const allowed=[baseline.patchAndroidGitBlobSha,...(baseline.allowedCosmeticPatchBlobShas||[])];
  assert.ok(allowed.includes(patchSha),
    'Script Android modificado fora das versões cosméticas auditadas: é necessária uma nova APK');
  console.log('Compatibilidade OTA validada: APK >= ' + minNative + ', bundle ' + pkg.version);
} catch (err) {
  console.error('OTA bloqueada por segurança:', err.message);
  process.exitCode = 1;
}
