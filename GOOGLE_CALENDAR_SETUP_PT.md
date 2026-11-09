# Ligar a RJP Daily ao Google Calendar (Android e WebApp)

A configuração é feita uma única vez no teu projeto do Google Cloud. **O Client ID não é uma password. Não coloques Client Secret, ficheiros de credenciais ou tokens no GitHub.** A autorização é feita pela própria conta Google no telemóvel/navegador.

## 1 — Criar e preparar projeto Google Cloud

1. Abre https://console.cloud.google.com/ e escolhe/cria um projeto, por exemplo **RJP Daily**.
2. Abre https://console.cloud.google.com/apis/library/calendar-json.googleapis.com e ativa **Google Calendar API**.
3. Em **Google Auth Platform → Branding**, preenche o nome da app **RJP Daily**, email de suporte e contacto.
4. Em **Audience**, escolhe **External** para uma conta Google pessoal. Se o projeto estiver em **Testing**, adiciona a tua própria conta em **Test users**. O modo Testing pode exigir nova autorização quando os tokens expirarem.
5. Em **Data Access**, adiciona apenas o âmbito necessário:
   `https://www.googleapis.com/auth/calendar.events`
   Permite ver, criar e atualizar eventos; a app não solicita acesso ao Gmail ou ao Drive.

## 2 — Criar credenciais OAuth

Em https://console.cloud.google.com/auth/clients cria dois clientes OAuth 2.0 **no mesmo projeto**:

### Cliente A: Web application

- Nome: **RJP Daily Web**
- **Authorized JavaScript origins** para GitHub Pages: `https://ruijpedro.github.io`
- Para testes no Vite, também `http://localhost:5173`
- Se a WebApp for alojada noutro domínio, usa o domínio efetivo.
- Copia o **Client ID Web**, que termina em `.apps.googleusercontent.com`.

### Cliente B: Android

- Nome: **RJP Daily Android**
- Package name / application ID: `pt.rjp.daily`
- SHA-1 da APK **que tens instalada**.

**SHA-1 verificada da APK de testes v1.1.5 que foi disponibilizada nesta conversa:**

`13:11:9C:DD:39:F6:BB:7C:DD:D3:93:32:33:74:89:76:44:B9:5C:E5`

> Atenção: a SHA-1 acima pertence **apenas ao ficheiro RJP_Daily_v1.1.5_DEBUG.apk** identificado nesta conversa. Se instalaste uma APK de outra execução do Actions, debug ou release, pode ter outra assinatura. Nesse caso consulta o SHA-1 da APK instalada, por exemplo através do Android SDK `apksigner verify --print-certs caminho.apk`. Cria um cliente Android adicional para cada certificado utilizado. Para versões definitivas, usa uma chave de assinatura estável.

No Android, é o **Client ID Web**, não o Client ID Android, que deves introduzir na aplicação. O cliente Android é verificado automaticamente pelo Google com o package ID e a SHA-1.

## 3 — Autorizar dentro da app

1. Abre **RJP Daily → Definições → Google Calendar**.
2. Cola o **Client ID Web** e toca **Ligar conta Google**.
3. Seleciona a tua conta Google e autoriza o acesso aos **eventos de calendário**.
4. A app verifica a ligação consultando o Google Calendar. Quando funcionar, aparece **Google Calendar ligado**.
5. Na agenda da RJP Daily poderás ver os eventos do Google. O botão **Atualizar agenda** volta a consultar a conta.
6. Ao criar/editar um compromisso, ou ao guardar uma deslocação/atividade/prevenção com hora, podes ativar **Adicionar ao Google Calendar**. A sincronização desses registos é **opcional**. Os registos sem hora, como prevenções de dia inteiro, continuam no calendário interno.

## 4 — Comportamento da sincronização

- **Android:** a RJP Daily tenta restaurar a sessão após reabrir e refrescar o token se permitido pelo Google. Se a sessão expirar ou for revogada, pede nova autorização.
- **WebApp:** após recarregar a página, pode ser necessário tocar de novo em **Ligar conta Google**; o plugin não suporta refresh silencioso de tokens no browser.
- **OTA:** a v1.1.7 atualiza apenas JavaScript/HTML/CSS. Não altera plugins nativos, permissões nem o package ID. A APK v1.1.5 com o plugin Google integrado continua a ser a base.
- **Dados:** os eventos são lidos diretamente do Google após autorização; não são enviados para o GitHub. As deslocações e prevenções permanecem guardadas localmente na app.
- **Limitação:** não há sincronização bidirecional permanente em segundo plano nem envio automático de todas as notas. O Google Calendar não substitui as notificações locais da APK.

## 5 — Resolução de problemas

- **Erro 403 / acesso recusado:** confirma a Calendar API e o âmbito `calendar.events` em Data Access, e se a conta está em Test users.
- **Android não mostra conta / erro de credenciais:** confirma que o cliente Android tem `pt.rjp.daily` e a SHA-1 exata da APK instalada. Confirma que o Web Client ID pertence ao mesmo projeto.
- **Erro no browser / origin_mismatch:** confirma a origem JavaScript exata, sem caminho `/RJP-Daily/`; a origem é apenas `https://ruijpedro.github.io`.
- **Sessão expirou:** volta a tocar em **Ligar conta Google**. Os dados locais continuam disponíveis.
- **Acesso não autorizado pela organização:** confirma se a tua conta Google pessoal ou Google Workspace permite a aplicação. Não contornes políticas da Infraestruturas de Portugal.

Documentação: https://capgo.app/docs/plugins/social-login/google/android/ e https://developers.google.com/workspace/calendar/api/auth
