# Decisão 5: Hospedagem e deploy

## O que aconteceu

O plano era o GCP: Cloud Run para o app, Cloud SQL para o banco, Secret
Manager para os segredos e GitHub Actions com Workload Identity Federation
para o deploy. Na hora de ativar o faturamento, o Google exigiu um
pré-pagamento único para liberar o teste gratuito numa conta
brasileira. Sem faturamento ativo nenhum serviço de computação do GCP roda,
nem dentro do free tier. Como o projeto é um teste e a regra era custo zero,
mudei para dois serviços gratuitos que não pedem cartão:

- **Render** (PaaS de container) no lugar do Cloud Run.
- **Neon** (PostgreSQL serverless) no lugar do Cloud SQL.

O código não mudou. O app lê porta e `DATABASE_URL` do ambiente e roda a
partir do mesmo `Dockerfile` do `docker compose`; trocar de provedor é
configuração.

## Por que Render

1. **Roda o nosso `Dockerfile`.** Conecta no repositório do GitHub, monta a
   imagem e publica com HTTPS. É o mesmo modelo do Cloud Run: container
   stateless atrás de um proxy.
2. **Deploy automático a cada push na `main`**, configurado no
   `render.yaml` (infraestrutura como código, versionada no repositório).
3. **Health check** em `/api/health`: o Render só troca a versão no ar
   quando a nova responde.
4. **SSE funciona.** O proxy do Render repassa a resposta em streaming; o
   heartbeat de 25 s mantém a conexão viva.
5. **Grátis sem cartão.** O preço: o serviço dorme depois de 15 min sem
   acesso e o primeiro acesso leva cerca de 1 min para acordar.

Alternativas olhadas: Fly.io e Railway pedem cartão; Firebase grátis só
hospeda arquivos estáticos (Functions e App Hosting exigem o plano Blaze).

## Por que Neon

1. **É PostgreSQL de verdade.** A constraint `EXCLUDE` com `btree_gist`, o
   `LISTEN/NOTIFY`, as transações e o `FOR UPDATE` funcionam sem mudança.
2. **`LISTEN` precisa da conexão direta.** O Neon oferece duas URLs: a do
   pooler (PgBouncer em modo transação) e a direta. `LISTEN` prende uma
   sessão, o que o pooler em modo transação não garante, então o app usa a
   direta.
3. **Escala a zero.** Armazenamento e processamento são separados; sem uso,
   o processamento desliga e volta em menos de 1 s. O Cloud SQL cobra 24 h
   por dia, use ou não.
4. **TLS obrigatório** (`sslmode=require` na URL).
5. **Região AWS us-east-2 (Ohio)**, a mesma do Render, para app e banco
   ficarem lado a lado. O Render grátis não tem região no Brasil.

## Segredos

A `DATABASE_URL` fica só nas variáveis de ambiente do Render
(`sync: false` no `render.yaml`, valor cadastrado no painel). Nada de
segredo no repositório ou na imagem.

## Proxy e IP do cliente

Atrás do proxy do Render, o IP que chega no socket é o do proxy. O limite
de tentativas de login usa o IP para contar, então o app precisa ler o
`X-Forwarded-For`. `PROXIES_CONFIAVEIS` diz quantos saltos de proxy são
confiáveis; confiar em todos deixaria qualquer cliente forjar o cabeçalho e
escapar do limite. Local fica 0.

## Como seria no GCP

O plano original continua válido e não exige mudança de código:

- **Cloud Run** com a mesma imagem, `--min-instances=0`, timeout de 60 min
  para o SSE.
- **Cloud SQL** pela conexão por socket Unix (`--add-cloudsql-instances`),
  sem VPC connector.
- **Secret Manager** para a `DATABASE_URL` (`--set-secrets`).
- **GitHub Actions com Workload Identity Federation**: o GitHub emite um
  token OIDC e o GCP troca por credencial de curta duração, sem chave JSON de
  service account.
- Alerta de orçamento antes de qualquer recurso.
