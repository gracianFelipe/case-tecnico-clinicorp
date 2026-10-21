import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";
import { ErroHttp } from "../erros.js";
import { ServicoAgenda, type NovoAgendamento } from "../agenda/servico.js";

const horario = {
  inicio: { type: "string", format: "date-time" },
  fim: { type: "string", format: "date-time" },
} as const;

const schemaNovo = {
  body: {
    type: "object",
    required: ["profissionalId", "paciente", "inicio", "fim"],
    additionalProperties: false,
    properties: {
      profissionalId: { type: "integer", minimum: 1 },
      paciente: { type: "string", minLength: 1, maxLength: 120 },
      observacao: { type: "string", maxLength: 500 },
      ...horario,
    },
  },
} as const;

const schemaHorario = {
  params: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
  body: { type: "object", required: ["inicio", "fim"], additionalProperties: false, properties: horario },
} as const;

const schemaId = { params: schemaHorario.params } as const;

const schemaDia = {
  querystring: {
    type: "object",
    required: ["profissional", "data"],
    properties: {
      profissional: { type: "integer", minimum: 1 },
      data: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    },
  },
} as const;

const schemaProximos = {
  querystring: {
    type: "object",
    required: ["profissional"],
    properties: {
      profissional: { type: "integer", minimum: 1 },
      limite: { type: "integer", minimum: 1, maximum: 20, default: 5 },
    },
  },
} as const;

type Id = { id: number };
type Horario = { inicio: string; fim: string };

function validarHorario({ inicio, fim }: Horario) {
  const duracao = Date.parse(fim) - Date.parse(inicio);
  if (!(duracao > 0)) throw new ErroHttp(400, "fim deve ser depois do início");
  if (duracao > 12 * 60 * 60 * 1000) throw new ErroHttp(400, "agendamento não pode passar de 12 horas");
}

export default async function rotasAgenda(app: FastifyInstance, { sql, fuso }: { sql: Sql; fuso: string }) {
  const servico = new ServicoAgenda(sql, fuso);
  app.addHook("onRequest", app.exigirLogin);

  app.get("/api/profissionais", async () =>
    sql`SELECT id, nome FROM profissionais WHERE ativo ORDER BY nome`);

  app.get<{ Querystring: { profissional: number; data: string } }>(
    "/api/agenda", { schema: schemaDia },
    async (req) => servico.listarDia(req.query.profissional, req.query.data),
  );
  app.get<{ Querystring: { profissional: number; limite: number } }>(
    "/api/agenda/proximos", { schema: schemaProximos },
    async (req) => servico.proximos(req.query.profissional, req.query.limite),
  );

  app.post<{ Body: NovoAgendamento }>("/api/agendamentos", { schema: schemaNovo }, async (req, reply) => {
    validarHorario(req.body);
    const criado = await servico.criar(req.body, req.usuario!.id);
    return reply.code(201).send(criado);
  });

  app.patch<{ Params: Id; Body: Horario }>(
    "/api/agendamentos/:id/horario", { schema: schemaHorario },
    async (req) => {
      validarHorario(req.body);
      return servico.mover(req.params.id, req.body, req.usuario!.id);
    },
  );

  app.delete<{ Params: Id }>("/api/agendamentos/:id", { schema: schemaId }, async (req, reply) => {
    await servico.cancelar(req.params.id, req.usuario!.id);
    return reply.code(204).send();
  });

  app.get<{ Params: Id }>("/api/agendamentos/:id/historico", { schema: schemaId }, async (req) =>
    servico.historico(req.params.id));
}
