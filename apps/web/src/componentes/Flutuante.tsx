import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  gatilho: (aberto: boolean, alternar: () => void) => ReactNode;
  children: (fechar: () => void) => ReactNode;
  alinhar?: "esquerda" | "direita";
  classe?: string;
};

export function Flutuante({ gatilho, children, alinhar = "esquerda", classe = "" }: Props) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setAberto(false);
    };
    addEventListener("mousedown", fora);
    addEventListener("keydown", esc, true);
    return () => {
      removeEventListener("mousedown", fora);
      removeEventListener("keydown", esc, true);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      {gatilho(aberto, () => setAberto((a) => !a))}
      {aberto && (
        <div
          className={`glass descer absolute top-[calc(100%+8px)] z-30 bg-branco/85 p-2 ${alinhar === "direita" ? "right-0" : "left-0"} ${classe}`}
        >
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  );
}
