import { useCallback, useEffect, useRef, useState } from "react";
import { api, ErroApi, type Agendamento, type Usuario } from "./api";

export function useSessao() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);

  useEffect(() => {
    api.me().then(setUsuario, () => setUsuario(null));
  }, []);

  const entrar = async (email: string, senha: string) => {
    await api.login(email, senha);
    setUsuario(await api.me());
  };
  const sair = async () => {
    await api.logout();
    setUsuario(null);
  };
  return { usuario, entrar, sair };
}

export function useAgenda(profissional: number | null, data: string, aoDeslogar: () => void) {
  const [itens, setItens] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [destaque, setDestaque] = useState<Set<number>>(new Set());
  const anteriores = useRef<Map<number, string>>(new Map());

  const recarregar = useCallback(async () => {
    if (!profissional) return;
    try {
      const novos = await api.agenda(profissional, data);
      const mudaram = new Set<number>();
      for (const a of novos) {
        const antes = anteriores.current.get(a.id);
        if (antes !== undefined && antes !== a.atualizadoEm) mudaram.add(a.id);
        if (antes === undefined && anteriores.current.size > 0) mudaram.add(a.id);
      }
      anteriores.current = new Map(novos.map((a) => [a.id, a.atualizadoEm]));
      setItens(novos);
      if (mudaram.size) {
        setDestaque(mudaram);
        setTimeout(() => setDestaque(new Set()), 1500);
      }
    } catch (e) {
      if (e instanceof ErroApi && e.status === 401) aoDeslogar();
    } finally {
      setCarregando(false);
    }
  }, [profissional, data, aoDeslogar]);

  useEffect(() => {
    anteriores.current = new Map();
    setCarregando(true);
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!profissional) return;
    const es = new EventSource(`/api/eventos?profissional=${profissional}&data=${data}`);
    es.addEventListener("mudou", () => void recarregar());
    return () => es.close();
  }, [profissional, data, recarregar]);

  return { itens, carregando, destaque, recarregar };
}
