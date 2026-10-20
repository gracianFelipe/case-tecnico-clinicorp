import { fileURLToPath } from "node:url";

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  return valor;
}

function opcional(nome: string, padrao: string): string {
  return process.env[nome] ?? padrao;
}

export const config = {
  port: Number(opcional("PORT", "3000")),
  host: opcional("HOST", "0.0.0.0"),
  databaseUrl: obrigatoria("DATABASE_URL"),
  ambiente: opcional("NODE_ENV", "development"),
  fuso: opcional("FUSO_HORARIO", "America/Sao_Paulo"),
  proxies: Number(opcional("PROXIES_CONFIAVEIS", "0")),
  webDir: opcional("WEB_DIR", fileURLToPath(new URL("../../web/dist", import.meta.url))),
} as const;

export const emProducao = config.ambiente === "production";
