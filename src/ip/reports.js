import {Capacitor} from '@capacitor/core';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {durationMinutes,minsText} from './model.js';

async function download(name,content,type){
 const blob=content instanceof Blob?content:new Blob([content],{type});
 if(Capacitor.isNativePlatform()){
  const data=await new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Não foi possível preparar o ficheiro.'));reader.readAsDataURL(blob);
  });
  await Filesystem.writeFile({path:name,data,directory:Directory.Cache,recursive:true});
  const uri=await Filesystem.getUri({path:name,directory:Directory.Cache});
  await Share.share({title:`RJP Daily · ${name}`,url:uri.uri,dialogTitle:'Guardar, enviar ou imprimir relatório'});
  return;
 }
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
const clean = val => String(val??'').replace(/\r?\n/g,' ');
const rows=({trips,guards,activities})=>[
 ...trips.map(t=>['Deslocação',t.date,t.out||'',t.in||'',t.from||'',t.to||'',t.vehiclePlate||'',t.activity||'',t.notes||'',minsText(durationMinutes(t.out,t.in))]),
 ...guards.map(g=>['Prevenção',g.date,g.start||'',g.end||'','','','',g.kind,g.notes||'','']),
 ...activities.map(a=>['Atividade',a.date,a.start||'',a.end||'',a.place||'','', '',a.type||'',a.notes||'',minsText(durationMinutes(a.start,a.end))])
].sort((a,b)=>a[1].localeCompare(b[1]));
const headers=['Tipo','Data','Hora início/saída','Hora fim/chegada','Origem/Local','Destino','Viatura','Detalhe','Observações','Duração'];
export async function exportIPCSV(payload){
 const table=[headers,...rows(payload)];
 const csv='\uFEFF'+table.map(r=>r.map(x=>{const v=clean(x);return `"${(/^[\s]*[=+\-@]/.test(v)?'\u0027':'')+v.replaceAll('"','""')}"`}).join(';')).join('\r\n');
 await download(`RJP_Daily_IP_${payload.month}.csv`,csv,'text/csv;charset=utf-8');
}
export async function exportIPXLSX(payload){
 const ExcelJS=(await import('exceljs/dist/exceljs.min.js')).default;
 const wb=new ExcelJS.Workbook();wb.creator='RJP Daily';wb.created=new Date();
 for(const [name,key,columns] of [
  ['Deslocações','trips',['Data','Origem','Destino','Matrícula','Saída','Chegada','Duração','Atividade','Observações']],
  ['Prevenções','guards',['Data','Tipo','Início','Fim','Observações']],
  ['Atividades','activities',['Data','Tipo','Local','Início','Fim','Duração','Observações']]]){
  const sheet=wb.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});sheet.addRow(columns);
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1B776F'}};
  for(const r of payload[key]){
   sheet.addRow(key==='trips'?[r.date,r.from,r.to,r.vehiclePlate,r.out,r.in,minsText(durationMinutes(r.out,r.in)),r.activity,r.notes]:key==='guards'?[r.date,r.kind,r.start||'',r.end||'',r.notes]:[r.date,r.type,r.place,r.start,r.end,minsText(durationMinutes(r.start,r.end)),r.notes]);
  }
  sheet.columns.forEach((col,i)=>{col.width=Math.min(45,Math.max(15,columns[i].length+5));});sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:columns.length}};
 }
 const file=await wb.xlsx.writeBuffer();
 await download(`RJP_Daily_IP_${payload.month}.xlsx`,file,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
export async function exportIPPDF(payload){
 const {jsPDF}=await import('jspdf');
 const pdf=new jsPDF({unit:'mm',format:'a4'});let y=18;
 const write=(line,fontSize=10,bold=false)=>{
  pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(fontSize);
  const lines=pdf.splitTextToSize(clean(line),178);
  for(const txt of lines){if(y>279){pdf.addPage();y=18;}pdf.text(txt,15,y);y+=fontSize*0.43+2;}
 };
 write('RJP DAILY / IP_RJP',17,true);write('Deslocações • Prevenções BT/CC • Atividades',11);write(`Mês: ${payload.month}`,11);write(`Autor: ${payload.profile?.author||'Rui Jorge Pedro'}`,9);write(payload.profile?.organization||'Infraestruturas de Portugal',9);
 const {trips,guards,activities}=payload;
 write(`Resumo: ${trips.length} deslocações | ${guards.filter(x=>x.kind==='BT').length} BT | ${guards.filter(x=>x.kind==='CC').length} CC | ${activities.length} atividades`,10,true);
 y+=4;
 const section=(title,records,format)=>{write(title,12,true);if(!records.length)write('Sem registos',9);else for(const r of records){write(format(r),9);y+=1;}y+=4;};
 section('Deslocações',trips,r=>`${r.date} | ${r.from} -> ${r.to} | ${r.vehiclePlate||''} | ${r.out||'?'}-${r.in||'?'} | ${minsText(durationMinutes(r.out,r.in))} | ${r.activity||''} ${r.notes||''}`);
 section('Prevenções',guards,r=>`${r.date} | ${r.kind} | ${r.notes||''}`);
 section('Atividades',activities,r=>`${r.date} | ${r.type||''} | ${r.place||''} | ${r.start||''}-${r.end||''} | ${r.notes||''}`);
 const pages=pdf.internal.getNumberOfPages();for(let p=1;p<=pages;p++){pdf.setPage(p);pdf.setFontSize(8);pdf.text(`RJP Daily | ${payload.month} | ${p}/${pages}`,15,292);}
 await download(`RJP_Daily_IP_${payload.month}.pdf`,pdf.output('blob'),'application/pdf');
}
export async function exportIPJSON(data){await download(`RJP_Daily_IP_Backup_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({app:'RJP Daily',module:'IP_RJP',version:2,exportedAt:new Date().toISOString(),ip:data},null,2),'application/json');}
