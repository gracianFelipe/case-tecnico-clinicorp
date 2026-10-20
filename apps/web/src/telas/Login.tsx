import { useState, type FormEvent } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { Marca } from "../componentes/Marca";
import { ErroApi } from "../api";

export function Login({ aoEntrar }: { aoEntrar: (email: string, senha: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await aoEntrar(email, senha);
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : "não foi possível entrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="entrar relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
        <div className="relative h-[560px] w-[640px]">
          <div className="aura aura-1" />
          <div className="aura aura-2" />
          <div className="aura aura-3" />
        </div>
      </div>
      <form onSubmit={enviar} className="glass-forte relative w-full max-w-[430px] px-9 py-10">
        <div className="neu surgir mx-auto mb-5 grid h-14 w-14 place-items-center rounded-[18px]">
          <Marca tamanho={30} />
        </div>
        <h1 className="brilho text-center font-serif text-3xl font-semibold tracking-tight">
          <span className="revelar"><span>Bem-vindo</span></span>
          <span className="revelar"><span>de volta.</span></span>
        </h1>
        <p className="surgir mb-7 mt-1.5 text-center text-tinta-2 [animation-delay:.25s]">
          Entre para abrir a agenda do dia
        </p>

        <label className="surgir mb-4 block [animation-delay:.35s]">
          <span className="mb-1.5 ml-1 block text-[13px] font-semibold text-tinta-2">E-mail</span>
          <input
            className="campo"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="surgir mb-5 block [animation-delay:.35s]">
          <span className="mb-1.5 ml-1 block text-[13px] font-semibold text-tinta-2">Senha</span>
          <input
            className="campo"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>

        {erro && (
          <div role="alert" className="tremer mb-4 flex items-center gap-2.5 rounded-xl border border-perigo/20 bg-perigo/10 px-3.5 py-3 text-sm font-medium text-perigo">
            <CircleAlert size={18} /> {erro}
          </div>
        )}

        <button type="submit" disabled={enviando} className="botao-primario surgir w-full [animation-delay:.45s]">
          <span className="inline-flex items-center gap-2">
            {enviando ? "Entrando…" : "Entrar"} <ArrowRight size={18} className="transition-transform duration-300" />
          </span>
        </button>
      </form>
    </main>
  );
}
