# Decisão 3: Tempo real

## O problema tem duas partes

Quando a aba A altera um agendamento, a aba B precisa refletir em poucos
segundos sem recarregar. Isso envolve dois problemas independentes:

1. **Servidor → navegador:** como o servidor empurra a novidade para a aba B?
   Candidatos: WebSocket, SSE (Server-Sent Events), polling.
2. **Instância → instância:** no Cloud Run podem existir várias cópias do
   servidor. Se a aba A está conectada à instância 1 e a aba B à instância 2,
   a instância 1 não conhece a aba B. Candidatos: Postgres `LISTEN/NOTIFY`,
   Cloud Pub/Sub, Redis.

Escolhi **SSE** para a primeira parte e **`LISTEN/NOTIFY`** para a segunda.

## Parte 1: por que SSE e não WebSocket

WebSocket é um canal **bidirecional**: depois do handshake HTTP, o protocolo
muda e os dois lados mandam mensagens a qualquer hora. SSE é uma resposta HTTP
**que não termina**: o servidor mantém a conexão aberta e escreve eventos em
texto (`data: {...}\n\n`); só o servidor fala.

Neste desafio o cliente **não precisa falar pelo canal ao vivo**. Criar, mover
e cancelar são `POST`/`PATCH`/`DELETE` normais na API REST. O único fluxo
"ao vivo" é o servidor avisando "a agenda do profissional X no dia Y mudou".
Isso é o caso de uso exato do SSE. Usar WebSocket aqui seria carregar um canal
de duas vias para usar uma só.

Vantagens concretas do SSE para este caso:

- **Reconexão automática.** O `EventSource` do navegador reconecta sozinho e
  envia `Last-Event-ID`. Com WebSocket a reconexão é código meu.
- **É HTTP puro.** Passa por qualquer proxy, CDN e pelo Cloud Run sem
  configuração de `Upgrade`. No Fastify é uma rota comum que escreve em
  `reply.raw` e não fecha; nenhuma biblioteca.
- **Mais simples de ler e de defender.** Menos superfície para bug.

Limitação conhecida: em HTTP/1.1 o navegador limita ~6 conexões por domínio,
então 6+ abas da mesma agenda no mesmo navegador travariam. Irrelevante para
2-3 abas e resolvido por HTTP/2, que o Cloud Run já serve.

WebSocket seria a escolha se o cliente mandasse muita mensagem (chat, edição
colaborativa, jogo).

## Parte 2: por que LISTEN/NOTIFY e não Pub/Sub

Pub/Sub **não é pior**; é mais do que o problema pede. A comparação honesta:

| | `LISTEN/NOTIFY` | Cloud Pub/Sub |
|---|---|---|
| Serviço extra | Nenhum: é o mesmo Postgres | Mais um serviço GCP (free tier cobre) |
| Durabilidade | Nenhuma. Se a instância está fora, perde o aviso | Mensagem fica na fila até ser confirmada; retry automático |
| Garantia de entrega | "No máximo uma vez" | "Pelo menos uma vez": preciso tratar duplicata |
| Consumidores | Só quem está conectado ao mesmo banco | Qualquer serviço, em qualquer linguagem, em qualquer projeto |
| Payload | 8 KB | 10 MB |
| Setup | Uma conexão dedicada com `LISTEN` | Tópico, assinatura, endpoint push autenticado por OIDC ou loop de pull, service account, IAM |
| Transacional com a gravação | Sim: `NOTIFY` dentro da transação só dispara no commit | Não: publicar depois do commit abre a janela "gravou mas não publicou" (resolvido com outbox, mais complexidade) |

Para **este** problema, os pontos que decidem são:

1. **Perder um aviso é aceitável.** O evento diz só "mudou, recarregue". Se
   uma instância estiver fora no momento, seus clientes SSE caem, o
   `EventSource` reconecta (em outra instância) e o front recarrega a agenda
   do dia. O estado real sempre vem do banco, nunca do evento. Durabilidade de
   fila não compra nada aqui.
2. **Só existe um consumidor:** a própria API. Pub/Sub brilha quando vários
   sistemas diferentes querem o mesmo evento.
3. **Transacionalidade de graça.** `NOTIFY` emitido dentro da transação só é
   entregue no `COMMIT`. Com Pub/Sub eu teria que publicar após o commit e
   lidar com a falha entre os dois.
4. **Tempo.** Pub/Sub com push para Cloud Run exige endpoint autenticado,
   service account e IAM. São horas que, num teste de poucos dias, rendem
   mais em teste e acabamento.

Quando Pub/Sub passa a ser a escolha certa: quando o evento "agendamento
mudou" for consumido por outros serviços (faturamento, lembrete por WhatsApp,
BI), quando perder evento for inaceitável, ou quando o volume de `NOTIFY`
começar a pesar no banco. Por isso o código isola a publicação do evento numa
interface pequena (`publicarMudanca(evento)`), para que a troca de
`NOTIFY` por Pub/Sub seja local.

## Fluxo final

```
PATCH /agendamentos/:id
  → BEGIN
  → UPDATE agendamentos ... (constraint EXCLUDE protege)
  → NOTIFY agenda, '{"profissionalId": 7, "data": "2026-10-20"}'
  → COMMIT                              ← o NOTIFY só sai aqui
  → cada instância com LISTEN agenda recebe
  → escreve evento SSE para os clientes inscritos em (7, 2026-10-20)
  → front faz GET /agenda?profissional=7&data=2026-10-20 e redesenha
```

Mandar "mudou, recarregue" em vez do agendamento inteiro elimina problema de
ordem, duplicata e payload: o front sempre busca o estado atual do banco.

## Detalhes de implementação que importam

- A conexão com `LISTEN` fica **fora do pool**: é uma conexão dedicada e de
  vida longa. Se cair, reconecta e refaz o `LISTEN`.
- Cada cliente SSE se inscreve numa chave `(profissionalId, data)`; o servidor
  só envia eventos dessa chave.
- Heartbeat (`: ping\n\n`) a cada 25 s para o proxy não fechar a conexão por
  inatividade.
- Em dev, com uma só instância, o fluxo é idêntico; `LISTEN/NOTIFY` já é
  usado desde o início, então não existe "código só de produção".

