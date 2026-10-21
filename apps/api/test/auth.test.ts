import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type postgres from "postgres";
import { construirApp, type App } from "../src/app.js";
import { gerarHashSenha, verificarSenha } from "../src/auth/senha.js";
import { limparTabelas, prepararBancoDeTeste } from "./setup-db.js";

describe("hash de senha", () => {
  it("verifica a senha certa e rejeita a errada", async () => {
    const hash = await gerarHashSenha("segredo-teste");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verificarSenha("segredo-teste", hash)).toBe(true);
    expect(await verificarSenha("outra", hash)).toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt)", async () => {
    expect(await gerarHashSenha("x")).not.toBe(await gerarHashSenha("x"));
  });
});

describe("login, sessão e logout", () => {
  let sql: ReturnType<typeof postgres>;
  let app: App;

  beforeAll(async () => {
    sql = await prepararBancoDeTeste();
    app = await construirApp({ sql, cookieSeguro: false, fuso: "America/Sao_Paulo" });
  });
  afterAll(async () => {
    await app.close();
    await sql.end();
  });
  beforeEach(async () => {
    await limparTabelas(sql);
    await sql`INSERT INTO usuarios (email, nome, senha_hash)
              VALUES ('recepcao@example.com', 'Recepção Teste', ${await gerarHashSenha("senha-teste")})`;
  });

  const login = (email: string, senha: string) =>
    app.inject({ method: "POST", url: "/api/login", payload: { email, senha } });

  const cookieDe = (res: { cookies: { name: string; value: string }[] }) =>
    res.cookies.find((c) => c.name === "sessao");

  it("rejeita senha errada e e-mail inexistente com a mesma resposta", async () => {
    const a = await login("recepcao@example.com", "errada");
    const b = await login("ninguem@example.com", "qualquer");
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.body).toBe(b.body);
    expect(cookieDe(a)).toBeUndefined();
  });

  it("rejeita corpo inválido antes de tocar no banco", async () => {
    const res = await app.inject({ method: "POST", url: "/api/login", payload: { email: "x" } });
    expect(res.statusCode).toBe(400);
  });

  it("loga, devolve cookie HttpOnly e /api/me reconhece a sessão", async () => {
    const res = await login("Recepcao@example.com", "senha-teste");
    expect(res.statusCode).toBe(204);
    const cookie = cookieDe(res)!;
    expect(cookie).toBeDefined();
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });

    const me = await app.inject({ method: "GET", url: "/api/me", cookies: { sessao: cookie.value } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ id: 1, email: "recepcao@example.com", nome: "Recepção Teste" });

    const [{ id_hash }] = await sql<{ id_hash: string }[]>`SELECT id_hash FROM sessoes`;
    expect(id_hash).not.toBe(cookie.value);
  });

  it("sem cookie ou com cookie inválido, /api/me responde 401", async () => {
    expect((await app.inject({ method: "GET", url: "/api/me" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/me", cookies: { sessao: "falso" } })).statusCode).toBe(401);
  });

  it("logout invalida a sessão no servidor, não só no navegador", async () => {
    const token = cookieDe(await login("recepcao@example.com", "senha-teste"))!.value;
    const out = await app.inject({ method: "POST", url: "/api/logout", cookies: { sessao: token } });
    expect(out.statusCode).toBe(204);
    const me = await app.inject({ method: "GET", url: "/api/me", cookies: { sessao: token } });
    expect(me.statusCode).toBe(401);
  });

  it("sessão expirada é rejeitada", async () => {
    const token = cookieDe(await login("recepcao@example.com", "senha-teste"))!.value;
    await sql`UPDATE sessoes SET expira_em = now() - interval '1 minute'`;
    const me = await app.inject({ method: "GET", url: "/api/me", cookies: { sessao: token } });
    expect(me.statusCode).toBe(401);
  });

  it("limita tentativas de login por IP", async () => {
    let ultimo = 0;
    for (let i = 0; i < 11; i++) ultimo = (await login("recepcao@example.com", "errada")).statusCode;
    expect(ultimo).toBe(429);
  });
});

describe("limite de login atrás de proxy", () => {
  let sql: ReturnType<typeof postgres>;
  let app: App;

  beforeAll(async () => {
    sql = await prepararBancoDeTeste();
    app = await construirApp({ sql, cookieSeguro: false, fuso: "America/Sao_Paulo", cabecalhoIp: "cf-connecting-ip" });
  });
  afterAll(async () => {
    await app.close();
    await sql.end();
  });

  const tentar = (ip: string) =>
    app.inject({
      method: "POST",
      url: "/api/login",
      headers: { "cf-connecting-ip": ip },
      payload: { email: "ninguem@example.com", senha: "errada" },
    });

  it("conta as tentativas pelo IP informado pelo proxy, não pelo socket", async () => {
    let ultimo = 0;
    for (let i = 0; i < 11; i++) ultimo = (await tentar("203.0.113.7")).statusCode;
    expect(ultimo).toBe(429);
    expect((await tentar("203.0.113.8")).statusCode).toBe(401);
  });
});
