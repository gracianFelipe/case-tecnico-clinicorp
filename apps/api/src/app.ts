import Fastify, { type FastifyError } from "fastify";
import type { Sql } from "./db.js";
import { ErroHttp } from "./erros.js";
import pluginAuth from "./plugins/auth.js";
import rotasAuth from "./rotas/auth.js";
import rotasAgenda from "./rotas/agenda.js";
import rotasEventos from "./rotas/eventos.js";
import { BarramentoAgenda } from "./agenda/eventos.js";

export type Dependencias = {
  sql: Sql;
  cookieSeguro: boolean;
  fuso: string;
};

export async function construirApp(deps: Dependencias) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: ["req.headers.cookie", "req.headers.authorization"],
    },
    ajv: { customOptions: { allErrors: false } },
  });

  app.setErrorHandler((erro: FastifyError | ErroHttp, req, reply) => {
    const status = erro instanceof ErroHttp ? erro.statusCode : (erro.statusCode ?? 500);
    if (status >= 500) {
      req.log.error(erro);
      return reply.code(500).send({ erro: "erro interno" });
    }
    return reply.code(status).send({ erro: erro.message });
  });

  app.get("/api/health", async () => ({ status: "ok" }));

  await app.register(pluginAuth, deps);
  await app.register(rotasAuth, deps);
  await app.register(rotasAgenda, deps);

  const barramento = new BarramentoAgenda(deps.sql);
  await barramento.iniciar();
  app.addHook("onClose", () => barramento.parar());
  await app.register(rotasEventos, { barramento });

  return app;
}

export type App = Awaited<ReturnType<typeof construirApp>>;
