import { Clock } from "lucide-react";
import { HORA_FIM, HORA_INICIO } from "../datas";
import { Flutuante } from "./Flutuante";

const MINUTOS = ["00", "30"];
const horas = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => String(HORA_INICIO + i).padStart(2, "0"));

type Props = {
  rotulo: string;
  valor: string;
  aoMudar: (hhmm: string) => void;
  bloqueado?: (hhmm: string) => boolean;
  aoBloqueado?: () => void;
  minimo?: string;
};

export function SeletorHora({ rotulo, valor, aoMudar, bloqueado = () => false, aoBloqueado, minimo }: Props) {
  const visiveis = minimo ? [...horas, String(HORA_FIM)].filter((h) => `${h}:30` > minimo) : horas;
  return (
    <Flutuante
      classe="w-[184px] p-2.5"
      gatilho={(aberto, alternar) => (
        <button
          type="button"
          aria-label={rotulo}
          aria-expanded={aberto}
          onClick={alternar}
          className={`campo flex cursor-pointer items-center justify-between text-left tabular-nums ${aberto ? "campo-foco" : ""}`}
        >
          {valor || "--:--"}
          <Clock size={16} className="text-cinza-2" />
        </button>
      )}
    >
      {(fechar) => (
        <div className="grid grid-cols-[32px_repeat(2,1fr)] items-center gap-x-1 gap-y-0.5">
          <span />
          {MINUTOS.map((m) => <span key={m} className="pb-1 text-center text-[11px] font-semibold text-tinta-3">:{m}</span>)}
          {visiveis.map((h) => (
            <Linha key={h} hora={h} valor={valor} minimo={minimo} bloqueado={bloqueado} aoEscolher={(v) => { aoMudar(v); fechar(); }} aoBloqueado={aoBloqueado} />
          ))}
          <span />
          <span className="col-span-2 pt-1 text-center text-[11px] text-tinta-3">
            <s className="text-cinza-2">00:00</s> = já reservado
          </span>
        </div>
      )}
    </Flutuante>
  );
}

type LinhaProps = {
  hora: string;
  valor: string;
  bloqueado: (hhmm: string) => boolean;
  aoEscolher: (hhmm: string) => void;
  aoBloqueado?: (() => void) | undefined;
  minimo?: string | undefined;
};

function Linha({ hora, valor, minimo, bloqueado, aoEscolher, aoBloqueado }: LinhaProps) {
  return (
    <>
      <span className="text-right text-[12px] font-semibold tabular-nums text-cinza-3">{hora}</span>
      {MINUTOS.map((m) => {
        const v = `${hora}:${m}`;
        if ((minimo && v <= minimo) || v > `${HORA_FIM}:00`) return <span key={v} />;
        const marcado = v === valor;
        const ocupado = bloqueado(v);
        return (
          <button
            key={v}
            type="button"
            role="option"
            aria-selected={marcado}
            aria-disabled={ocupado}
            onClick={() => (ocupado ? aoBloqueado?.() : aoEscolher(v))}
            className={`alvo h-9 rounded-[8px] text-[13px] tabular-nums transition-colors duration-150 ${
              marcado
                ? "bg-marrom font-semibold text-branco"
                : ocupado
                  ? "cursor-not-allowed bg-cinza-1 text-cinza-2 line-through"
                  : "cursor-pointer text-tinta-2 hover:bg-fundo-2"
            }`}
          >
            {m}
          </button>
        );
      })}
    </>
  );
}
