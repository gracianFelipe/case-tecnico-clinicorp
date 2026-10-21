# Decisão 1: Linguagem e framework do backend

## O que eu considerei

Eu pensei em três caminhos: **Next.js full-stack** (API Routes + front no mesmo
projeto), **Python com FastAPI** e **Node.js + TypeScript** com um servidor HTTP
dedicado. Escolhi o terceiro, com **Fastify**. Abaixo está o raciocínio.

## Por que não Next.js full-stack

Eu uso Next.js no dia a dia e seria o caminho mais rápido para começar. Mas o
requisito central do desafio é **tempo real**: duas abas abertas precisam ver a
mudança uma da outra em poucos segundos, sem F5. Isso pede uma **conexão
longa** entre navegador e servidor (WebSocket ou SSE), e é exatamente aí que o
modelo do Next.js joga contra:

1. **API Routes são pensadas como funções curtas.** Na Vercel elas rodam como
   funções serverless: recebem a requisição, respondem e morrem. Uma conexão
   WebSocket precisa de um processo que fique vivo segurando o socket aberto por
   minutos ou horas. A Vercel não suporta WebSocket em API Routes; em outros
   hosts dá para fazer com um servidor custom (`server.js`), mas aí você perde
   boa parte do que o Next.js oferece e termina mantendo um servidor Node
   "escondido" dentro de um framework de front.
2. **Não existe "memória compartilhada" entre instâncias.** Para avisar a aba B
   que a aba A mudou algo, o servidor precisa saber quem está conectado. Em
   serverless cada invocação é isolada, então eu teria que colocar um broker
   externo (Pub/Sub, Redis) só para contornar o modelo de execução. É
   complexidade a mais para resolver um problema que um servidor normal não tem.
3. **Fronteira de arquitetura pouco clara.** Para um time de *Foundation*, que
   cuida da base usada por outros times, mostrar uma API com contrato próprio,
   separada do cliente, diz mais sobre como eu penso do que um monólito
   front+back acoplado.

Em resumo: Next.js é ótimo para o front, mas o backend deste desafio precisa de
um processo de vida longa, e isso não é o ponto forte dele.

## Por que não Python + FastAPI

FastAPI é uma escolha legítima: assíncrono, WebSocket embutido, OpenAPI
automático e validação com Pydantic. Eu já trabalhei com Python (Flask e
scripts de ETL), então não seria um salto no escuro. Deixei de lado por dois
motivos práticos:

1. **Prazo e domínio.** O teste tem poucos dias. Minha experiência mais profunda
   em API web é com Node, e meu Python de produção é mais voltado a ETL e
   automação do que a servidores assíncronos. Num teste com prazo curto, cada hora gasta
   descobrindo como o framework funciona é uma hora a menos pensando em
   concorrência, regra de negócio e testes, que é onde o problema está.
2. **Um tipo só de ponta a ponta.** Com TypeScript no back e no front, o modelo
   de `Agendamento` é definido uma vez e compartilhado. Com Python no back eu
   teria dois modelos (Pydantic e TS) para manter em sincronia, ou geraria um
   cliente a partir do OpenAPI, o que é mais uma peça móvel.

## Por que Node.js + TypeScript

1. **É a stack que eu defendo melhor.** Node, PostgreSQL e TypeScript são o que
   eu uso em produção hoje (portal de cobranças com 2FA, ETL financeiro,
   integrações). Eu sei onde os problemas costumam aparecer.
2. **Conexões longas são naturais no Node.** O event loop foi feito para manter
   milhares de sockets abertos com pouco custo. WebSocket e SSE são triviais de
   servir a partir do mesmo processo HTTP.
3. **Encaixa em qualquer plataforma de container.** Um container Node com um
   servidor HTTP é o caso mais comum de Render, Cloud Run e afins, que escalam
   a zero quando ninguém usa e aceitam conexões longas.
4. **Tipos compartilhados.** O front (React + Vite) e o back falam o mesmo
   TypeScript, então o contrato da API vive no código, não só na documentação.

## Por que Fastify e não Express

Express foi minha primeira opção por familiaridade. Mas, comparando os dois para
este desafio, Fastify ganha em três pontos que importam aqui:

1. **Validação de entrada embutida.** Fastify valida `body`, `params` e `query`
   com JSON Schema (ou Zod via type provider) antes de a rota rodar. No Express
   eu teria que montar isso à mão com middleware. Para uma API que recebe
   horários de agendamento, validar formato de data e campos obrigatórios na
   borda evita que dado ruim chegue na regra de negócio.
2. **Ecossistema de plugins oficial e coeso.** `@fastify/websocket`,
   `@fastify/cookie`, `@fastify/cors`, `@fastify/jwt` são mantidos pelo próprio
   time do Fastify e seguem o mesmo padrão de registro. No Express a maioria
   dessas peças é de terceiros, com versões e estilos diferentes.
3. **Async nativo e tratamento de erro consistente.** No Fastify um `throw`
   dentro de um handler `async` vira resposta de erro automaticamente. No
   Express 4 um erro em função `async` que não for capturado derruba o processo
   ou fica pendurado, a menos que eu envolva cada rota num `try/catch` ou use
   um wrapper. Isso é fonte clássica de bug em produção.

Como bônus, Fastify é mais rápido (serialização com schema, roteamento com
radix tree), mas para este volume isso é detalhe. O que pesa é validação,
plugins e async.

## Por que conexão longa pede um servidor persistente

Porque um WebSocket é um **canal aberto que fica vivo**: o navegador faz o
handshake uma vez e, a partir daí, servidor e cliente trocam mensagens pelo
mesmo socket TCP por quanto tempo quiserem. Isso exige que **o mesmo processo
continue existindo** segurando aquele socket. Uma função serverless tem o
modelo oposto: ela existe só enquanto trata uma requisição e é encerrada (ou
congelada) logo depois, com limite de tempo de poucos segundos a alguns
minutos. Não há "onde" guardar o socket. Além disso, para empurrar uma mudança
para todas as abas conectadas, o servidor precisa de uma lista de conexões
ativas em memória; em serverless cada invocação é um processo isolado, então
essa lista não existe sem um serviço externo intermediando. Um servidor Node
rodando direto resolve os dois problemas de graça: o processo é persistente e
a lista de clientes é uma variável em memória.
