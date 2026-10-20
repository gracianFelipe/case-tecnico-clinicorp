# Decisão 5 — Hospedagem no GCP e deploy

> Texto de estudo. A versão resumida vai para o README na seção "Decisões".

## O que eu considerei

Para o backend: **Cloud Run**, **Compute Engine (VM)** e **GKE**. Para o
deploy: **manual com `gcloud`**, **Cloud Build** e **GitHub Actions**.
Escolhi Cloud Run com deploy automático por GitHub Actions.

## Por que não Compute Engine

Uma VM é o que eu uso no trabalho (Docker Compose numa máquina fixa) e
funcionaria. Mas é IaaS: eu cuido de SO, patch, Docker, reverse proxy, TLS,
reinício em falha e escala. Para um serviço HTTP stateless em container, isso
é trabalho que o Cloud Run faz sozinho. Também não escala a zero: a VM cobra
24 h por dia, use ou não. A `e2-micro` tem free tier, mas o custo real é
operacional, não financeiro.

## Por que não GKE

Kubernetes resolve orquestração de dezenas de serviços com rede, segredos e
escala complexos. Aqui existe um serviço. O Autopilot reduz a operação, mas o
cluster tem custo fixo (~US$ 70/mês de taxa de gerenciamento depois do
crédito) e a curva de YAML não compra nada para o escopo. Seria escolher a
ferramenta pelo currículo, não pelo problema.

## Por que Cloud Run

1. **Container como unidade de deploy.** O mesmo `Dockerfile` que roda no
   `docker compose` local roda em produção. Nada de "funciona na minha
   máquina".
2. **Escala a zero.** Sem tráfego, custo zero de computação. O free tier
   (2 milhões de requisições/mês, 360 mil GB-s) cobre o teste e muito mais.
3. **Suporta conexão longa.** SSE é uma requisição HTTP que não termina; o
   Cloud Run permite timeout de até 60 min por requisição. O `EventSource`
   reconecta ao expirar. Com `--min-instances=0` a primeira requisição tem
   cold start de ~1-2 s, aceitável aqui; em produção eu deixaria
   `--min-instances=1`.
4. **Integração com Cloud SQL sem rede.** `--add-cloudsql-instances` monta o
   socket Unix `/cloudsql/<projeto>:<regiao>:<instancia>`; a conexão passa
   pelo Cloud SQL Auth Proxy embutido, com TLS, sem VPC connector.
5. **Segredos como variáveis de ambiente** vindas do **Secret Manager**
   (`--set-secrets`), com IAM por service account. Nenhum segredo em imagem,
   repositório ou pipeline.
6. **Logs e métricas sem configurar nada.** `stdout` vira Cloud Logging; o
   console mostra latência, instâncias e erros.

Frontend: build estático (Vite) servido pelo próprio Fastify a partir de
`/public`, no mesmo serviço. Um domínio só elimina CORS e cookie cross-site
(`SameSite=Lax` continua válido). Separar em Cloud Storage + CDN fica como
evolução.

## Deploy: por que GitHub Actions e não manual ou Cloud Build

**Manual (`gcloud run deploy --source .`)** é o mais rápido para o primeiro
deploy e serve como fallback. Mas não deixa rastro reproduzível e depende da
minha máquina.

**Cloud Build** é nativo e funciona bem com trigger de GitHub. Deixei de lado
porque o repositório, o histórico e a avaliação vivem no GitHub; manter o
pipeline no mesmo lugar (`.github/workflows/`) torna o processo visível para
quem lê o repo, e é o padrão que eu já uso.

**GitHub Actions** faz, a cada push na `main`:

1. `npm ci`, typecheck, testes com Postgres como *service container*.
2. Build da imagem e push para o **Artifact Registry**.
3. `gcloud run deploy` apontando para a imagem nova.

Autenticação do pipeline com **Workload Identity Federation (WIF)**: o GitHub
emite um token OIDC para o job, o GCP troca por credencial de curta duração da
service account de deploy. **Nenhuma chave JSON** de service account no
repositório ou nos secrets do GitHub, que é o erro clássico. A service account
tem só os papéis mínimos: `run.admin`, `artifactregistry.writer`,
`iam.serviceAccountUser` sobre a SA de runtime.

## Custo e controle

- **Alerta de orçamento** criado antes de qualquer recurso (US$ 5, avisos em
  50/90/100 %).
- Cloud Run, Artifact Registry (até 0,5 GB), Secret Manager (6 versões ativas)
  e Logging ficam no free tier.
- **Cloud SQL é o único custo real:** `db-f1-micro`, HD, sem HA, sem réplica,
  ~US$ 7-10/mês. Instância **parada** quando não estiver em avaliação; apagada
  depois do processo.
- Região `southamerica-east1` (São Paulo) para latência; Cloud SQL ali é um
  pouco mais caro que em `us-central1`, aceitável pelo período curto.

## O que fica para o README

- Resumo: Cloud Run porque é container stateless com escala a zero; Cloud SQL
  via socket Unix; segredos no Secret Manager; deploy por GitHub Actions com
  WIF, sem chave JSON.
- Em "faria depois": IP privado + Direct VPC egress, `min-instances=1`,
  front em Cloud Storage + Cloud CDN, Terraform para a infra, ambiente de
  staging por PR.
