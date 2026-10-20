import type { Sql } from "../db.js";
import { CANAL_AGENDA } from "./servico.js";

export type EventoAgenda = { profissionalId: number; data: string };
type Ouvinte = (evento: EventoAgenda) => void;

// uma conexão LISTEN por instância, fora do pool
export class BarramentoAgenda {
  private readonly ouvintes = new Map<string, Set<Ouvinte>>();
  private escuta: { unlisten: () => Promise<void> } | undefined;

  constructor(private readonly sql: Sql) {}

  async iniciar() {
    this.escuta = await this.sql.listen(CANAL_AGENDA, (bruto) => {
      let evento: EventoAgenda;
      try {
        evento = JSON.parse(bruto) as EventoAgenda;
      } catch {
        return;
      }
      for (const ouvinte of this.ouvintes.get(chave(evento)) ?? []) ouvinte(evento);
    });
  }

  async parar() {
    await this.escuta?.unlisten();
    this.ouvintes.clear();
  }

  inscrever(alvo: EventoAgenda, ouvinte: Ouvinte): () => void {
    const k = chave(alvo);
    const conjunto = this.ouvintes.get(k) ?? new Set();
    conjunto.add(ouvinte);
    this.ouvintes.set(k, conjunto);
    return () => {
      conjunto.delete(ouvinte);
      if (conjunto.size === 0) this.ouvintes.delete(k);
    };
  }

  get total() {
    let n = 0;
    for (const c of this.ouvintes.values()) n += c.size;
    return n;
  }
}

const chave = (e: EventoAgenda) => `${e.profissionalId}:${e.data}`;
