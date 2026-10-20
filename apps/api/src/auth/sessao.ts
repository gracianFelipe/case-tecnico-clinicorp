import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "../db.js";

export const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000;

export type Usuario = { id: number; email: string; nome: string };

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function criarSessao(sql: Sql, usuarioId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  await sql`INSERT INTO sessoes (id_hash, usuario_id, expira_em)
            VALUES (${hash(token)}, ${usuarioId}, ${expiraEm})`;
  return token;
}

export async function buscarUsuarioDaSessao(sql: Sql, token: string): Promise<Usuario | null> {
  const [usuario] = await sql<Usuario[]>`
    SELECT u.id, u.email, u.nome
    FROM sessoes s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.id_hash = ${hash(token)} AND s.expira_em > now()`;
  return usuario ?? null;
}

export async function apagarSessao(sql: Sql, token: string): Promise<void> {
  await sql`DELETE FROM sessoes WHERE id_hash = ${hash(token)}`;
}
