import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CircleAlert } from "lucide-react";
import { api, ErroApi, type Agendamento } from "../api";
import { hhmmLocal, instanteDe, rotuloData, somarMinutos } from "../datas";
import { SeletorHora } from "./SeletorHora";
import { Aviso } from "./Aviso";

export type PainelEstado = { modo: "criar"; inicio: string } | { modo: "editar"; item: Agendamento };

type Props = {
  estado: PainelEstado;
  doDia: Agendamento[];
  profissionalId: number;
  nomeProfissional: string;
  data: string;
  aoFechar: () => void;
  aoSalvar: () => void;
};


export function Painel(p: Props) {
  const editando = p.estado.modo === "editar";
  const item = p.estado.modo === "editar" ? p.estado.item : null;

  const [paciente, setPaciente] = useState(item?.paciente ?? "");
  const [inicio, setInicio] = useState(item ? hhmmLocal(item.inicio) : p.estado.modo === "criar" ? p.estado.inicio : "");
  const [fim, setFim] = useState(item ? hhmmLocal(item.fim) : somarMinutos(p.estado.modo === "criar" ? p.estado.inicio : "08:00", 30));
  const [observacao, setObservacao] = useState(item?.observacao ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const limparAviso = useCallback(() => setAviso(null), []);

  const outros = useMemo(
    () => p.doDia.filter((a) => a.id !== item?.id).map((a) => ({ inicio: hhmmLocal(a.inicio), fim: hhmmLocal(a.fim) })),
    [p.doDia, item?.id],
  );
  const inicioOcupado = (h: string) => outros.some((o) => h >= o.inicio && h < o.fim);
  const fimOcupado = (h: string) => outros.some((o) => inicio < o.fim && h > o.inicio);
  const avisarReservado = () => setAviso("horário já reservado");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && p.aoFechar();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [p]);

  async function executar(acao: () => Promise<unknown>) {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
      p.aoSalvar();
    } catch (e) {
      if (e instanceof ErroApi && e.status === 404) setErro("este agendamento foi cancelado em outra tela");
      else setErro(e instanceof ErroApi ? e.message : "não foi possível salvar");
    } finally {
      setOcupado(false);
    }
  }

  function salvar(e: FormEvent) {
    e.preventDefault();
    const ini = instanteDe(p.data, inicio);
    const f = instanteDe(p.data, fim);
    if (item) return executar(() => api.mover(item.id, ini, f));
    return executar(() => api.criar({ profissionalId: p.profissionalId, paciente, inicio: ini, fim: f, ...(observacao && { observacao }) }));
  }

  return (
    <div
      className="fixed inset-0 z-40 grid items-start justify-items-center overflow-y-auto bg-tinta/20 px-3 py-4 backdrop-blur-[4px] sm:px-4 sm:py-7"
      onMouseDown={(e) => e.target === e.currentTarget && p.aoFechar()}
    >
      <Aviso texto={aviso} aoSumir={limparAviso} />
      <form onSubmit={salvar} className="glass descer w-full max-w-[720px] bg-branco/75 px-4 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6" role="dialog" aria-modal="true">
        <h2 className="font-serif text-[22px] font-semibold">{editando ? "Editar agendamento" : "Novo agendamento"}</h2>
        <p className="mb-5 mt-1 text-[13px] text-tinta-2">{p.nomeProfissional} · {rotuloData(p.data)}</p>

        <div className="grid grid-cols-[2fr_1fr_1fr] gap-3.5 max-sm:grid-cols-2 max-sm:[&>*:first-child]:col-span-2">
          <Campo rotulo="Paciente">
            <input className="campo" required maxLength={120} autoFocus={!editando} disabled={editando} value={paciente} onChange={(e) => setPaciente(e.target.value)} />
          </Campo>
          <Campo rotulo="Início" como="div">
            <SeletorHora rotulo="Início" valor={inicio} bloqueado={inicioOcupado} aoBloqueado={avisarReservado} aoMudar={(h) => { setInicio(h); if (h >= fim) setFim(somarMinutos(h, 30)); }} />
          </Campo>
          <Campo rotulo="Fim" como="div">
            <SeletorHora rotulo="Fim" valor={fim} minimo={inicio} bloqueado={fimOcupado} aoBloqueado={avisarReservado} aoMudar={setFim} />
          </Campo>
        </div>
        {!editando && (
          <Campo rotulo="Observação" classe="mt-3.5">
            <input className="campo" maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </Campo>
        )}
        {editando && item?.observacao && <p className="mt-3 text-sm text-tinta-2">{item.observacao}</p>}

        {erro && (
          <div role="alert" className="tremer mt-4 flex items-center gap-2.5 rounded-xl border border-perigo/20 bg-perigo/10 px-3.5 py-3 text-sm font-medium text-perigo">
            <CircleAlert size={18} /> {erro}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {editando && !confirmando && (
            <button type="button" className="botao px-2 text-perigo" onClick={() => setConfirmando(true)}>
              Cancelar agendamento
            </button>
          )}
          {editando && confirmando && (
            <span className="flex items-center gap-2 text-sm">
              Confirmar cancelamento?
              <button type="button" disabled={ocupado} className="botao bg-perigo px-3.5 py-2 text-branco" onClick={() => item && executar(() => api.cancelar(item.id))}>
                Sim
              </button>
              <button type="button" className="botao px-3 py-2 text-tinta-2" onClick={() => setConfirmando(false)}>Não</button>
            </span>
          )}
          <span className="flex-1" />
          <button type="button" className="botao-fantasma" onClick={p.aoFechar}>Fechar</button>
          <button type="submit" disabled={ocupado} className="botao-primario"><span>{ocupado ? "Salvando…" : "Salvar"}</span></button>
        </div>
      </form>
    </div>
  );
}

function Campo({ rotulo, classe = "", como = "label", children }: { rotulo: string; classe?: string; como?: "label" | "div"; children: React.ReactNode }) {
  const Tag = como;
  return (
    <Tag className={`block ${classe}`}>
      <span className="mb-1.5 ml-1 block text-[13px] font-semibold text-tinta-2">{rotulo}</span>
      {children}
    </Tag>
  );
}
