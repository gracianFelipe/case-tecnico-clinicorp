# Decisão 4: Autenticação

## O que o desafio pede

"Login e sessão que sobrevive a um recarregamento da página." Ou seja: depois
de logar, o navegador guarda alguma prova de identidade e o servidor a reconhece
em cada requisição, inclusive na conexão SSE.

Considerei três caminhos: **sessão própria com cookie**, **JWT próprio** e
**Identity Platform / Firebase Auth**. Escolhi sessão própria com cookie
`HttpOnly`, guardada no Postgres.

## Como cada opção funciona

**Sessão própria (stateful).** `POST /login` compara a senha com o hash
(argon2id) no banco, gera um ID aleatório de 32 bytes, grava
`sessoes(id_hash, usuario_id, expira_em)` e devolve o ID num cookie
`HttpOnly; Secure; SameSite=Lax`. A cada requisição o navegador manda o cookie
sozinho; o servidor busca a sessão e sabe quem é. Logout apaga a linha.

**JWT próprio (stateless).** Mesmo login, mas o servidor assina um token
`{sub, exp}` com uma chave secreta. O cliente guarda e envia em cada
requisição; o servidor valida assinatura e expiração sem consultar o banco.
Logout real não existe: o token vale até expirar. Revogar exige lista negra
(um banco de novo) ou tokens curtos + refresh token (uma sessão disfarçada).

**Identity Platform (gerenciado).** O front usa o SDK do Google; o login
acontece contra o Google (e-mail/senha, Google, Microsoft). O SDK devolve um
ID token assinado pelo Google e renova sozinho; o backend valida com a chave
pública (JWKS). Senha, reset, bloqueio por tentativas e MFA são do Google.

## Por que não JWT próprio

1. **SSE não manda header.** O `EventSource` do navegador não aceita
   `Authorization`. Para autenticar o stream eu teria que pôr o JWT num cookie
   (e aí é a opção A com mais passos) ou passar o token na URL (vaza em log de
   proxy e histórico).
2. **Sem revogação.** Recepção troca de turno, alguém esquece a tela aberta:
   com JWT não há como derrubar a sessão antes de expirar. Com sessão no banco
   é um `DELETE`.
3. **Ganho que não uso.** A vantagem do JWT é validar sem banco, útil quando
   vários serviços validam a mesma identidade sem compartilhar estado. Aqui há
   um backend e um banco; a consulta à tabela de sessões (indexada, uma linha)
   custa nada.

## Por que não Identity Platform

1. **"Rodar localmente" é requisito.** Identity Platform exige projeto GCP,
   chave de API e emulador para subir o projeto. É atrito exatamente no ponto que o README precisa facilitar. Sessão própria roda com
   `docker compose up`.
2. **Mesma limitação com SSE.** O ID token é um JWT; o stream continuaria
   precisando de cookie ou token na URL.
3. **Login vira caixa-preta.** Para um desafio que pede "autenticação básica",
   mostrar que eu sei fazer hash de senha, ciclo de vida de sessão e cookie
   seguro diz mais do que plugar um SDK.

É a escolha certa para produto real com muitos usuários, login social e MFA,
sem time para cuidar de senha. Fica no README como evolução: em produção eu
plugaria Identity Platform com login Microsoft (já fiz OIDC com Entra ID em
outro projeto); o backend só trocaria a função que valida a credencial,
porque a sessão continua sendo minha.

## Por que sessão própria com cookie

1. **SSE funciona de graça:** `EventSource` manda cookies.
2. **Revogação imediata** em todas as abas.
3. **Zero dependência externa**, custo zero, nada para configurar no GCP.
4. **Mostra fundamento.** Hash com argon2id; ID de sessão aleatório guardado
   como **hash** (se o banco vazar, as sessões não vazam); cookie `__Host-`
   em HTTPS; `SameSite=Lax` (bloqueia CSRF em POST cross-site sem precisar de
   token CSRF); expiração deslizante; limite de tentativas no login.

## Escopo

- Sem cadastro na interface, sem "esqueci a senha", sem 2FA, sem papéis
  (todo usuário logado é recepção). Um `seed` cria usuários de teste com
  credenciais no README.
- 2FA por e-mail (já implementei em outro projeto) fica fora porque exige SMTP
  e não rodaria só com o `docker compose up`.

## Auditoria (quem fez o quê)

Não é requisito, mas é barato e muito útil numa agenda compartilhada: quando
um agendamento some, a recepção quer saber quem cancelou e quando. Cada
`INSERT/UPDATE/DELETE` em `agendamentos` grava uma linha em
`agendamentos_historico(agendamento_id, acao, usuario_id, antes, depois,
criado_em)` dentro da mesma transação. Se der tempo, a interface mostra o
histórico do item; se não, a tabela existe e fica anotada no README. Tracking
de interface (cliques, tempo em tela) fica fora: não é problema de agenda.

