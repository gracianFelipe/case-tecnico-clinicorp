export type Usuario = { id: number; email: string; nome: string };
export type Profissional = { id: number; nome: string };
export type Agendamento = {
  id: number;
  profissionalId: number;
  paciente: string;
  inicio: string;
  fim: string;
  observacao: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export class ErroApi extends Error {
  constructor(
    public readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  if (res.status === 204) return undefined as T;
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErroApi(res.status, corpo.erro ?? "erro inesperado");
  return corpo as T;
}

export const api = {
  me: () => chamar<Usuario>("/api/me"),
  login: (email: string, senha: string) =>
    chamar<void>("/api/login", { method: "POST", body: JSON.stringify({ email, senha }) }),
  logout: () => chamar<void>("/api/logout", { method: "POST" }),
  profissionais: () => chamar<Profissional[]>("/api/profissionais"),
  agenda: (profissional: number, data: string) =>
    chamar<Agendamento[]>(`/api/agenda?profissional=${profissional}&data=${data}`),
  criar: (dados: { profissionalId: number; paciente: string; inicio: string; fim: string; observacao?: string }) =>
    chamar<Agendamento>("/api/agendamentos", { method: "POST", body: JSON.stringify(dados) }),
  mover: (id: number, inicio: string, fim: string) =>
    chamar<Agendamento>(`/api/agendamentos/${id}/horario`, { method: "PATCH", body: JSON.stringify({ inicio, fim }) }),
  cancelar: (id: number) => chamar<void>(`/api/agendamentos/${id}`, { method: "DELETE" }),
};
