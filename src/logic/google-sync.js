/** Seleção de eventos da Agenda RJP para publicação no Google.
 * Não inclui notas, registos IP ligados e eventos já importados do Google.
 * A escolha de enviar é sempre explícita na interface.
 */
export function googleExportCandidates(items){
  return (Array.isArray(items)?items:[]).filter(item=>
    item && typeof item.id==='string' && item.title &&
    (item.kind==='tarefa'||item.kind==='evento') &&
    item.when && !Number.isNaN(new Date(item.when).getTime()) &&
    !item.done && !item.fromGoogle && !item.fromIP && !item.linkedIPId &&
    !item.googleEventId
  );
}

/** ID estável baseado no ID local. Apenas caracteres base32hex (0-9 a-v).
 * Permite repetir o pedido sem criar cópias se uma resposta se perder.
 */
export function stableGoogleId(localId){
  const id=String(localId||'');
  if(!id)return null;
  const bytes=new TextEncoder().encode(id);
  if(bytes.length>400)throw new Error('Identificador local demasiado longo para sincronização Google.');
  return 'rjp'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
