# Agenda da clínica

Agenda de um consultório com atualização em tempo real: duas abas abertas na
mesma agenda se sincronizam em poucos segundos, sem F5.

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

1. **Login** com sessão que sobrevive ao F5 (cookie HttpOnly).
2. **Agenda do dia** de um profissional, com navegação por data.
3. **Criar, mover e cancelar** agendamentos. Mover é editar o horário.
4. **Sem sobreposição:** o mesmo profissional não pode ter dois horários que
   se cruzam. Quem garante é o banco, não só a tela.
5. **Tempo real:** o que muda numa aba aparece nas outras em poucos segundos.

## Como rodar localmente

Requisito: Docker.

```bash
git clone https://github.com/gracianFelipe/case-tecnico-clinicorp.git
cd case-tecnico-clinicorp
docker compose up -d --build
docker compose exec api node apps/api/dist/cli-seed.js
```

Abra http://localhost:3000 e entre com uma das contas acima. Para ver o tempo
real, abra a mesma agenda em duas abas (ou em dois navegadores, um com cada
conta) e crie, mova ou cancele um agendamento.

### Desenvolvimento sem Docker para o app

Requisito: Node 22.12 ou mais novo. O banco continua no Docker.

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run migrar --workspace apps/api
npm run seed --workspace apps/api
npm run dev --workspace apps/api     # API em http://localhost:3000
npm run dev --workspace apps/web     # front com HMR em http://localhost:5173
```

### Testes

São 30 testes de integração contra um Postgres real, no banco `agenda_test`
que o compose cria. Cobrem login e sessão, as regras da agenda, a
sobreposição (incluindo 10 inserções simultâneas no mesmo horário) e o SSE.

```bash
npm test --workspace apps/api
```

## Stack

- **API:** Node 24, TypeScript, Fastify 5
- **Banco:** PostgreSQL 16
- **Front:** React 19, Vite, Tailwind 4, servido pela própria API
- **Produção:** Render (container) + Neon (Postgres)

## Decisões

O detalhe de cada uma, com as alternativas consideradas, está em
[`docs/decisoes/`](docs/decisoes/).

1. **Fastify + TypeScript.** Conexões longas (SSE) são naturais no Node, e o
   front e o back falam a mesma linguagem.
2. **PostgreSQL com a regra de sobreposição no banco.** Uma constraint
   `EXCLUDE USING gist` sobre o intervalo `[inicio, fim)` recusa dois
   agendamentos que se cruzam para o mesmo profissional. Checar só no código
   (SELECT e depois INSERT) falha quando duas requisições chegam juntas; a
   constraint não. A API grava direto e traduz a recusa do banco em
   `409 Conflict`. Cancelar é soft delete, e a constraint ignora os
   cancelados.
3. **Tempo real com SSE + LISTEN/NOTIFY.** O servidor só empurra dados para o
   navegador, então SSE basta: é HTTP comum e reconecta sozinho. O NOTIFY sai
   de dentro da transação, então só avisa o que foi gravado de fato, e
   funciona com várias instâncias da API sem serviço extra. O evento diz só
   "mudou" e a tela busca a agenda de novo.
4. **Sessão própria em cookie.** Cookie HttpOnly, Secure e SameSite=Lax; no
   banco fica só o hash do token. Senha com scrypt. Limite de tentativas no
   login.
5. **Hospedagem: Render + Neon.** O plano era o GCP (Cloud Run + Cloud SQL).
   Para ativar o faturamento numa conta brasileira o Google exigiu um
   pré-pagamento de R$ 150, e a regra deste teste era custo zero. Troquei por
   dois serviços gratuitos sem cartão. O código não mudou: o mesmo Dockerfile
   e a mesma `DATABASE_URL`. O plano GCP continua descrito na decisão 5.
6. **Front servido pela API.** Um domínio só: sem CORS e com o cookie
   SameSite=Lax funcionando sem token CSRF.

## O que ficou de fora

- **Cadastro pela tela** de usuários e profissionais. Hoje vêm do seed.
- **Papéis e permissões.** Recepção e admin enxergam e fazem o mesmo.
- **Testes do front e de ponta a ponta** (Playwright). Os testes cobrem a API.
- **Deploy no GCP**, pelo motivo da decisão 5.
