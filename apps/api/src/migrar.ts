import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Sql } from "./db.js";

const pastaDb = fileURLToPath(new URL("../db/", import.meta.url));

export async function migrar(sql: Sql): Promise<string[]> {
  await sql`CREATE TABLE IF NOT EXISTS migracoes (
    nome text PRIMARY KEY,
    aplicada_em timestamptz NOT NULL DEFAULT now()
  )`;

  const arquivos = (await readdir(pastaDb)).filter((n) => n.endsWith(".sql")).sort();
  const aplicadas = new Set(
    (await sql<{ nome: string }[]>`SELECT nome FROM migracoes`).map((r) => r.nome),
  );

  const novas: string[] = [];
  await sql.begin(async (tx) => {
    // evita duas instâncias migrando ao mesmo tempo
    await tx`SELECT pg_advisory_xact_lock(42)`;
    for (const nome of arquivos) {
      if (aplicadas.has(nome)) continue;
      await tx.unsafe(await readFile(path.join(pastaDb, nome), "utf8"));
      await tx`INSERT INTO migracoes (nome) VALUES (${nome})`;
      novas.push(nome);
    }
  });
  return novas;
}
