import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import type { Sql } from "../db.js";
import { verificarSenha } from "../auth/senha.js";
import { apagarSessao, criarSessao, DURACAO_SESSAO_MS } from "../auth/sessao.js";
import { nomeCookie, opcoesCookie } from "../plugins/auth.js";

const loginSchema = {
  body: {
    type: "object",
    required: ["email", "senha"],
    additionalProperties: false,
    properties: {
      email: { type: "string", format: "email", maxLength: 254 },
      senha: { type: "string", minLength: 1, maxLength: 200 },
    },
  },
} as const;

type LoginBody = { email: string; senha: string };

export default async function rotasAuth(app: FastifyInstance, { sql, cookieSeguro }: { sql: Sql; cookieSeguro: boolean }) {
  const nome = nomeCookie(cookieSeguro);
  const opcoes = opcoesCookie(cookieSeguro);

  await app.register(rateLimit, { global: false });

  app.post<{ Body: LoginBody }>(
    "/api/login",
    { schema: loginSchema, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const [usuario] = await sql<{ id: number; senha_hash: string }[]>`
        SELECT id, senha_hash FROM usuarios WHERE email = ${req.body.email.toLowerCase()}`;
      const ok = usuario ? await verificarSenha(req.body.senha, usuario.senha_hash) : false;
      if (!usuario || !ok) {
        return reply.code(401).send({ erro: "e-mail ou senha inválidos" });
      }
      const token = await criarSessao(sql, usuario.id);
      reply.setCookie(nome, token, { ...opcoes, maxAge: DURACAO_SESSAO_MS / 1000 });
      return reply.code(204).send();
    },
  );

  app.post("/api/logout", async (req, reply) => {
    const token = req.cookies[nome];
    if (token) await apagarSessao(sql, token);
    reply.clearCookie(nome, opcoes);
    return reply.code(204).send();
  });

  app.get("/api/me", { preHandler: app.exigirLogin }, async (req) => req.usuario);
}
