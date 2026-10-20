import { useEffect } from "react";
import { MessageSquareText, X } from "lucide-react";
import type { Agendamento } from "../api";
import { horaLocal } from "../datas";

export function Nota({ item, aoFechar }: { item: Agendamento; aoFechar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [aoFechar]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-tinta/25 px-4 backdrop-blur-[6px]"
      onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="nota-titulo" className="glass-forte descer relative w-full max-w-[460px] px-7 pb-6 pt-6">
        <button type="button" aria-label="Fechar" onClick={aoFechar} className="alvo absolute right-3 top-3 grid h-10 w-10 cursor-pointer place-items-center rounded-full text-tinta-2 transition-colors hover:bg-branco/60">
          <X size={18} />
        </button>
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-[14px] bg-branco text-marrom shadow-[0_2px_8px_rgba(42,36,32,0.08)]">
          <MessageSquareText size={22} />
        </div>
        <h2 id="nota-titulo" className="font-serif text-[22px] font-semibold">{item.paciente}</h2>
        <p className="mb-4 text-[13px] text-tinta-2 tabular-nums">{horaLocal(item.inicio)} – {horaLocal(item.fim)}</p>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-tinta">{item.observacao}</p>
      </div>
    </div>
  );
}
