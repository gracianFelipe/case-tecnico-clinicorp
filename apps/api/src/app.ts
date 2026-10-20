import Fastify from "fastify";
import type { Sql } from "./db.js";

export type Dependencias = { sql: Sql };

export async function construirApp(_deps: Dependencias) {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  });

  app.get("/api/health", async () => ({ status: "ok" }));

  return app;
}

export type App = Awaited<ReturnType<typeof construirApp>>;
