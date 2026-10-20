import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Opcao = { id: number; nome: string };

type Props = {
  rotulo: string;
  opcoes: Opcao[];
  valor: number | null;
  aoMudar: (id: number) => void;
};

export function Seletor({ rotulo, opcoes, valor, aoMudar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const idLista = useId();
  const atual = opcoes.find((o) => o.id === valor);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    addEventListener("mousedown", fora);
    return () => removeEventListener("mousedown", fora);
  }, [aberto]);

  function abrir() {
    setFoco(Math.max(0, opcoes.findIndex((o) => o.id === valor)));
    setAberto(true);
  }

  function escolher(o: Opcao) {
    aoMudar(o.id);
    setAberto(false);
  }

  function teclado(e: React.KeyboardEvent) {
    if (!aberto && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      return abrir();
    }
    if (!aberto) return;
    if (e.key === "Escape") setAberto(false);
    if (e.key === "ArrowDown") { e.preventDefault(); setFoco((f) => Math.min(f + 1, opcoes.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setFoco((f) => Math.max(f - 1, 0)); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const o = opcoes[foco]; if (o) escolher(o); }
  }

  return (
    <div ref={raiz} className="relative" onKeyDown={teclado}>
      <button
        type="button"
        aria-label={rotulo}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={idLista}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        className="neu flex cursor-pointer items-center gap-2.5 rounded-[14px] py-2 pl-4 pr-3 font-semibold text-cinza-3 transition-shadow duration-200"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-fundo-2 to-fundo-3 text-[11px] font-bold text-marrom">
          {iniciais(atual?.nome ?? "")}
        </span>
        <span className="max-w-[140px] truncate sm:max-w-none">{atual?.nome ?? "Profissional"}</span>
        <ChevronDown size={16} className={`text-cinza-2 transition-transform duration-300 ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={rotulo}
          className="glass descer absolute left-0 top-[calc(100%+8px)] z-30 min-w-full overflow-hidden bg-branco/80 p-1.5"
        >
          {opcoes.map((o, i) => {
            const marcado = o.id === valor;
            return (
              <li
                key={o.id}
                role="option"
                aria-selected={marcado}
                onMouseEnter={() => setFoco(i)}
                onClick={() => escolher(o)}
                className={`flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-[10px] py-2 pl-2.5 pr-4 text-[15px] transition-colors duration-150 ${
                  i === foco ? "bg-fundo-2 text-tinta" : "text-cinza-3"
                } ${marcado ? "font-semibold" : "font-medium"}`}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-fundo-2 to-fundo-3 text-[11px] font-bold text-marrom">
                  {iniciais(o.nome)}
                </span>
                {o.nome}
                {marcado && <Check size={16} className="ml-auto text-marrom" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function iniciais(nome: string) {
  return nome
    .replace(/^(dra?\.|dr\.)\s*/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
