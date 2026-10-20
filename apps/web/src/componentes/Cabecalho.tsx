import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { Marca } from "./Marca";
import type { Profissional, Usuario } from "../api";
import { hojeISO, rotuloData, somarDias } from "../datas";
import { Digitos } from "./Digitos";
import { Seletor } from "./Seletor";
import { Calendario } from "./Calendario";

type Props = {
  usuario: Usuario;
  profissionais: Profissional[];
  profissional: number | null;
  aoTrocarProfissional: (id: number) => void;
  data: string;
  aoTrocarData: (iso: string) => void;
  aoSair: () => void;
};

export function Cabecalho(p: Props) {
  const [, mes, dia] = p.data.split("-");
  const rotulo = rotuloData(p.data);
  const semana = rotulo.split(",")[0] ?? "";
  const mesNome = rotulo.split(" ").at(-1)?.replace(".", "") ?? mes;

  return (
    <header
      className="glass z-20 mx-3 mt-3 flex shrink-0 flex-wrap items-center gap-2 px-3 py-2.5 sm:mx-6 sm:gap-3.5 sm:px-4.5 sm:py-3"
    >
      <button
        type="button"
        title="Voltar para hoje"
        onClick={() => p.aoTrocarData(hojeISO())}
        className="mr-auto flex cursor-pointer items-center gap-2.5 rounded-[12px] px-1 font-serif text-xl font-semibold"
      >
        <Marca tamanho={26} />
        <span className="brilho max-sm:hidden">Agenda</span>
      </button>

      <Seletor rotulo="Profissional" opcoes={p.profissionais} valor={p.profissional} aoMudar={p.aoTrocarProfissional} />

      <div className="neu flex items-center gap-0.5 rounded-[14px] p-1 font-semibold text-cinza-3 max-sm:order-last max-sm:w-full max-sm:justify-between sm:p-1.5">
        <button type="button" aria-label="Dia anterior" className="rounded-[10px] px-3 py-2 hover:bg-fundo-2" onClick={() => p.aoTrocarData(somarDias(p.data, -1))}>
          <ChevronLeft size={18} />
        </button>
        <span className="px-1 py-2 capitalize sm:px-2">
          {semana}, <Digitos valor={dia ?? ""} /> {mesNome}
        </span>
        <button type="button" aria-label="Próximo dia" className="rounded-[10px] px-3 py-2 hover:bg-fundo-2" onClick={() => p.aoTrocarData(somarDias(p.data, 1))}>
          <ChevronRight size={18} />
        </button>
        <button type="button" className="rounded-[10px] px-3 py-2 text-marrom hover:bg-fundo-2" onClick={() => p.aoTrocarData(hojeISO())}>
          Hoje
        </button>
        <Calendario valor={p.data} aoMudar={p.aoTrocarData} />
      </div>


      <button type="button" aria-label="Sair" className="botao-fantasma flex items-center gap-2 px-3 py-2.5 sm:px-4" onClick={p.aoSair}>
        <span className="max-sm:hidden">{p.usuario.nome.split(" ")[0]}</span> <LogOut size={16} />
      </button>
    </header>
  );
}
