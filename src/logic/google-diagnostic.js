// Identificador OAuth público fornecido pelo autor da RJP Daily.
// NÃO é Client Secret nem token; o Google valida separadamente origem/SHA-1.
export const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '74640667441-2lg3c9hfvjlln443t1r7nu0s1u0mdagv.apps.googleusercontent.com';

export function describeGoogleLoginFailure(error, phase='login') {
  const raw = String(error?.message || error || '').trim();
  const lower = raw.toLowerCase();
  const code = String(error?.code || '').slice(0,40);
  const clean = raw
    .replace(/\b[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com\b/gi,'[Client ID]')
    .replace(/\b(?:access_token|id_token|refresh_token|client_secret|authorization|code)=([^\s&]+)/gi,'[credencial oculta]')
    .replace(/Bearer\s+[^\s]+/gi,'Bearer [oculto]')
    .slice(0,180);
  const suffix = code ? ` (código ${code.replace(/[^\w.\-]/g,'')})` : '';
  if(/28444|developer[_ ]?error|developer console|api.?exception.?10|configuration|configuração/.test(lower)) {
    return 'O Google recusou a configuração Android. Confirma pt.rjp.daily, a SHA-1 exata da APK instalada e se os clientes Web/Android estão no mesmo projeto.'+suffix;
  }
  if(/12501|cancel|canceled|cancelled|usu[aá]rio cancelou|user[_ ]cancelled/.test(lower)){
    return 'A escolha da conta foi cancelada. Se selecionaste a conta e surgiu este erro, verifica também a SHA-1 e o Client ID Web.'+suffix;
  }
  if(/403|permission|permiss|forbidden|insufficient|scope|scope not/.test(lower)){
    return 'O Google recusou o acesso ao calendário. Confirma o âmbito calendar.events, a API ativada e o Gmail nos utilizadores de teste.'+suffix;
  }
  if(/origin_mismatch|redirect_uri_mismatch|origem/.test(lower)){
    return 'Origem OAuth não autorizada. Na Web, adiciona https://ruijpedro.github.io às origens JavaScript permitidas.'+suffix;
  }
  if(/no credentials|nocredential|credential manager|google play services/.test(lower)){
    return 'O Android não encontrou credenciais Google válidas. Confirma a conta no telemóvel, os Serviços Google Play e a SHA-1 da APK.'+suffix;
  }
  if(/timeout|network|internet|offline|fetch failed|networkerror/.test(lower)){
    return 'Não foi possível comunicar com o Google. Confirma a Internet e volta a tentar.'+suffix;
  }
  if(phase==='calendar')return 'A conta respondeu, mas não foi possível consultar os eventos. '+(clean||'Verifica as permissões no Google Cloud.')+suffix;
  return 'Ligação Google não concluída. '+(clean||'Confirma o Client ID Web e a configuração Android OAuth.')+suffix;
}
