import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { hojeISO, localISO } from "../datas";
import { Flutuante } from "./Flutuante";

type Props = { valor: string; aoMudar: (iso: string) => void };

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function Calendario({ valor, aoMudar }: Props) {
  return (
    <Flutuante
      alinhar="direita"
      classe="w-[296px] p-3"
      gatilho={(aberto, alternar) => (
        <button
          type="button"
          aria-label="Escolher data"
          aria-expanded={aberto}
          onClick={alternar}
          className={`cursor-pointer rounded-[10px] px-2.5 py-2 transition-colors duration-150 hover:bg-fundo-2 ${aberto ? "bg-fundo-2 text-marrom" : ""}`}
        >
          <CalendarDays size={18} />
        </button>
      )}
    >
      {(fechar) => <Mes valor={valor} aoEscolher={(iso) => { aoMudar(iso); fechar(); }} />}
    </Flutuante>
  );
}

function Mes({ valor, aoEscolher }: { valor: string; aoEscolher: (iso: string) => void }) {
  const [y0, m0] = valor.split("-").map(Number) as [number, number];
  const [ano, setAno] = useState(y0);
  const [mes, setMes] = useState(m0 - 1);
  const hoje = hojeISO();

  const primeiro = new Date(ano, mes, 1);
  const inicioGrade = new Date(ano, mes, 1 - primeiro.getDay());
  const celulas = Array.from({ length: 42 }, (_, i) => new Date(inicioGrade.getFullYear(), inicioGrade.getMonth(), inicioGrade.getDate() + i));
  const titulo = primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" className="alvo cursor-pointer rounded-[8px] p-2 hover:bg-fundo-2" onClick={() => mudarMes(-1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="font-serif text-[15px] font-semibold capitalize">{titulo}</span>
        <button type="button" aria-label="Próximo mês" className="alvo cursor-pointer rounded-[8px] p-2 hover:bg-fundo-2" onClick={() => mudarMes(1)}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-tinta-3">
        {DIAS.map((d, i) => <span key={i} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {celulas.map((d) => {
          const iso = localISO(d);
          const doMes = d.getMonth() === mes;
          const marcado = iso === valor;
          const ehHoje = iso === hoje;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => aoEscolher(iso)}
              className={`alvo h-9 cursor-pointer rounded-[8px] text-[13px] tabular-nums transition-colors duration-150 ${
                marcado ? "bg-marrom font-semibold text-branco" : "hover:bg-fundo-2"
              } ${doMes ? "" : "text-tinta-3/60"} ${ehHoje && !marcado ? "font-semibold text-marrom" : ""}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" className="alvo cursor-pointer rounded-[8px] px-3 py-2 text-[13px] font-semibold text-marrom hover:bg-fundo-2" onClick={() => aoEscolher(hoje)}>
          Hoje
        </button>
      </div>
    </div>
  );
}
