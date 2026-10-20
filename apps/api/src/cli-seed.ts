import { sql } from "./db.js";
import { migrar } from "./migrar.js";
import { gerarHashSenha } from "./auth/senha.js";

await migrar(sql);

const unica = <T>(linhas: T[]): T => {
  const [linha] = linhas;
  if (!linha) throw new Error("consulta sem resultado");
  return linha;
};

const usuarios = [
  { email: "recepcao@clinica.test", nome: "Ana Recepção", senha: "recepcao123" },
  { email: "admin@clinica.test", nome: "Bruno Admin", senha: "admin123" },
];
for (const u of usuarios) {
  await sql`INSERT INTO usuarios (email, nome, senha_hash)
            VALUES (${u.email}, ${u.nome}, ${await gerarHashSenha(u.senha)})
            ON CONFLICT (email) DO NOTHING`;
}

const profissionais = ["Dra. Carla Mendes", "Dr. Diego Rocha", "Dra. Elisa Prado"];
const { total } = unica(await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM profissionais`);
if (total === 0) {
  for (const nome of profissionais) await sql`INSERT INTO profissionais (nome) VALUES (${nome})`;
}

const { existentes } = unica(await sql<{ existentes: number }[]>`SELECT count(*)::int AS existentes FROM agendamentos`);
if (existentes === 0) {
  const { id: usuarioId } = unica(await sql<{ id: number }[]>`SELECT id FROM usuarios ORDER BY id LIMIT 1`);
  const { id: profId } = unica(await sql<{ id: number }[]>`SELECT id FROM profissionais ORDER BY id LIMIT 1`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em = (h: number, m = 0) => new Date(hoje.getTime() + (h * 60 + m) * 60_000);
  const exemplos: [string, Date, Date][] = [
    ["Paciente Exemplo 1", em(9), em(9, 30)],
    ["Paciente Exemplo 2", em(10), em(10, 30)],
    ["Paciente Exemplo 3", em(14), em(15)],
  ];
  for (const [paciente, inicio, fim] of exemplos) {
    const { id } = unica(await sql<{ id: number }[]>`
      INSERT INTO agendamentos (profissional_id, paciente, periodo, criado_por)
      VALUES (${profId}, ${paciente}, tstzrange(${inicio}, ${fim}, '[)'), ${usuarioId}) RETURNING id`);
    await sql`INSERT INTO agendamentos_historico (agendamento_id, acao, usuario_id, periodo_depois)
              VALUES (${id}, 'criado', ${usuarioId}, tstzrange(${inicio}, ${fim}, '[)'))`;
  }
}

console.log("seed concluído");
await sql.end();
