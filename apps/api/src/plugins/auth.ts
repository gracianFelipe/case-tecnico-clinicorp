import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Sql } from "../db.js";
import { buscarUsuarioDaSessao, type Usuario } from "../auth/sessao.js";

declare module "fastify" {
  interface FastifyRequest {
    usuario: Usuario | null;
  }
  interface FastifyInstance {
    exigirLogin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export type OpcoesAuth = { sql: Sql; cookieSeguro: boolean };

export const nomeCookie = (seguro: boolean) => (seguro ? "__Host-sessao" : "sessao");

export const opcoesCookie = (seguro: boolean) => ({
  httpOnly: true,
  secure: seguro,
  sameSite: "lax" as const,
  path: "/",
});

export default fp<OpcoesAuth>(async (app, { sql, cookieSeguro }) => {
  await app.register(cookie);
  const nome = nomeCookie(cookieSeguro);

  app.decorateRequest("usuario", null);

  app.addHook("onRequest", async (req) => {
    const token = req.cookies[nome];
    req.usuario = token ? await buscarUsuarioDaSessao(sql, token) : null;
  });

  app.decorate("exigirLogin", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.usuario) {
      await reply.code(401).send({ erro: "não autenticado" });
    }
  });
});
