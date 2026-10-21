import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { api, type Agendamento } from "../api";
import { horaLocal, rotuloCurto } from "../datas";
import { Flutuante } from "./Flutuante";

type Props = {
  profissional: number | null;
  aoEscolher: (item: Agendamento) => void;
};

export function Proximos({ profissional, aoEscolher }: Props) {
  const [itens, setItens] = useState<Agendamento[] | null>(null);

  function carregar() {
    if (!profissional) return;
    setItens(null);
    api.proximos(profissional).then(setItens, () => setItens([]));
  }

  return (
    <Flutuante
      aoPassar
      aoAbrir={carregar}
      classe="w-[300px] p-1.5"
      gatilho={(aberto, alternar) => (
        <button
          type="button"
          aria-label="Próximos agendamentos"
          aria-expanded={aberto}
          onClick={alternar}
          disabled={!profissional}
          className="neu grid h-10 w-10 cursor-pointer place-items-center rounded-[14px] text-cinza-3 transition-shadow duration-200 disabled:opacity-40"
        >
          <ChevronRight size={16} className={`transition-transform duration-300 ${aberto ? "rotate-90" : ""}`} />
        </button>
      )}
    >
      {(fechar) => (
        <div role="list" aria-label="Próximos agendamentos">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-tinta-3">Próximos agendamentos</p>
          {itens === null && <p className="px-2.5 py-2 text-sm text-tinta-2">Carregando…</p>}
          {itens?.length === 0 && <p className="px-2.5 py-2 text-sm text-tinta-2">Nenhum agendamento futuro</p>}
          {itens?.map((a) => (
            <button
              key={a.id}
              type="button"
              role="listitem"
              aria-label={`${rotuloCurto(a.inicio)} ${horaLocal(a.inicio)}, ${a.paciente}`}
              onClick={() => { aoEscolher(a); fechar(); }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-fundo-2"
            >
              <span className="w-[84px] shrink-0 text-[12px] capitalize tabular-nums text-tinta-2">{rotuloCurto(a.inicio)}</span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums">{horaLocal(a.inicio)}</span>
              <span className="truncate text-[14px]">{a.paciente}</span>
            </button>
          ))}
        </div>
      )}
    </Flutuante>
  );
}
