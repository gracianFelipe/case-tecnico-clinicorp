import { useEffect } from "react";
import { CircleAlert } from "lucide-react";

export function Aviso({ texto, aoSumir }: { texto: string | null; aoSumir: () => void }) {
  useEffect(() => {
    if (!texto) return;
    const t = setTimeout(aoSumir, 3000);
    return () => clearTimeout(t);
  }, [texto, aoSumir]);

  if (!texto) return null;
  return (
    <div role="status" aria-live="polite" className="glass-forte descer fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full !bg-branco/70 px-4 py-2.5 text-sm font-medium text-tinta">
      <CircleAlert size={16} className="text-marrom" /> {texto}
    </div>
  );
}
