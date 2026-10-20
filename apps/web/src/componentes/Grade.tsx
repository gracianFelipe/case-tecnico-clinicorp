import { useEffect, useRef, useState } from "react";
import { MessageSquareText } from "lucide-react";
import type { Agendamento } from "../api";
import { Nota } from "./Nota";
import { ALTURA_SLOT, HORA_FIM, HORA_INICIO, MINUTOS_SLOT, duracaoLegivel, hojeISO, horaLocal, topoPx } from "../datas";

type Props = {
  data: string;
  direcao: 1 | -1 | 0;
  itens: Agendamento[];
  carregando: boolean;
  destaque: Set<number>;
  aoClicarVazio: (hhmm: string) => void;
  aoClicarItem: (item: Agendamento) => void;
};

const slots = Array.from({ length: ((HORA_FIM - HORA_INICIO) * 60) / MINUTOS_SLOT }, (_, i) => {
  const minutos = HORA_INICIO * 60 + i * MINUTOS_SLOT;
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return { hhmm: `${h}:${m}`, cheia: minutos % 60 === 0 };
});

export function Grade(p: Props) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const alturaGrade = slots.length * ALTURA_SLOT;
  const posAgora = topoPx(agora.toISOString());
  const linhaAgora = p.data === hojeISO() && posAgora >= 0 && posAgora <= alturaGrade ? posAgora : null;
  const [nota, setNota] = useState<Agendamento | null>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const alvo = linhaAgora ?? ALTURA_SLOT * 2;
    rolagem.current?.scrollTo({ top: Math.max(0, alvo - 80) });
  }, [p.data]);

  return (
    <div className="neu min-h-0 flex-1 overflow-hidden bg-branco">
    <div ref={rolagem} aria-busy={p.carregando} key={p.data} className={`rolagem grid h-full ${p.direcao > 0 ? "virar-frente" : p.direcao < 0 ? "virar-tras" : ""} grid-cols-[48px_1fr] content-start gap-x-1.5 overflow-y-auto overscroll-contain py-3 pl-2 pr-2 sm:grid-cols-[64px_1fr] sm:gap-x-2 sm:py-4 sm:pl-3 sm:pr-3`}>
      <div className="grid text-right text-[11px] tabular-nums text-tinta-2 sm:text-xs" style={{ gridAutoRows: ALTURA_SLOT }}>
        {slots.map((s) => <div key={s.hhmm} className="pr-2">{s.cheia ? s.hhmm : ""}</div>)}
      </div>

      <div className={`relative grid transition-opacity duration-200 ${p.carregando ? "opacity-60" : ""}`} style={{ gridAutoRows: ALTURA_SLOT }}>
        {slots.map((s) => (
          <button
            key={s.hhmm}
            type="button"
            aria-label={`Criar às ${s.hhmm}`}
            onClick={() => p.aoClicarVazio(s.hhmm)}
            className={`cursor-pointer rounded-md border-t border-tinta/10 transition-colors duration-200 hover:bg-marrom/7 ${s.cheia ? "" : "border-dashed"}`}
          />
        ))}

        {p.itens.map((a, i) => {
          const topo = topoPx(a.inicio);
          const altura = topoPx(a.fim) - topo;
          const longo = altura > ALTURA_SLOT * 2;
          return (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              aria-label={`${a.paciente}, ${horaLocal(a.inicio)} às ${horaLocal(a.fim)}`}
              onClick={() => p.aoClicarItem(a)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.aoClicarItem(a); } }}
              style={{ top: topo + 4, height: altura - 8, animationDelay: `${i * 40}ms` }}
              className={`glass descer absolute left-1 right-1 flex cursor-pointer items-center gap-2 rounded-[12px] px-2.5 pl-3.5 text-left leading-tight transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:scale-[1.005] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:bg-marrom sm:left-2 sm:right-2 sm:gap-3 sm:px-3 sm:pl-4 ${
                longo ? "!bg-fundo/60 flex-wrap content-start gap-y-1 py-2 shadow-none" : "!bg-fundo"
              } ${p.destaque.has(a.id) ? "piscar" : ""}`}
            >
              <b className={`truncate text-[14px] font-semibold ${longo ? "basis-full" : ""}`}>{a.paciente}</b>
              <small className="shrink-0 text-[12px] tabular-nums text-tinta-2">
                {horaLocal(a.inicio)} – {horaLocal(a.fim)}
                {longo && <span className="ml-2 rounded-full bg-branco/70 px-2 py-0.5 text-[11px] font-semibold text-tinta-3">{duracaoLegivel(a.inicio, a.fim)}</span>}
              </small>
              {a.observacao && (
                <button
                  type="button"
                  aria-label="Ver observação"
                  className="group relative ml-auto flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-marrom/10 px-2.5 py-1 text-[11px] font-semibold text-marrom transition-colors hover:bg-marrom/20"
                  onClick={(e) => { e.stopPropagation(); setNota(a); }}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <MessageSquareText size={13} aria-hidden="true" />
                  obs.
                  <span
                    role="tooltip"
                    className="glass-forte pointer-events-none absolute right-0 top-[calc(100%+8px)] z-30 w-max max-w-[260px] whitespace-normal rounded-[16px] !bg-branco/55 px-3.5 py-2.5 text-[13px] font-medium normal-case text-tinta opacity-0 transition-[opacity,transform] duration-200 translate-y-1 group-hover:translate-y-0 group-hover:opacity-100"
                  >
                    {a.observacao}
                  </span>
                </button>
              )}
            </div>
          );
        })}

        {linhaAgora !== null && (
          <div className="pointer-events-none absolute left-0 right-0 h-0.5 bg-marrom-2" style={{ top: linhaAgora }}>
            <span className="absolute -left-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-marrom-2" />
          </div>
        )}

        {!p.carregando && p.itens.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-24 text-center text-sm text-tinta-3">
            Nenhum agendamento neste dia. Clique num horário para criar.
          </p>
        )}
      </div>
    </div>
    {nota && <Nota item={nota} aoFechar={() => setNota(null)} />}
    </div>
  );
}
