# Decisão 6: Frontend

> Texto de estudo. A versão resumida vai para o README na seção "Decisões".

## O que eu considerei

**React + Vite servido pelo próprio Fastify** (um serviço), **frontend separado
com hospedagem própria** (Cloud Storage + CDN ou Firebase Hosting) e **Next.js**.
Escolhi React + Vite + Tailwind, com o build estático servido pelo Fastify.

## Por que não Next.js

Já descartado na decisão 1 para o backend. Como front puro (sem API Routes),
Next.js traria SSR, roteamento por arquivo e otimização de imagem, nada disso
necessário numa tela única de agenda atrás de login. Vite entrega React com
build em segundos e sem servidor Node extra para renderizar.

## Por que não um frontend separado com deploy próprio

"Separado" significa dois deploys: a API num serviço de container e o front como arquivos
estáticos num bucket atrás de uma CDN (Cloud Storage + Cloud CDN, Firebase
Hosting), cada um com seu domínio (`api.exemplo.com` e `app.exemplo.com`).

É a arquitetura padrão para produto grande: o front escala na CDN sem gastar
instância de API, times diferentes fazem deploy independente e o cache de
borda deixa o carregamento mais rápido no mundo todo. Para este desafio ela
cobra três coisas que não compram nada:

1. **CORS e cookie cross-site.** Com domínios diferentes o cookie de sessão
   precisa de `SameSite=None; Secure`, o que reabre CSRF e exige token CSRF
   ou verificação de `Origin`. E toda requisição passa por preflight CORS.
   Mesmo domínio: `SameSite=Lax`, sem CORS, sem CSRF token.
2. **Dois deploys, duas configurações, duas URLs** para o avaliador acertar.
3. **Rodar local fica mais chato:** o `docker compose up` precisaria de um
   container Nginx só para servir arquivos.

Fica no README como evolução natural quando o front crescer ou tiver time
próprio.

## Por que React + Vite + Tailwind servido pelo Fastify

1. **Um serviço, uma URL, um cookie.** O Fastify serve o build do Vite
   (`apps/web/dist`) com `@fastify/static`, com fallback para `index.html`
   nas rotas do front; as rotas `/api/*` e `/api/eventos` (SSE) vivem no
   mesmo processo. O `docker compose up` sobe tudo.
2. **Mesmo TypeScript do back.** O front declara os tipos `Agendamento`,
   `Profissional` e `Usuario` em `api.ts`, espelhando a API. Um pacote
   compartilhado de tipos fica como evolução.
3. **Vite** para dev com HMR (proxy para a API em `localhost:3000`) e build
   estático em segundos. Zero runtime no servidor para o front.
4. **Tailwind** para estilizar rápido sem arquivo CSS por componente; já é
   minha ferramenta diária. Sem biblioteca de componentes pesada: a tela é
   uma grade de horários e um formulário.
5. **React** é o que eu domino; nenhum motivo para experimentar framework
   novo num take-home.

## Estrutura

```
apps/
  api/      Fastify + Postgres (serve também o build do front)
  web/      React + Vite + Tailwind
```

Um monorepo simples com `npm workspaces`, sem Turborepo ou Nx.

## Estado no cliente

- Estado da agenda vem sempre do servidor: `GET /api/agenda?profissional=&data=`.
- O `EventSource` em `/api/eventos?profissional=&data=` recebe "mudou" e o
  cliente refaz o `GET`. Sem store global, sem cache otimista: menos lugar
  para o estado divergir entre abas.
- Erro de sobreposição (`409 Conflict`) vira o aviso "horário já reservado".
- O seletor de hora mostra riscados os horários já ocupados no dia, em
  passos de 30 min, e só oferece fins depois do início.

## Escopo de interface

Uma tela de login e uma tela de agenda: seletor de profissional, navegação
por data com calendário, grade de horários, criar (botão de novo
agendamento), mover (editar o horário no painel do agendamento), cancelar,
observação por agendamento. Sem visão semanal, sem
busca de paciente, sem arrastar e soltar, sem tema escuro.

## O que fica para o README

- Resumo: front estático servido pela API para ter um domínio, um cookie e
  um deploy.
- Em "faria depois": CDN para o front quando ele crescer; visão semanal;
  mover arrastando; pacote compartilhado de tipos.
