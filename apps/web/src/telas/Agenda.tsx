import { useCallback, useEffect, useState } from "react";
import { api, type Agendamento, type Profissional, type Usuario } from "../api";
import { hojeISO } from "../datas";
import { useAgenda } from "../hooks";
import { Cabecalho } from "../componentes/Cabecalho";
import { Grade } from "../componentes/Grade";
import { Painel, type PainelEstado } from "../componentes/Painel";

export function Agenda({ usuario, aoSair }: { usuario: Usuario; aoSair: () => Promise<void> }) {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [profissional, setProfissional] = useState<number | null>(null);
  const [data, setDataBruta] = useState(hojeISO());
  const [direcao, setDirecao] = useState<1 | -1 | 0>(0);
  const setData = (nova: string) => {
    setDirecao(nova > data ? 1 : nova < data ? -1 : 0);
    setDataBruta(nova);
  };
  const [painel, setPainel] = useState<PainelEstado | null>(null);

  const deslogar = useCallback(() => void aoSair(), [aoSair]);
  const agenda = useAgenda(profissional, data, deslogar);

  useEffect(() => {
    api.profissionais().then((lista) => {
      setProfissionais(lista);
      setProfissional((atual) => atual ?? lista[0]?.id ?? null);
    }, deslogar);
  }, [deslogar]);

  const nomeProfissional = profissionais.find((p) => p.id === profissional)?.nome ?? "";

  return (
    <div className="entrar flex h-dvh flex-col overflow-hidden">
      <Cabecalho
        usuario={usuario}
        profissionais={profissionais}
        profissional={profissional}
        aoTrocarProfissional={setProfissional}
        data={data}
        aoTrocarData={setData}
        aoSair={deslogar}
      />
      <main className="mx-auto flex w-full max-w-[1100px] min-h-0 flex-1 flex-col px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-5">
        <Grade
          data={data}
          direcao={direcao}
          itens={agenda.itens}
          carregando={agenda.carregando}
          destaque={agenda.destaque}
          aoClicarVazio={(hhmm) => profissional && setPainel({ modo: "criar", inicio: hhmm })}
          aoClicarItem={(item: Agendamento) => setPainel({ modo: "editar", item })}
        />
      </main>
      {painel && profissional && (
        <Painel
          estado={painel}
          doDia={agenda.itens}
          profissionalId={profissional}
          nomeProfissional={nomeProfissional}
          data={data}
          aoFechar={() => setPainel(null)}
          aoSalvar={() => {
            setPainel(null);
            void agenda.recarregar();
          }}
        />
      )}
    </div>
  );
}
