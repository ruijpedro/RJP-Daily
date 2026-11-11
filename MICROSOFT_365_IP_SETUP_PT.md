# Agenda RJP — Integração Microsoft 365 corporativa IP

A integração destina-se à consulta dos compromissos de trabalho na Agenda RJP, exclusivamente por autorização individual e em **modo de leitura**.

## Informação para os serviços de informática da organização

1. Solicita aprovação de uma aplicação do tipo **cliente público móvel / Microsoft Entra ID** para o pacote Android `pt.rjp.daily`.
2. Indica o URI de redirecionamento utilizado pela app: `agenda-rjp://oauth/microsoft`. Configura-o como URI personalizado de plataforma móvel e de computador, caso permitido pela política da organização.
3. Autorizações delegadas Microsoft Graph estritamente necessárias: `User.Read` e `Calendars.ReadBasic`. Não pedir `Mail.Read`, `Calendars.ReadWrite`, nem acesso a todas as caixas de correio.
4. O serviço de informática deverá comunicar apenas os identificadores públicos **Application (client) ID** e **Directory (tenant) ID**, nunca client secrets, passwords ou tokens.
5. A ligação usa Authorization Code + PKCE, no navegador do sistema, com autenticação multifator da organização.
6. A aplicação consulta `/me`, `/me/calendars` e `/me/calendars/{id}/calendarView`, apenas em nome do utilizador autenticado.
7. Se a política de consentimento, Conditional Access, Android de trabalho ou Microsoft Intune bloquear a app, não se deve contornar o controlo. A autorização terá de partir da organização.

## Proteção de dados

- Tokens Microsoft ficam apenas na memória durante a sessão; sem `offline_access`, refresh token armazenado, passwords, ou armazenamento de eventos corporativos em backups.
- Títulos de compromissos Outlook são visíveis apenas na aplicação quando ligada. **Não são colocados nos widgets Android, backups JSON ou notificações locais**.
- Eventos Google e académicos são geridos em sessões separadas, sem transferência dos dados corporativos para os serviços Google.
- A instalação da APK v1.1.27 ou superior é necessária para o redirecionamento do login nativo.
- Só deverá ser usada com aprovação e de acordo com as regras internas da IP.

## Depois da aprovação

Em **Agenda RJP → Definições → Outlook corporativo IP**, insere os dois identificadores públicos facultados e toca em **Autorizar Outlook IP**. A autenticação e a leitura dos calendários dependem das permissões efetivas da organização.

A disponibilidade funcional depende da configuração externa Microsoft Entra e não pode ser confirmada apenas com a compilação da APK.
