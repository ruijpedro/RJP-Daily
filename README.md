# RJP Daily v1.1.7 — Agenda, Voz, Gestão IP, OTA e Google Calendar

**Android (APK) + WebApp + Atualização OTA preparada** · Português de Portugal · Autor Rui Jorge Pedro

A RJP Daily reúne a agenda pessoal e profissional com os módulos de **deslocações, prevenções BT/CC, atividades, viaturas e relatórios** da IP_RJP. Foi desenvolvida a partir do projeto RJP Daily v1.0 e dos requisitos reais encontrados no repositório `ruijpedro/IP_RJP` (versão 2.5.0); mantém a identidade `pt.rjp.daily` para preservar o armazenamento e permitir atualizações futuras com a **mesma chave de assinatura**.

## Google Calendar — ligação melhorada na v1.1.7

- Autenticação Google no Android e na WebApp através de Client ID Web OAuth e autorização da conta.
- Em Android tenta recuperar a sessão Google ao reabrir e renovar o token expirado; quando o Google não permitir, é necessário autorizar novamente.
- A aplicação só apresenta o estado **Ligado** depois de validar uma chamada real à Google Calendar API.
- Os eventos do Google são carregados para o mês selecionado, incluindo compromissos existentes e eventos de dia inteiro.
- Ao guardar um compromisso profissional ou pessoal podes selecionar **Adicionar ao Google Calendar**. As notas, deslocações e prevenções não são partilhadas por defeito.
- O código nativo e o package ID não foram alterados; a versão 1.1.7 é compatível com o mecanismo OTA da APK 1.1.5.

**Configuração necessária:** ativa a Google Calendar API e cria no Google Cloud um cliente OAuth Web e um Android com o SHA-1 da APK instalada. O guia completo está em [GOOGLE_CALENDAR_SETUP_PT.md](GOOGLE_CALENDAR_SETUP_PT.md). **A ligação à conta só é efetuada após autorização do utilizador**; não é possível ativá-la apenas através do GitHub.

## Prevenções BT/CC — módulo da antiga IP_RJP, em destaque (v1.1.4)

- Novo acesso **Prevenções** diretamente no menu inferior e atalho visível no ecrã inicial, sem precisar de navegar por IP → Prevenções.
- O formulário segue a antiga IP_RJP: **data, tipo de prevenção (BT ou CC) e observações**; horas de início/fim são opcionais.
- Botões diretos para criar **BT** e **CC**, contadores mensais, filtros Todas/BT/CC, pesquisa, editar, duplicar e eliminar.
- Cor distinta para BT e CC no calendário geral e entradas no histórico profissional.
- Lembretes opcionais por um toque: no dia às 08h00, na véspera às 18h00 ou hora personalizada, com confirmação e validação de hora futura.
- Exportações mensais PDF, CSV, Excel e backup/importação JSON da IP_RJP continuam disponíveis em IP → Relatórios.
- Sincronização para Google Calendar continua opcional e exige configurar OAuth e indicar hora de início; uma prevenção sem hora permanece evento de dia inteiro na agenda interna.
- Os dados existentes são preservados na chave local `rjp-daily-ip-v2` com o mesmo package Android `pt.rjp.daily`.

## Novo ícone RJP (v1.1.3)

O novo ícone azul com as letras **RJP**, calendário, lista de tarefas e microfone está integrado no ecrã inicial, manifest PWA, favicon, ícones Android das várias densidades e ícone adaptativo Android. O identificador Android mantém-se `pt.rjp.daily`. Para veres o novo ícone num Android após atualização, o launcher poderá exigir algum tempo ou reinício para atualizar a cache.

## Funcionalidades integradas

