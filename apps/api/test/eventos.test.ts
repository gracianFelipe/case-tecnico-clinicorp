import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type postgres from "postgres";
import { construirApp, type App } from "../src/app.js";
import { gerarHashSenha } from "../src/auth/senha.js";
import { limparTabelas, prepararBancoDeTeste } from "./setup-db.js";

const H = (hhmm: string) => `2026-10-20T${hhmm}:00.000Z`;

describe("GET /api/eventos (SSE)", () => {
  let sql: ReturnType<typeof postgres>;
  let app: App;
  let base: string;
  let cookie: string;
  let profA: number;
  let profB: number;

  beforeAll(async () => {
    sql = await prepararBancoDeTeste();
    await limparTabelas(sql);
    app = await construirApp({ sql, cookieSeguro: false, fuso: "America/Sao_Paulo" });
    await sql`INSERT INTO usuarios (email, nome, senha_hash)
              VALUES ('recepcao@example.com', 'Recepção Teste', ${await gerarHashSenha("senha-teste")})`;
    [{ id: profA }, { id: profB }] = await sql<{ id: number }[]>`
      INSERT INTO profissionais (nome) VALUES ('Dra. A'), ('Dr. B') RETURNING id`;
    base = await app.listen({ port: 0, host: "127.0.0.1" });
    const login = await app.inject({
      method: "POST", url: "/api/login", payload: { email: "recepcao@example.com", senha: "senha-teste" },
    });
    cookie = `sessao=${login.cookies.find((c) => c.name === "sessao")!.value}`;
  });
  afterAll(async () => {
    await app.close();
    await sql.end();
  });

  async function abrirStream(profissional: number, data = "2026-10-20") {
    const controle = new AbortController();
    const res = await fetch(`${base}/api/eventos?profissional=${profissional}&data=${data}`, {
      headers: { cookie },
      signal: controle.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const leitor = res.body!.getReader();
    const decodificador = new TextDecoder();
    let buffer = "";

    const proximo = async (timeoutMs = 3000): Promise<unknown> => {
      const prazo = Date.now() + timeoutMs;
      while (Date.now() < prazo) {
        const i = buffer.indexOf("event: mudou\n");
        if (i >= 0) {
          const fim = buffer.indexOf("\n\n", i);
          if (fim >= 0) {
            const bloco = buffer.slice(i, fim);
            buffer = buffer.slice(fim + 2);
            return JSON.parse(bloco.split("\ndata: ")[1]!);
          }
        }
        const pedaco = await Promise.race([
          leitor.read(),
          new Promise<{ done: true; value: undefined }>((r) => setTimeout(() => r({ done: true, value: undefined }), 200)),
        ]);
        if (pedaco.value) buffer += decodificador.decode(pedaco.value, { stream: true });
      }
      return null;
    };
    return { proximo, fechar: () => controle.abort() };
  }

  it("exige login", async () => {
    const res = await fetch(`${base}/api/eventos?profissional=${profA}&data=2026-10-20`);
    expect(res.status).toBe(401);
  });

  it("entrega `mudou` quando a agenda inscrita muda, via NOTIFY do Postgres", async () => {
    const stream = await abrirStream(profA);
    try {
      const criado = await app.inject({
        method: "POST", url: "/api/agendamentos", headers: { cookie },
        payload: { profissionalId: profA, paciente: "Paciente Teste", inicio: H("13:00"), fim: H("13:30") },
      });
      expect(criado.statusCode).toBe(201);
      await expect(stream.proximo()).resolves.toEqual({ profissionalId: profA, data: "2026-10-20" });
    } finally {
      stream.fechar();
    }
  });

  it("não entrega mudanças de outro profissional nem de uma criação rejeitada", async () => {
    const stream = await abrirStream(profB);
    try {
      await app.inject({
        method: "POST", url: "/api/agendamentos", headers: { cookie },
        payload: { profissionalId: profA, paciente: "Paciente Teste", inicio: H("15:00"), fim: H("15:30") },
      });
      await app.inject({
        method: "POST", url: "/api/agendamentos", headers: { cookie },
        payload: { profissionalId: profB, paciente: "Paciente Teste", inicio: H("16:00"), fim: H("16:30") },
      });
      const conflito = await app.inject({
        method: "POST", url: "/api/agendamentos", headers: { cookie },
        payload: { profissionalId: profB, paciente: "Paciente Teste", inicio: H("16:10"), fim: H("16:40") },
      });
      expect(conflito.statusCode).toBe(409);

      await expect(stream.proximo()).resolves.toEqual({ profissionalId: profB, data: "2026-10-20" });
      await expect(stream.proximo(700)).resolves.toBeNull();
    } finally {
      stream.fechar();
    }
  });

  it("mover entre dias avisa as duas agendas", async () => {
    const dia20 = await abrirStream(profA, "2026-10-20");
    const dia21 = await abrirStream(profA, "2026-10-21");
    try {
      const a = (await app.inject({
        method: "POST", url: "/api/agendamentos", headers: { cookie },
        payload: { profissionalId: profA, paciente: "Paciente Teste", inicio: H("18:00"), fim: H("18:30") },
      })).json<{ id: number }>();
      await dia20.proximo();
      await app.inject({
        method: "PATCH", url: `/api/agendamentos/${a.id}/horario`, headers: { cookie },
        payload: { inicio: "2026-10-21T18:00:00.000Z", fim: "2026-10-21T18:30:00.000Z" },
      });
      await expect(dia20.proximo()).resolves.toEqual({ profissionalId: profA, data: "2026-10-20" });
      await expect(dia21.proximo()).resolves.toEqual({ profissionalId: profA, data: "2026-10-21" });
    } finally {
      dia20.fechar();
      dia21.fechar();
    }
  });
});
