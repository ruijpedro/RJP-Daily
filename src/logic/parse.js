/** Parser intencional e conservador para comandos de voz em PT-PT.
 * Nunca executa a ação automaticamente: a UI mostra um formulário de confirmação.
 */
const weekdays = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const words = {
  uma:1, um:1, duas:2, dois:2, três:3, tres:3, quatro:4, cinco:5,
  seis:6, sete:7, oito:8, nove:9, dez:10, onze:11, doze:12,
  treze:13, catorze:14, quatorze:14, quinze:15, dezasseis:16,
  dezassete:17, dezoito:18, dezanove:19, vinte:20, vinteum:21,
  vinteedois:22, vinteetrês:23
};
export const pad = v => String(v).padStart(2, '0');
export function localDateTime(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
export function parsePtCommand(sentence, reference = new Date()) {
  const raw = String(sentence || '').trim().replace(/[.?!]+$/, '').trim();
  const str = raw.toLocaleLowerCase('pt-PT');
  const base = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  let date = null;
  let datePart = null;
  if (/\bdepois de amanh[ãa](?=$|[\s,.:;!?])/.test(str)) { date = new Date(base); date.setDate(date.getDate()+2); datePart = /\bdepois de amanh[ãa](?=$|[\s,.:;!?])/; }
  else if (/\bamanh[ãa](?=$|[\s,.:;!?])/.test(str)) { date = new Date(base); date.setDate(date.getDate()+1); datePart = /\bamanh[ãa](?=$|[\s,.:;!?])/; }
  else if (/\bhoje\b/.test(str)) { date = new Date(base); datePart = /\bhoje\b/; }
  else {
    const full = str.match(/\bdia\s+(\d{1,2})(?:[\/\-](\d{1,2})(?:[\/\-](\d{4}))?)?/);
    if (full) {
      const day = Number(full[1]), month = full[2] ? Number(full[2]) - 1 : base.getMonth();
      const year = full[3] ? Number(full[3]) : base.getFullYear();
      const found = new Date(year, month, day);
      if (found.getDate()===day && found.getMonth()===month && found.getFullYear()===year) {
        if(!full[2] && found < base) found.setMonth(found.getMonth()+1);
        else if (full[2] && !full[3] && found < base) found.setFullYear(found.getFullYear()+1);
        date = found;
        datePart = /\bdia\s+\d{1,2}(?:[\/\-]\d{1,2}(?:[\/\-]\d{4})?)?/;
      }
    } else {
      for (let i=0;i<weekdays.length;i++) {
        const w = weekdays[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(`\\b(?:pr[oó]xima?\\s+)?${w}(?:-feira)?\\b`, 'i');
        if (rx.test(str)) {
          date = new Date(base);
          let delta = (i - base.getDay() + 7) % 7;
          if (delta === 0 || /pr[oó]xima?/.test(str)) delta += 7;
          date.setDate(date.getDate()+delta);
          datePart = rx;
          break;
        }
      }
    }
  }
  let hours = null, minutes = 0, timePart = null;
  const numeric = str.match(/(?:^|\s)(?:[àa]s?\s+|pelas?\s+)(\d{1,2})(?:(?:\s*[:h]\s*)(\d{1,2}))?\s*(?:horas?|h)?\b/i)
    || str.match(/\b(\d{1,2})[:h](\d{2})\b/i);
  if (numeric) {
    hours=Number(numeric[1]); minutes=numeric[2]?Number(numeric[2]):0;
    timePart=numeric[0];
  } else {
    const spoken = str.match(/(?:^|\s)(?:[àa]s?\s+|pelas?\s+)([a-záàãâéêíóôõúç]+)(?:\s+(?:e\s+)?(meia|quarto|\d{1,2}))?(?:\s+horas?)?\b/i);
    if (spoken && words[spoken[1]] !== undefined) {
      hours=words[spoken[1]];
      minutes = spoken[2]==='meia'?30:spoken[2]==='quarto'?15:spoken[2]?Number(spoken[2]):0;
      timePart=spoken[0];
    }
  }
  if(hours!==null && (hours>23 || minutes>59)) { hours=null; minutes=0; timePart=null; }
  if (date && hours===null) { hours = 9; minutes = 0; }
  // Um horário sem data é hoje, se ainda for futuro, ou amanhã caso contrário.
  if (!date && hours!==null) {
    date = new Date(base);
    if (new Date(date.getFullYear(),date.getMonth(),date.getDate(),hours,minutes) <= reference) date.setDate(date.getDate()+1);
  }
  if(date) date.setHours(hours??9, minutes, 0, 0);
  const meeting = /\b(reuni[aã]o|encontro|compromisso|marcar|agenda[r]?|consulta|visita)\b/i.test(str);
  const action = /\b(lembra|lembrar|verificar|ligar|telefonar|contactar|enviar|fazer|rever|confirmar|pagar|tratar|vistoriar|inspecionar|preparar|entregar|ir\s+ao)\b/i.test(str);
  let kind = meeting ? 'evento' : (action || date ? 'tarefa' : 'nota');
  let title = raw
    .replace(/^\s*(?:lembra-me\s+(?:de\s+)?|lembrar-me\s+(?:de\s+)?|não me deixar esquecer\s+(?:de\s+)?|cria\s+(?:uma\s+)?nota\s+(?:sobre\s+)?|aponta\s+(?:que\s+)?|anota\s+(?:que\s+)?|marca\s+(?:uma\s+)?|agenda\s+(?:uma\s+)?)/i, '')
    .trim();
  if(datePart) title=title.replace(datePart,' ');
  title=title.replace(/^\s*(?:lembra-me\s+(?:de\s+)?|lembrar-me\s+(?:de\s+)?|não me deixar esquecer\s+(?:de\s+)?)/i,'');
  if(timePart) title=title.replace(timePart,' ');
  title=title.replace(/\s+/g,' ').replace(/\s+(?:para|às|a|pelas|no|na)\s*$/i,'').trim();
  if (!title) title = raw;
  title = title[0]?.toLocaleUpperCase('pt-PT')+title.slice(1);
  return {title, kind, when: date ? localDateTime(date) : '', suggestedHour: Boolean(date && !timePart), original: raw};
}
export function relativeDay(date) {
  const x = new Date(date), now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const delta = Math.round((b-a)/86400000);
  if(delta===0) return 'Hoje'; if(delta===1) return 'Amanhã'; if(delta===-1) return 'Ontem';
  return x.toLocaleDateString('pt-PT',{weekday:'short',day:'numeric',month:'short'});
}
