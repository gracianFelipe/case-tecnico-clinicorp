import type { TransactionSql } from "postgres";
import type { Sql } from "../db.js";
import { ErroHttp, SQLSTATE, conflitoHorario, naoEncontrado } from "../erros.js";

export type Agendamento = {
  id: number;
  profissionalId: number;
  paciente: string;
  inicio: string;
  fim: string;
  observacao: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type NovoAgendamento = {
  profissionalId: number;
  paciente: string;
  inicio: string;
  fim: string;
  observacao?: string | undefined;
};

type Linha = Omit<Agendamento, "inicio" | "fim" | "criadoEm" | "atualizadoEm"> & {
  inicio: Date;
  fim: Date;
  criadoEm: Date;
  atualizadoEm: Date;
};

export const CANAL_AGENDA = "agenda";

export class ServicoAgenda {
  constructor(
    private readonly sql: Sql,
    private readonly fuso: string,
  ) {}

  async listarDia(profissionalId: number, data: string): Promise<Agendamento[]> {
    const linhas = await this.sql<Linha[]>`
      SELECT ${this.colunas()}
      FROM agendamentos
      WHERE profissional_id = ${profissionalId}
        AND cancelado_em IS NULL
        AND periodo && ${this.rangeDoDia(data)}
      ORDER BY lower(periodo)`;
    return linhas.map(paraJson);
  }

  async proximos(profissionalId: number, limite: number): Promise<Agendamento[]> {
    const linhas = await this.sql<Linha[]>`
      SELECT ${this.colunas()}
      FROM agendamentos
      WHERE profissional_id = ${profissionalId}
        AND cancelado_em IS NULL
        AND upper(periodo) > now()
      ORDER BY lower(periodo)
      LIMIT ${limite}`;
    return linhas.map(paraJson);
  }

  async criar(novo: NovoAgendamento, usuarioId: number): Promise<Agendamento> {
    return this.sql.begin(async (tx) => {
      const [linha] = await capturar(
        () => tx<Linha[]>`
          INSERT INTO agendamentos (profissional_id, paciente, periodo, observacao, criado_por)
          VALUES (${novo.profissionalId}, ${novo.paciente},
                  tstzrange(${novo.inicio}, ${novo.fim}, '[)'),
                  ${novo.observacao ?? null}, ${usuarioId})
          RETURNING ${this.colunas()}`,
      );
      await tx`INSERT INTO agendamentos_historico (agendamento_id, acao, usuario_id, periodo_depois)
               VALUES (${linha!.id}, 'criado', ${usuarioId}, tstzrange(${novo.inicio}, ${novo.fim}, '[)'))`;
      await this.notificar(tx, linha!.profissionalId, [linha!.inicio]);
      return paraJson(linha!);
    });
  }

  async mover(id: number, horario: { inicio: string; fim: string }, usuarioId: number): Promise<Agendamento> {
    return this.sql.begin(async (tx) => {
      const [antes] = await tx<Linha[]>`
        SELECT ${this.colunas()} FROM agendamentos
        WHERE id = ${id} AND cancelado_em IS NULL FOR UPDATE`;
      if (!antes) throw naoEncontrado("agendamento");

      const [depois] = await capturar(
        () => tx<Linha[]>`
          UPDATE agendamentos
          SET periodo = tstzrange(${horario.inicio}, ${horario.fim}, '[)'), atualizado_em = now()
          WHERE id = ${id}
          RETURNING ${this.colunas()}`,
      );
      await tx`INSERT INTO agendamentos_historico (agendamento_id, acao, usuario_id, periodo_antes, periodo_depois)
               VALUES (${id}, 'movido', ${usuarioId},
                       tstzrange(${antes.inicio}, ${antes.fim}, '[)'),
                       tstzrange(${horario.inicio}, ${horario.fim}, '[)'))`;
      await this.notificar(tx, antes.profissionalId, [antes.inicio, depois!.inicio]);
      return paraJson(depois!);
    });
  }

  async cancelar(id: number, usuarioId: number): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [linha] = await tx<Linha[]>`
        UPDATE agendamentos SET cancelado_em = now(), atualizado_em = now()
        WHERE id = ${id} AND cancelado_em IS NULL
        RETURNING ${this.colunas()}`;
      if (!linha) throw naoEncontrado("agendamento");
      await tx`INSERT INTO agendamentos_historico (agendamento_id, acao, usuario_id, periodo_antes)
               VALUES (${id}, 'cancelado', ${usuarioId}, tstzrange(${linha.inicio}, ${linha.fim}, '[)'))`;
      await this.notificar(tx, linha.profissionalId, [linha.inicio]);
    });
  }

  async historico(id: number) {
    const [existe] = await this.sql`SELECT 1 FROM agendamentos WHERE id = ${id}`;
    if (!existe) throw naoEncontrado("agendamento");
    return this.sql`
      SELECT h.acao, h.criado_em AS "em", u.nome AS "por",
             lower(h.periodo_antes) AS "inicioAntes", upper(h.periodo_antes) AS "fimAntes",
             lower(h.periodo_depois) AS "inicioDepois", upper(h.periodo_depois) AS "fimDepois"
      FROM agendamentos_historico h JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.agendamento_id = ${id}
      ORDER BY h.criado_em`;
  }

  diaDe(instante: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: this.fuso, year: "numeric", month: "2-digit", day: "2-digit" })
      .format(instante);
  }

  // dentro da transação: o NOTIFY só sai no commit
  private async notificar(tx: TransactionSql, profissionalId: number, instantes: Date[]) {
    const dias = [...new Set(instantes.map((i) => this.diaDe(i)))];
    for (const data of dias) {
      await tx`SELECT pg_notify(${CANAL_AGENDA}, ${JSON.stringify({ profissionalId, data })})`;
    }
  }

  private rangeDoDia(data: string) {
    return this.sql`tstzrange(
      (${data}::date)::timestamp AT TIME ZONE ${this.fuso},
      (${data}::date + 1)::timestamp AT TIME ZONE ${this.fuso}, '[)')`;
  }

  private colunas() {
    return this.sql`id, profissional_id AS "profissionalId", paciente, observacao,
      lower(periodo) AS inicio, upper(periodo) AS fim,
      criado_em AS "criadoEm", atualizado_em AS "atualizadoEm"`;
  }
}

function paraJson(l: Linha): Agendamento {
  return {
    ...l,
    inicio: l.inicio.toISOString(),
    fim: l.fim.toISOString(),
    criadoEm: l.criadoEm.toISOString(),
    atualizadoEm: l.atualizadoEm.toISOString(),
  };
}

async function capturar<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (erro) {
    const code = (erro as { code?: string }).code;
    if (code === SQLSTATE.exclusaoViolada) throw conflitoHorario();
    if (code === SQLSTATE.chaveEstrangeiraViolada) throw new ErroHttp(422, "profissional inexistente");
    if (code === SQLSTATE.checkViolado) throw new ErroHttp(400, "período inválido");
    throw erro;
  }
}
