import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { construirApp, type App } from "../src/app.js";
import { conectarBancoDeTeste } from "./setup-db.js";

describe("GET /api/health", () => {
  let app: App;
  const sql = conectarBancoDeTeste();

  beforeAll(async () => {
    app = await construirApp({ sql, cookieSeguro: false, fuso: "America/Sao_Paulo" });
  });
  afterAll(async () => {
    await app.close();
    await sql.end();
  });

  it("responde ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
