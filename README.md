# Agenda da clínica

Agenda de um consultório com atualização em tempo real: o que muda numa aba
aparece nas outras em poucos segundos, sem recarregar a página.

**No ar:** https://agenda-clinicorp.onrender.com

> Roda no plano gratuito do Render. Depois de 15 min sem acesso o serviço
> dorme, e o primeiro acesso pode levar cerca de 1 min para acordar.

## Contas de demonstração

| E-mail                | Senha       |
|-----------------------|-------------|
| recepcao@clinica.test | recepcao123 |
| admin@clinica.test    | admin123    |

As contas e três profissionais são criados pelo seed. Não há tela de cadastro.

## O que o sistema faz

1. **Login** com sessão que sobrevive ao recarregamento da página (cookie HttpOnly).
2. **Agenda do dia** de um profissional, com navegação por data.
3. **Criar, mover (mudar o horário) e cancelar** agendamentos.
4. **Sem sobreposição:** o mesmo profissional não pode ter dois horários que
   se cruzam.
5. **Tempo real:** o que muda numa aba aparece nas outras em poucos segundos.

Além dos requisitos, a seta ao lado do nome do profissional mostra, ao passar
o mouse, os próximos cinco agendamentos dele. Clicar em um abre o dia e o
agendamento.

## Como rodar localmente

Requisito: Docker.

```bash
git clone https://github.com/gracianFelipe/case-tecnico-clinicorp.git
cd case-tecnico-clinicorp
docker compose up -d --build
docker compose exec api node apps/api/dist/cli-seed.js
```

Abra http://localhost:3000 e entre com uma das contas acima. Para ver o tempo
real, abra a mesma agenda em duas abas e crie, mova ou cancele um agendamento.

### Para desenvolver

Para mexer no código com recarga automática, o banco continua no Docker e o
app roda no Node da máquina (22.12 ou mais novo):

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run migrar --workspace apps/api
npm run seed --workspace apps/api
npm run dev --workspace apps/api     # API em http://localhost:3000
npm run dev --workspace apps/web     # front em http://localhost:5173
```

### Testes

**API:** 32 testes de integração contra um Postgres real, no banco
`agenda_test` que o compose cria. Cobrem login e sessão (incluindo o limite
de tentativas), as regras da agenda, a sobreposição (incluindo 10 inserções
simultâneas no mesmo horário) e o tempo real.

**Front:** 15 testes de componentes (Testing Library) para o login, o
seletor de hora com horários ocupados riscados, o painel de agendamento,
incluindo a mensagem quando o servidor recusa o horário, e a lista de
próximos agendamentos.

```bash
npm test
```

**Ponta a ponta:** 2 testes com Playwright num navegador real, contra o app
do `docker compose` em http://localhost:3000. Um confere que a sessão
sobrevive ao recarregamento. O outro abre duas abas: cria um agendamento na
primeira, espera ele aparecer na segunda sem recarregar, abre-o pela lista de
próximos agendamentos, tenta salvar o mesmo horário na segunda e confere a
recusa.

```bash
npm --workspace apps/web exec -- playwright install chromium
npm run test:e2e --workspace apps/web
```

## Stack

- **API:** Node 24, TypeScript, Fastify 5
- **Banco:** PostgreSQL 16
- **Front:** React 19, Vite, Tailwind 4, servido pela própria API
- **Produção:** Render (container) + Neon (Postgres)

## Decisões

Cada item tem um documento com o raciocínio completo e as alternativas
consideradas, na pasta [`docs/decisoes/`](docs/decisoes/).

1. **[Fastify + TypeScript](docs/decisoes/01-backend.md).** Conexões longas
   (SSE) são naturais no Node, e o front e o back falam a mesma linguagem.
2. **[PostgreSQL com a regra de sobreposição no banco](docs/decisoes/02-banco-de-dados.md).**
   Uma constraint `EXCLUDE USING gist` sobre o intervalo `[inicio, fim)`
   recusa dois agendamentos que se cruzam para o mesmo profissional. Checar
   só no código (SELECT e depois INSERT) falha quando duas requisições chegam
   juntas; a constraint não. A API grava direto e traduz a recusa do banco em
   `409 Conflict`. Cancelar é soft delete, e a constraint ignora os
   cancelados.
3. **[Tempo real com SSE + LISTEN/NOTIFY](docs/decisoes/03-tempo-real.md).**
   O servidor só empurra dados para o navegador, então SSE basta: é HTTP
   comum e reconecta sozinho. O NOTIFY sai de dentro da transação, então só
   avisa o que foi gravado de fato, e funciona com várias instâncias da API
   sem serviço extra. O evento diz só "mudou" e a tela busca a agenda de novo.
4. **[Sessão própria em cookie](docs/decisoes/04-autenticacao.md).** Cookie
   HttpOnly, Secure e SameSite=Lax; no banco fica só o hash do token. Senha
   com scrypt. Limite de 10 tentativas de login por minuto para cada IP.
5. **[Hospedagem: Render + Neon](docs/decisoes/05-hospedagem.md).** O plano
   era o GCP (Cloud Run + Cloud SQL). Porém, para ativar o faturamento numa
   conta brasileira, o Google exigiu um pré-pagamento, então troquei por dois
   serviços gratuitos. O código não mudou: o mesmo Dockerfile e a mesma
   `DATABASE_URL`.
6. **[Front servido pela API](docs/decisoes/06-frontend.md).** Um domínio só:
   sem CORS e com o cookie SameSite=Lax funcionando sem token CSRF.

## O que ficou de fora

- **Deploy no GCP.** O plano (Cloud Run, Cloud SQL, Secret Manager e GitHub
  Actions com Workload Identity Federation) está na decisão de hospedagem,
  pronto para usar.
- **Mover arrastando na grade.** Hoje mover é editar o horário no painel do
  agendamento.
- **Cadastro pela tela** de usuários e profissionais. Hoje vêm do seed.
- **Papéis e permissões.** Recepção e admin enxergam e fazem o mesmo.
- **Visão semanal da agenda.** Hoje a agenda mostra um dia por vez.
- **Login gerenciado** (Google ou Microsoft) com 2FA e reset de senha.

Cada documento em `docs/decisoes/` termina com uma seção "O que eu faria
depois", com as evoluções de cada área.
