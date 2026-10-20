import postgres from "postgres";
import { migrar } from "../src/migrar.js";

export function conectarBancoDeTeste() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error("Defina DATABASE_URL_TEST (ex.: postgres://agenda:agenda@localhost:5433/agenda_test)");
  }
  const nome = new URL(url).pathname;
  if (!nome.endsWith("_test")) {
    throw new Error(`Banco de teste precisa terminar em _test, recebido: ${nome}`);
  }
  return postgres(url, { max: 5, onnotice: () => {} });
}

export async function prepararBancoDeTeste() {
  const sql = conectarBancoDeTeste();
  await migrar(sql);
  await limparTabelas(sql);
  return sql;
}

export async function limparTabelas(sql: ReturnType<typeof postgres>) {
  await sql`TRUNCATE agendamentos_historico, agendamentos, sessoes, profissionais, usuarios RESTART IDENTITY CASCADE`;
}

export async function limparAgenda(sql: ReturnType<typeof postgres>) {
  await sql`TRUNCATE agendamentos_historico, agendamentos, profissionais RESTART IDENTITY CASCADE`;
}
