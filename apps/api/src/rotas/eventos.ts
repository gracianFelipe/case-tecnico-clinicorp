import type { FastifyInstance } from "fastify";
import type { BarramentoAgenda } from "../agenda/eventos.js";

const schema = {
  querystring: {
    type: "object",
    required: ["profissional", "data"],
    properties: {
      profissional: { type: "integer", minimum: 1 },
      data: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    },
  },
} as const;

const HEARTBEAT_MS = 25_000;

export default async function rotasEventos(app: FastifyInstance, { barramento }: { barramento: BarramentoAgenda }) {
  app.addHook("onRequest", app.exigirLogin);

  app.get<{ Querystring: { profissional: number; data: string } }>(
    "/api/eventos", { schema },
    async (req, reply) => {
      const alvo = { profissionalId: req.query.profissional, data: req.query.data };

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      reply.raw.write("retry: 2000\n\n");

      const cancelar = barramento.inscrever(alvo, (evento) => {
        reply.raw.write(`event: mudou\ndata: ${JSON.stringify(evento)}\n\n`);
      });
      const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), HEARTBEAT_MS);

      req.raw.on("close", () => {
        clearInterval(heartbeat);
        cancelar();
      });

      await new Promise<void>((resolve) => req.raw.on("close", resolve));
      return reply;
    },
  );
}