- **Agenda e voz**: anotar e ditar tarefas, compromissos e notas em PT-PT; confirmar o resultado antes de guardar; consultar tarefas pendentes, concluídas e agenda mensal.
- **Lembretes Android**: notificações locais agendadas à hora indicada, mesmo com a app fechada quando as permissões/condições do Android o permitem; ações de adiar 10 minutos e concluir. Resumo diário às 08h00 opcional.
- **Google Calendar**: leitura dos eventos autorizados e criação/atualização dos compromissos escolhidos, incluindo registos profissionais; requer configuração OAuth e autorização explícita. Não é sincronização completa em segundo plano.
- **Deslocações IP_RJP**: data, origem, destino, matrícula, hora de saída e chegada, atividade e observações; editar, duplicar, pesquisar e eliminar; histórico por mês.
- **Prevenções**: apenas **BT** e **CC**, com data, observações e horas opcionais. Prevenção sem hora aparece na agenda como evento diário, sem hora inventada.
- **Atividades profissionais**: tipo, local, hora de início e fim, observações; edição, duplicação, pesquisa e histórico.
- **Matrículas por toque**: as três viaturas ficam visíveis no registo de nova deslocação; basta tocar na matrícula pretendida, sem a memorizar. A atualização repõe uma só vez as três viaturas de origem que faltem em instalações antigas, preservando as outras viaturas e as alterações posteriores.
- **Matrícula por defeito**: `03-ZQ-46` (Fiat) inicialmente pré-selecionada; em **Gestão profissional → Viaturas**, tocar **Definir por defeito** para escolher outra. Nos formulários, a matrícula pode ser alterada caso a deslocação use outra viatura. A preferência é preservada em backups e importação.
- **Viaturas e destinos**: editar viaturas, acrescentar/remover viaturas, origens/destinos e tipos de atividade configuráveis. Três viaturas originais pré-carregadas: `03-ZQ-46` Fiat; `23-ZP-64` Renault Kangoo; `87-HN-72` Mitsubishi L200 DI-D.
- **Estatísticas**: número mensal de deslocações, BT, CC, atividades, horas de deslocação e de atividades.
- **Relatórios**: exportação **PDF, CSV e Excel (.xlsx)** por mês; no Android abre a folha de partilha nativa (guardar, enviar, imprimir através de aplicação compatível).
- **Backups**: dados pessoais da RJP Daily podem ser exportados em JSON; módulo profissional exporta e importa JSON, incluindo backups da antiga IP_RJP Professional (formato com `trips`, `guards`, `activities`, `vehicles`, `places` e `activityTypes`). Os dois conjuntos são mantidos isoladamente.
- **Registos IP na agenda**: cada deslocação, prevenção ou atividade aparece na agenda. Um **lembrete profissional** opcional agenda uma notificação local; a criação no Google Calendar é opt-in no formulário.

### Comandos por voz — exemplos

- “Amanhã lembra-me de verificar o Auto 2 da empreitada de motorização da Linha do Oeste.” → tarefa com proposta das 09h00 (confirmação antes de guardar).
- “Amanhã ligar ao engenheiro Marco Silva da Electro Campos às 15h30.” → tarefa com lembrete.
- “Regista uma deslocação de Caldas da Rainha para Coimbra amanhã às 8 horas com a viatura de matrícula 23-ZP-64.” → abre o formulário **Deslocação** com campos previamente preenchidos.
- “Marca prevenção BT amanhã.” / “Regista prevenção CC próxima sexta-feira.” → abre o formulário **Prevenção**, para confirmação.
- “Regista uma inspeção de edifício amanhã às 10h00.” → abre **Atividade**, para confirmação.
- “Mostra a agenda amanhã.” → abre a agenda na data indicada.

A transcrição é feita pelos serviços de reconhecimento de voz do dispositivo/navegador. A interpretação dos comandos é feita localmente e pode precisar de correção manual. A app **não grava deslocações automaticamente só por ouvir**: pede confirmação e permite completar os dados.

## Compilar no GitHub Actions (sem instalar ferramentas no PC)

1. Descompacta o ZIP e coloca **o conteúdo de todas as pastas**, incluindo `.github/workflows`, no repositório `RJP-Daily` (branch `main`). Se já tens esse repositório, atualiza os ficheiros, sem alterar o package ID.
2. Abre **Actions → RJP Daily — WebApp e APK Android → Run workflow**, ou faz um push. Primeiro são executados os testes; depois são construídas a WebApp e a APK.
3. Descarrega os artefactos `RJP-Daily-WebApp` e `RJP-Daily-Android-APK`.
4. Para publicar a WebApp, vai a **Settings → Pages → Build and deployment → Source = GitHub Actions** e só depois executa `RJP Daily — Publicar WebApp (Pages)`. Se Pages não estiver ativo, `configure-pages` devolve erro 404.

> **Importante:** esta versão inclui o código e os workflows. Não foi possível descarregar dependências e efetuar aqui a compilação de Vite/Gradle devido a falta de acesso ao npm. Os testes de lógica foram executados nesta versão (consultar os resultados desta entrega). A compilação real deverá ser verificada no GitHub Actions.

