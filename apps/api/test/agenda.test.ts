import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type postgres from "postgres";
import { construirApp, type App } from "../src/app.js";
import { gerarHashSenha } from "../src/auth/senha.js";
import { limparAgenda, prepararBancoDeTeste } from "./setup-db.js";

const H = (hhmm: string, dia = "2026-10-20") => `${dia}T${hhmm}:00.000Z`;

describe("rotas de agenda", () => {
  let sql: ReturnType<typeof postgres>;
  let app: App;
  let cookies: Record<string, string>;
  let profissionalId: number;

  beforeAll(async () => {
    sql = await prepararBancoDeTeste();
    app = await construirApp({ sql, cookieSeguro: false, fuso: "America/Sao_Paulo" });
    await sql`INSERT INTO usuarios (email, nome, senha_hash)
              VALUES ('recepcao@example.com', 'Recepção Teste', ${await gerarHashSenha("senha-teste")})`;
    const login = await app.inject({
      method: "POST", url: "/api/login", payload: { email: "recepcao@example.com", senha: "senha-teste" },
    });
    cookies = { sessao: login.cookies.find((c) => c.name === "sessao")!.value };
  });
  afterAll(async () => {
    await app.close();
    await sql.end();
  });
  beforeEach(async () => {
    await limparAgenda(sql);
    [{ id: profissionalId }] = await sql<{ id: number }[]>`
      INSERT INTO profissionais (nome) VALUES ('Dra. Exemplo') RETURNING id`;
  });

  const criar = (inicio: string, fim: string, extra: Record<string, unknown> = {}) =>
    app.inject({
      method: "POST", url: "/api/agendamentos", cookies,
      payload: { profissionalId, paciente: "Paciente Teste", inicio, fim, ...extra },
    });
  const agenda = (data = "2026-10-20") =>
    app.inject({ method: "GET", url: `/api/agenda?profissional=${profissionalId}&data=${data}`, cookies });

  it("exige login em todas as rotas", async () => {
    for (const [method, url] of [
      ["GET", "/api/agenda?profissional=1&data=2026-10-20"],
      ["POST", "/api/agendamentos"],
      ["PATCH", "/api/agendamentos/1/horario"],
      ["DELETE", "/api/agendamentos/1"],
    ] as const) {
      const res = await app.inject({ method, url, payload: {} });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it("cria e lista no dia certo, respeitando o fuso da clínica", async () => {
    const res = await criar(H("13:00"), H("13:30"));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      profissionalId, paciente: "Paciente Teste", inicio: H("13:00"), fim: H("13:30"), observacao: null,
    });

    await criar(H("01:00", "2026-10-21"), H("01:30", "2026-10-21"));

    const dia20 = (await agenda("2026-10-20")).json<unknown[]>();
    const dia21 = (await agenda("2026-10-21")).json<unknown[]>();
    expect(dia20).toHaveLength(2);
    expect(dia21).toHaveLength(0);
  });

  it("responde 409 quando o horário se sobrepõe a outro do mesmo profissional", async () => {
    await criar(H("13:00"), H("13:30"));
    const res = await criar(H("13:15"), H("13:45"));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ erro: "o profissional já tem um agendamento nesse horário" });
  });

  it("aceita horário adjacente", async () => {
    await criar(H("13:00"), H("13:30"));
    expect((await criar(H("13:30"), H("14:00"))).statusCode).toBe(201);
  });

  it("valida o corpo: fim antes do início, campos faltando, profissional inexistente", async () => {
    expect((await criar(H("13:30"), H("13:00"))).statusCode).toBe(400);
    expect((await criar(H("13:00"), H("13:00"))).statusCode).toBe(400);
    expect((await criar("ontem", H("13:00"))).statusCode).toBe(400);
    const semPaciente = await app.inject({
      method: "POST", url: "/api/agendamentos", cookies,
      payload: { profissionalId, inicio: H("13:00"), fim: H("13:30") },
    });
    expect(semPaciente.statusCode).toBe(400);
    expect((await criar(H("13:00"), H("13:30"), { profissionalId: 999 })).statusCode).toBe(422);
  });

  it("move um agendamento e recusa mover para cima de outro", async () => {
    const a = (await criar(H("13:00"), H("13:30"))).json<{ id: number }>();
    await criar(H("14:00"), H("14:30"));

    const ok = await app.inject({
      method: "PATCH", url: `/api/agendamentos/${a.id}/horario`, cookies,
      payload: { inicio: H("15:00"), fim: H("15:30") },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ id: a.id, inicio: H("15:00"), fim: H("15:30") });

    const conflito = await app.inject({
      method: "PATCH", url: `/api/agendamentos/${a.id}/horario`, cookies,
      payload: { inicio: H("14:15"), fim: H("14:45") },
    });
    expect(conflito.statusCode).toBe(409);
    const lista = (await agenda()).json<{ id: number; inicio: string }[]>();
    expect(lista.find((x) => x.id === a.id)?.inicio).toBe(H("15:00"));
  });

  it("mover para o próprio horário (sem mudança) não conflita consigo mesmo", async () => {
    const a = (await criar(H("13:00"), H("13:30"))).json<{ id: number }>();
    const res = await app.inject({
      method: "PATCH", url: `/api/agendamentos/${a.id}/horario`, cookies,
      payload: { inicio: H("13:00"), fim: H("13:45") },
    });
    expect(res.statusCode).toBe(200);
  });

  it("cancela, some da agenda, libera o horário e não pode ser cancelado de novo", async () => {
    const a = (await criar(H("13:00"), H("13:30"))).json<{ id: number }>();
    expect((await app.inject({ method: "DELETE", url: `/api/agendamentos/${a.id}`, cookies })).statusCode).toBe(204);
    expect((await agenda()).json()).toEqual([]);
    expect((await criar(H("13:00"), H("13:30"))).statusCode).toBe(201);
    expect((await app.inject({ method: "DELETE", url: `/api/agendamentos/${a.id}`, cookies })).statusCode).toBe(404);
    expect((await app.inject({
      method: "PATCH", url: `/api/agendamentos/${a.id}/horario`, cookies,
      payload: { inicio: H("16:00"), fim: H("16:30") },
    })).statusCode).toBe(404);
  });

  it("registra o histórico de quem fez o quê", async () => {
    const a = (await criar(H("13:00"), H("13:30"))).json<{ id: number }>();
    await app.inject({
      method: "PATCH", url: `/api/agendamentos/${a.id}/horario`, cookies,
      payload: { inicio: H("15:00"), fim: H("15:30") },
    });
    await app.inject({ method: "DELETE", url: `/api/agendamentos/${a.id}`, cookies });

    const hist = (await app.inject({ method: "GET", url: `/api/agendamentos/${a.id}/historico`, cookies }))
      .json<{ acao: string; por: string }[]>();
    expect(hist.map((h) => h.acao)).toEqual(["criado", "movido", "cancelado"]);
    expect(hist.every((h) => h.por === "Recepção Teste")).toBe(true);
  });

  it("sob concorrência pela API, só uma de N criações no mesmo horário é aceita", async () => {
    const respostas = await Promise.all(
      Array.from({ length: 10 }, () => criar(H("17:00"), H("17:30"))),
    );
    const codigos = respostas.map((r) => r.statusCode).sort();
    expect(codigos.filter((c) => c === 201)).toHaveLength(1);
    expect(codigos.filter((c) => c === 409)).toHaveLength(9);
    expect((await agenda()).json()).toHaveLength(1);
  });
});
