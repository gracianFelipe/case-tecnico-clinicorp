import { Marca } from "../componentes/Marca";

export function NaoEncontrada() {
  return (
    <main className="entrar grid min-h-dvh place-items-center px-4 py-10">
      <div className="glass-forte w-full max-w-[430px] px-9 py-10 text-center">
        <div className="neu mx-auto mb-5 grid h-14 w-14 place-items-center rounded-[18px]">
          <Marca tamanho={30} />
        </div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tinta-3">Erro 404</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="mb-7 mt-2 text-tinta-2">O endereço que você abriu não existe nesta agenda.</p>
        <a href="/" className="botao-primario inline-block">
          <span>Ir para a agenda</span>
        </a>
      </div>
    </main>
  );
}