### APK por cima, sem perder dados

O package ID mantém-se `pt.rjp.daily`. A versão Android gerada terá `versionCode 1105`, `versionName 1.1.5`. Para atualizar a APK por cima da anterior, **a assinatura tem de ser exatamente a mesma**. Configura os Secrets:

| Secret | Conteúdo |
| --- | --- |
| `RJP_DAILY_KEYSTORE_B64` | Keystore Android em base64, numa linha |
| `RJP_DAILY_KEYSTORE_PASSWORD` | Password da keystore |
| `RJP_DAILY_KEY_ALIAS` | Alias |
| `RJP_DAILY_KEY_PASSWORD` | Password do alias |

Sem os Secrets, o workflow gera apenas APK de debug, cuja chave pode variar entre máquinas; **não desinstales uma versão com dados sem teres primeiro um backup**. Nunca carregues a keystore ou passwords para o repositório. Os dados pessoais da v1.0 usam a mesma chave local e são preservados se a atualização for instalada sobre a mesma aplicação e assinatura.

## Ligar o Google Calendar

1. No [Google Cloud Console](https://console.cloud.google.com/), ativa **Google Calendar API** num projeto.
2. Configura a tela de consentimento OAuth e adiciona a tua conta como utilizador de teste quando aplicável.
3. Cria um OAuth Client ID do tipo **Web application** com a origem da WebApp (ex.: `https://SEU-UTILIZADOR.github.io`) e outro do tipo **Android** com package ID `pt.rjp.daily` e SHA-1 da **APK instalada** (visível nas ações depois de gerar a APK). Ambos devem pertencer ao mesmo projeto.
4. Na RJP Daily abre **Definições → Google Calendar**, introduz o Client ID Web, liga a conta e concede permissão de calendário. No registo profissional, seleciona **Adicionar ao Google Calendar** para criar/atualizar o compromisso após confirmação.

Eventos profissionais sem uma hora definida não são enviados automaticamente ao Google Calendar até que a hora seja preenchida (especificamente, a prevenção BT/CC requer uma hora de início). Os eventos já existentes do Google são lidos sob pedido; não existe sincronização permanente de fundo, não se enviam notas ou deslocações sem consentimento. A ligação Google neste projeto é **separada da ligação Google Calendar no ChatGPT**.

## Importar o histórico da antiga IP_RJP

Na aplicação antiga, exporta um backup JSON completo. Na nova app: **IP → Relatórios → Importar IP_RJP**. O importador combina viaturas, locais, atividades e registos sem apagar o histórico que já tenhas na nova app; IDs iguais são atualizados. Confirma a importação antes de prosseguir. Para evitar duplicações na conta Google, as importações **não enviam eventos automaticamente**; volta a abrir/guardar um evento para o enviar ou reagendar um alerta.

Não é possível copiar automaticamente os dados privados instalados noutra APK (`IP_RJP` tem outro package ID/origem Web). É necessário fazer exportação/importação de backup. As fotografias das viaturas do projeto antigo **não estão incorporadas** nesta versão; os respetivos dados de matrícula, marca/modelo e tipo estão incluídos.

## Segurança, limites e dados

- Sem GPS automático nem localização de percurso; registo das deslocações é manual/por voz, respeitando o propósito da antiga IP_RJP.
- Os registos são guardados no **armazenamento local** do dispositivo, sem servidor RJP. Não existe sincronização do histórico entre telemóveis; usa backup para migrar dados.
- A WebApp só mostra notificações do navegador enquanto estiver aberta, não tem push em segundo plano. Para alarmes com a app fechada utiliza APK Android e autoriza notificações/alarme exato quando necessário. Fabricantes e gestão de bateria podem atrasar avisos.
- A exportação de informação profissional deve obedecer às políticas de segurança e privacidade da Infraestruturas de Portugal. Os relatórios apoiam a conferência, mas não substituem processos internos oficiais.
- Gmail, Google Contacts, Drive, Tasks e Sheets **não estão ligados** por esta versão. O módulo Google Calendar é o único integrado. Não há envio de emails nem telefonemas automáticos.
- OTA web automática preparada nesta versão; requer APK inicial v1.1.5 e releases GitHub públicas (ver secção final).

## Testes e comandos

```bash
npm install
npm test
npm run dev
npm run build
npm run android:prepare
```

**Stack:** React 19, Vite 7, Capacitor 8, @capgo speech recognition/social login, local notifications, @capacitor/filesystem/share, jsPDF 4.2.1, ExcelJS 4.4.

Origem dos requisitos: repositório [IP_RJP](https://github.com/ruijpedro/IP_RJP), app profissional criada anteriormente para as deslocações e prevenções da IP.

## Atualizações OTA automáticas — melhorias v1.1.6

**Importante:** a APK v1.1.5 já inclui o motor de atualização OTA. A v1.1.6 é a primeira versão preparada para publicação automática via GitHub Actions. A atualização OTA ainda precisa de ser confirmada num telemóvel real. A OTA substitui apenas os **recursos web** (HTML/CSS/JavaScript) compatíveis com a APK instalada; não instala um novo binário Android.

### Instalação inicial

1. O repositório público é **`ruijpedro/RJP-Daily`**. O código não pode conter dados pessoais, passwords, tokens ou backups da IP.
2. Mantém a APK base `1.1.5` instalada para receber a atualização por OTA. Se ainda não estiver instalada, podes gerá-la no workflow de compilação Android.
3. Para novas APKs nativas, usa **RJP Daily — WebApp e APK Android** no GitHub Actions, com assinatura estável. Para a atualização `1.1.6` basta o ZIP OTA da release; não é preciso reinstalar a APK base se o motor OTA estiver funcional.
4. Nas **Definições → Atualização OTA**, poderás consultar o estado ou carregar em **Verificar atualização**. A verificação automática ocorre ao iniciar a app, quando regressa do segundo plano e, enquanto está aberta, aproximadamente de 30 em 30 minutos.

### Publicar uma atualização futura sem nova APK

1. Altera apenas ficheiros da parte web. **Não é permitido distribuir via OTA** uma mudança que introduza/remova plugins nativos, permissões Android ou altere o `appId`. Essas mudanças requerem nova APK assinada.
2. Aumenta a versão em `package.json` (por exemplo, de `1.1.6` para `1.1.7`) e faz commit/push para `main`: **o GitHub Actions lança automaticamente a publicação OTA**.
3. Também podes usar **Actions → RJP Daily — Publicar atualização OTA → Run workflow** para uma publicação manual e acrescentar notas.
4. Antes da publicação, o workflow compara plugins, configuração Capacitor e script de preparação Android com a **baseline nativa 1.1.5**. Se houver alterações incompatíveis, bloqueia a OTA e exige uma nova APK. Depois executa os testes, compila a WebApp, cria um ZIP com `index.html` na raiz, calcula SHA-256 e publica `ota-vX.Y.Z` no GitHub Releases. Não republica versões existentes.
5. A APK verifica o GitHub Releases público, escolhe a versão mais recente compatível e descarrega o bundle. Depois de preparado, o bundle é aplicado ao passar a app para segundo plano ou voltar a abrir, sem interromper o preenchimento de notas ou deslocações. Uma mensagem identifica a nova versão depois da abertura.

**Apenas a primeira APK OTA tem de ser instalada manualmente.** Esta versão não atualiza uma APK v1.1.4 por OTA, porque a versão anterior não tinha o plugin updater. Se a app não encontrar uma release, permanece na versão existente. Se uma atualização falhar o arranque, o plugin dispõe de mecanismo de rollback, desde que `notifyAppReady()` seja executado a tempo. A informação profissional continua no armazenamento local `rjp-daily-ip-v2`, assim como os dados pessoais, e não é colocada no repositório GitHub.

**Repositório privado:** o esquema sem servidor usa a API pública GitHub e assets públicos; não inclui tokens GitHub na APK. Se precisares de privacidade do **código-fonte** num repositório privado, será necessário configurar um servidor de distribuição separado e autenticado de forma segura. Não coloques tokens em `VITE_` nem em assets públicos.


**Recuperação:** se uma versão OTA falhar ao inicializar, o Capacitor Updater pode reverter para o bundle anterior; mantém sempre cópias de segurança dos dados profissionais. Se forem necessários novos plugins, atualiza a baseline apenas depois de publicares uma APK assinada e instalada com esses plugins.

Documentação técnica do componente: https://capgo.app/docs/plugins/updater/api/ e https://capgo.app/docs/cli/commands/.
