# Decisão 2: Banco de dados

> Texto de estudo. A versão resumida vai para o README na seção "Decisões".

## O que eu considerei

Três caminhos: **Firestore**, **SQLite local + Postgres em produção** e
**PostgreSQL** nos dois ambientes (Docker local, Neon em produção).
Escolhi PostgreSQL.

## Por que não Firestore

Firestore é tentador para este desafio: tem free tier generoso, escala a zero e
**listeners em tempo real nativos** no cliente, o que resolveria o requisito 5
quase sem código. Deixei de lado por causa do requisito 4, a regra de negócio:

1. **Não existe constraint de exclusão.** A regra "um profissional não pode ter
   dois agendamentos sobrepostos" teria que ser garantida em código, dentro de
   uma transação que lê os agendamentos do dia e verifica sobreposição. As
   transações do Firestore são serializáveis, então funciona, mas a garantia
   depende de eu escrever (e manter) essa verificação corretamente em todo
   lugar que grava agendamento. Com Postgres a garantia é declarativa e vive
   no esquema.
2. **Consulta por intervalo é limitada.** "Todos os agendamentos que cruzam
   o intervalo X" é uma consulta de dois lados (`inicio < fim_X AND fim >
   inicio_X`). Firestore só permite desigualdade em um campo por consulta, o
   que obriga a filtrar o resto em memória.
3. **Testar é mais difícil.** Teste de integração com Firestore exige o
   emulador; com Postgres é um container e `TRUNCATE`.

Firestore seria a escolha se o foco fosse tempo real e o modelo de dados não
tivesse invariantes fortes. Aqui o invariante é o coração do problema.

## Por que não SQLite local + Postgres em produção

Zero infra local é atraente, mas dois bancos significam dois comportamentos. O
SQLite não tem `EXCLUDE`, nem tipo `tstzrange`, nem `LISTEN/NOTIFY`. Eu
perderia justamente as três coisas que fazem do Postgres a escolha certa, e
os testes locais não provariam nada sobre produção. Docker resolve o "zero
infra" com um `docker compose up`.

## Por que PostgreSQL

1. **A regra de negócio vira constraint.** Com a extensão `btree_gist`:
   `EXCLUDE USING gist (profissional_id WITH =, periodo WITH &&)`, onde
   `periodo` é um `tstzrange`. O banco garante que nunca existem dois
   intervalos sobrepostos para o mesmo profissional, mesmo com dezenas de
   requisições simultâneas em instâncias diferentes do servidor. A aplicação
   não checa antes: ela grava e, se o banco recusar (`exclusion_violation`),
   traduz o erro em `409 Conflict`. Checar antes seria redundante, porque o
   banco é o único ponto que enxerga todas as transações ao mesmo tempo.
2. **Concorrência resolvida pelo banco.** Validar só na aplicação
   (`SELECT` para checar conflito, depois `INSERT`) tem uma janela entre as
   duas operações em que outra requisição pode inserir. É a condição de
   corrida clássica de *check-then-act*. A constraint elimina a janela.
3. **Base para o tempo real.** `LISTEN/NOTIFY` permite que todas as instâncias
   do servidor recebam um aviso quando um agendamento muda, sem serviço extra.
   Isso entra na decisão 3.
4. **É o que eu uso em produção.** Sei onde os problemas aparecem (pool de
   conexões, migrações, índices).

## Hospedagem do banco: Neon

Em produção o banco roda no **Neon**, PostgreSQL serverless no plano
gratuito. O plano era o Cloud SQL, mas o GCP exigiu pré-pagamento para ativar
o faturamento (detalhes na decisão 5).

- É Postgres 16 de verdade: `btree_gist`, `EXCLUDE` e `LISTEN/NOTIFY`
  funcionam sem mudança.
- O app usa a **conexão direta**, não a do pooler: `LISTEN` precisa de uma
  sessão fixa, e o PgBouncer em modo transação troca a conexão a cada
  transação.
- TLS obrigatório (`sslmode=require`).
- A `DATABASE_URL` fica só nas variáveis de ambiente do Render.

## Local: Docker Compose

`docker compose up` sobe Postgres 16 e a API. As migrações rodam na
inicialização. Os testes de integração usam um banco descartável
(`agenda_test`) e falham se a `DATABASE_URL` apontar para outro nome, para
ninguém truncar o banco de desenvolvimento por acidente.

## O que fica para o README

- Resumo da decisão com a constraint `EXCLUDE` como argumento central.
- Nota sobre Neon (conexão direta por causa do `LISTEN`).
- Em "faria depois": IP privado + VPC, réplica de leitura, Firestore como
  alternativa descartada.
