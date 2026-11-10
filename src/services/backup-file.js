import {Capacitor} from '@capacitor/core';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
export async function saveJsonFile(name,content){
 if(Capacitor.isNativePlatform()){
  const result=await Filesystem.writeFile({path:name,data:content,directory:Directory.Cache,encoding:Encoding.UTF8,recursive:true});
  const uri=result.uri||(await Filesystem.getUri({path:name,directory:Directory.Cache})).uri;
  // Share.files is the native attachment API, not a web URL.
  await Share.share({title:'Agenda RJP · cópia de segurança',files:[uri],dialogTitle:'Guardar ou enviar o backup JSON'});
  return 'share';
 }
 const blob=new Blob([content],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 return 'download';
}
