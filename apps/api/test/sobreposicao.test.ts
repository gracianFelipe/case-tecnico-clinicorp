import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type postgres from "postgres";
import { limparTabelas, prepararBancoDeTeste } from "./setup-db.js";

describe("constraint agendamentos_sem_sobreposicao", () => {
  let sql: ReturnType<typeof postgres>;
  let usuarioId: number;
  let profissionalId: number;

  beforeAll(async () => {
    sql = await prepararBancoDeTeste();
  });
  afterAll(async () => {
    await sql.end();
  });
  beforeEach(async () => {
    await limparTabelas(sql);
    [{ id: usuarioId }] = await sql<{ id: number }[]>`
      INSERT INTO usuarios (email, nome, senha_hash)
      VALUES ('recepcao@example.com', 'Recepção Teste', 'x') RETURNING id`;
    [{ id: profissionalId }] = await sql<{ id: number }[]>`
      INSERT INTO profissionais (nome) VALUES ('Dra. Exemplo') RETURNING id`;
  });

  const inserir = (inicio: string, fim: string, prof = profissionalId) =>
    sql`INSERT INTO agendamentos (profissional_id, paciente, periodo, criado_por)
        VALUES (${prof}, 'Paciente Teste', tstzrange(${inicio}, ${fim}, '[)'), ${usuarioId})`;

  it("rejeita dois agendamentos sobrepostos do mesmo profissional", async () => {
    await inserir("2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z");
    await expect(inserir("2026-10-20T10:15:00Z", "2026-10-20T10:45:00Z")).rejects.toMatchObject({
      constraint_name: "agendamentos_sem_sobreposicao",
    });
  });

  it("aceita agendamentos adjacentes (fim de um = início do outro)", async () => {
    await inserir("2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z");
    await expect(inserir("2026-10-20T10:30:00Z", "2026-10-20T11:00:00Z")).resolves.toBeDefined();
  });

  it("aceita o mesmo horário para profissionais diferentes", async () => {
    const [{ id: outro }] = await sql<{ id: number }[]>`
      INSERT INTO profissionais (nome) VALUES ('Dr. Outro') RETURNING id`;
    await inserir("2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z");
    await expect(inserir("2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z", outro)).resolves.toBeDefined();
  });

  it("libera o horário quando o agendamento anterior foi cancelado", async () => {
    await inserir("2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z");
    await sql`UPDATE agendamentos SET cancelado_em = now()`;
    await expect(inserir("2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z")).resolves.toBeDefined();
  });

  it("rejeita período vazio ou invertido", async () => {
    await expect(inserir("2026-10-20T10:30:00Z", "2026-10-20T10:00:00Z")).rejects.toBeDefined();
  });

  it("sob concorrência, só um de N inserts no mesmo horário é aceito", async () => {
    const tentativas = Array.from({ length: 10 }, () =>
      inserir("2026-10-20T14:00:00Z", "2026-10-20T14:30:00Z").then(
        () => "ok" as const,
        () => "conflito" as const,
      ),
    );
    const resultados = await Promise.all(tentativas);
    expect(resultados.filter((r) => r === "ok")).toHaveLength(1);
    const [{ total }] = await sql<{ total: number }[]>`
      SELECT count(*)::int AS total FROM agendamentos WHERE cancelado_em IS NULL`;
    expect(total).toBe(1);
  });
});
