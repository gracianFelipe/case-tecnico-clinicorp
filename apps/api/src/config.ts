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
} as const;

export const emProducao = config.ambiente === "production";
