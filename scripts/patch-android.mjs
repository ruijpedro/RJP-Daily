import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const android=path.join(root,'android');
if(!fs.existsSync(android))throw new Error('Pasta Android ausente. Executa npx cap add android.');
const manifestPath=path.join(android,'app/src/main/AndroidManifest.xml');
let manifest=fs.readFileSync(manifestPath,'utf8');
const permissions=['android.permission.RECORD_AUDIO','android.permission.POST_NOTIFICATIONS','android.permission.SCHEDULE_EXACT_ALARM'];
for(const p of permissions){
 if(!manifest.includes(`android:name="${p}"`)){
  manifest=manifest.replace(/(<manifest\b[^>]*>)/,`$1\n    <uses-permission android:name="${p}" />`);
 }
}
// Outlook corporativo: apenas devolver o resultado PKCE do navegador do sistema.
if(!manifest.includes('android:host="oauth"')){
 const redirectFilter='\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="agenda-rjp" android:host="oauth" android:pathPrefix="/microsoft" />\n            </intent-filter>\n';
 if(!manifest.includes('</activity>'))throw new Error('Atividade Android necessária ao redirecionamento Microsoft não encontrada.');
 manifest=manifest.replace('</activity>',redirectFilter+'        </activity>');
}
fs.writeFileSync(manifestPath,manifest);
const stringsFile=path.join(android,'app/src/main/res/values/strings.xml');
let strings=fs.readFileSync(stringsFile,'utf8');
for(const tag of ['app_name','title_activity_main']){
  const exp=new RegExp('(<string\\s+name="'+tag+'"[^>]*>)[^<]*(<\\/string>)');
  if(!exp.test(strings))throw new Error('Etiqueta Android ausente: '+tag);
  strings=strings.replace(exp,'$1Agenda RJP$2');
}
fs.writeFileSync(stringsFile,strings);

const javaDir=path.join(android,'app/src/main/java/pt/rjp/daily');
fs.mkdirSync(javaDir,{recursive:true});
fs.writeFileSync(path.join(javaDir,'MainActivity.java'),`package pt.rjp.daily;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AgendaWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN &&
            requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle == null) {
                Log.w("Agenda RJP", "Plugin SocialLogin não encontrado");
                return;
            }
            Plugin plugin = pluginHandle.getInstance();
            if (plugin instanceof SocialLoginPlugin) {
                ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
            }
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
`);
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const [major,minor,patch]=version.split('.').map(Number);
if(!Number.isInteger(major)||!Number.isInteger(minor)||!Number.isInteger(patch))throw new Error('Versão semântica inválida: '+version);
const versionCode=major*1000+minor*100+patch;
const build=path.join(android,'app/build.gradle');
let gradle=fs.readFileSync(build,'utf8');
gradle=gradle.replace(/versionCode\s+\d+/, 'versionCode '+versionCode).replace(/versionName\s+"[^"]+"/, 'versionName "'+version+'"');
fs.writeFileSync(build,gradle);
const signingTag='// RJP_DAILY_RELEASE_SIGNING_CONFIGURATION';
if(!gradle.includes(signingTag)){
 gradle+=`\n${signingTag}\nandroid {\n  signingConfigs {\n    rjpDaily {\n      if (System.getenv('RJP_DAILY_KEYSTORE_PATH')) {\n        storeFile file(System.getenv('RJP_DAILY_KEYSTORE_PATH'))\n        storePassword System.getenv('RJP_DAILY_KEYSTORE_PASSWORD')\n        keyAlias System.getenv('RJP_DAILY_KEY_ALIAS')\n        keyPassword System.getenv('RJP_DAILY_KEY_PASSWORD')\n      }\n    }\n  }\n  buildTypes {\n    release {\n      if (System.getenv('RJP_DAILY_KEYSTORE_PATH')) {\n        signingConfig signingConfigs.rjpDaily\n      }\n    }\n  }\n}\n`;
 fs.writeFileSync(build,gradle);
}
for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
 const dest=path.join(android,`app/src/main/res/mipmap-${density}`);
 fs.mkdirSync(dest,{recursive:true});
 for(const name of ['ic_launcher.png','ic_launcher_round.png','ic_launcher_foreground.png']){
  fs.copyFileSync(path.join(root,'assets/mipmap',density,name),path.join(dest,name));
 }
}
const drawable=path.join(android,'app/src/main/res/drawable');
fs.mkdirSync(drawable,{recursive:true});
fs.copyFileSync(path.join(root,'assets/android-notification.png'),path.join(drawable,'ic_stat_rjp.png'));

// Launcher adaptativo: fundo azul + arte RJP com margens de seguranca para mascaras Android.
const resPath=path.join(android,'app/src/main/res');
const launcherColors=path.join(resPath,'values','rjp_launcher_colors.xml');
fs.mkdirSync(path.dirname(launcherColors),{recursive:true});
fs.writeFileSync(launcherColors,`<?xml version="1.0" encoding="utf-8"?>
<resources><color name="rjp_launcher_blue">#0952C7</color></resources>
`);
const adaptiveDir=path.join(resPath,'mipmap-anydpi-v26');
fs.mkdirSync(adaptiveDir,{recursive:true});
for(const name of ['ic_launcher.xml','ic_launcher_round.xml']){
 fs.writeFileSync(path.join(adaptiveDir,name),`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/rjp_launcher_blue" />
  <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`);
}

// Os widgets Android fazem parte da APK: são instalados apenas no build nativo.
// Os ficheiros-fonte ficam versionados; não se perdem quando "cap add android" recria a pasta.
const widgetRoot=path.join(root,'native-widget');
if(!fs.existsSync(widgetRoot))throw new Error('Fontes dos widgets Android em falta.');
for(const source of fs.readdirSync(path.join(widgetRoot,'java'))){
 if(!source.endsWith('.java'))continue;
 fs.copyFileSync(path.join(widgetRoot,'java',source),path.join(javaDir,source));
}
const widgetRes=path.join(widgetRoot,'res');
for(const type of fs.readdirSync(widgetRes)){
 const source=path.join(widgetRes,type);
 const dest=path.join(resPath,type);
 fs.mkdirSync(dest,{recursive:true});
 for(const name of fs.readdirSync(source)){
  fs.copyFileSync(path.join(source,name),path.join(dest,name));
 }
}
const widgetReceivers=[
 ['AgendaCompactWidget','widget_agenda_compact_info'],
 ['AgendaFullWidget','widget_agenda_full_info'],
];
const receiverXml=widgetReceivers.map(([klass,info])=>
  '        <receiver android:name=".'
  +klass+'" android:exported="true" android:label="Agenda RJP · '
  +(klass==='AgendaCompactWidget'?'Compacto 2×2':'Completo 4×3')
  +'">\n'
  +'            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>\n'
  +'            <meta-data android:name="android.appwidget.provider" android:resource="@xml/'
  +info+'" />\n'
  +'        </receiver>'
).join('\n');
if(!manifest.includes('android:name=".AgendaCompactWidget"')){
 manifest=manifest.replace('</application>',receiverXml+'\n    </application>');
 if(!manifest.includes('android:name=".AgendaCompactWidget"'))throw new Error('Não foi possível declarar os widgets no AndroidManifest.');
 fs.writeFileSync(manifestPath,manifest);
}
console.log('Agenda RJP: widgets nativos compacto (2×2) e completo (4×3) configurados.');

console.log('MainActivity, permissões, assinatura e novos ícones Agenda RJP aplicados.');
