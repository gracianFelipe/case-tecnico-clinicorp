import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroApi, type Agendamento } from "../src/api";
import { instanteDe } from "../src/datas";
import { Painel } from "../src/componentes/Painel";

vi.mock("../src/api", async (original) => {
  const real = await original<typeof import("../src/api")>();
  return { ...real, api: { criar: vi.fn(), mover: vi.fn(), cancelar: vi.fn() } };
});

const { api } = await import("../src/api");
const DATA = "2026-11-10";

const existente: Agendamento = {
  id: 7,
  profissionalId: 1,
  paciente: "Paciente Exemplo",
  inicio: instanteDe(DATA, "09:00"),
  fim: instanteDe(DATA, "10:00"),
  observacao: null,
  criadoEm: "",
  atualizadoEm: "",
};

function montar(estado: React.ComponentProps<typeof Painel>["estado"], doDia: Agendamento[] = [existente]) {
  const aoSalvar = vi.fn();
  const aoFechar = vi.fn();
  render(
    <Painel estado={estado} doDia={doDia} profissionalId={1} nomeProfissional="Dra. Teste" data={DATA} aoFechar={aoFechar} aoSalvar={aoSalvar} />,
  );
  return { aoSalvar, aoFechar };
}

describe("Painel de agendamento", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ao criar, sugere fim 30 minutos depois do início", () => {
    montar({ modo: "criar", inicio: "11:00" });
    expect(screen.getByRole("button", { name: "Início" })).toHaveTextContent("11:00");
    expect(screen.getByRole("button", { name: "Fim" })).toHaveTextContent("11:30");
  });

  it("risca os horários já ocupados no dia e avisa ao clicar", async () => {
    montar({ modo: "criar", inicio: "11:00" });
    await userEvent.click(screen.getByRole("button", { name: "Início" }));
    const ocupados = screen.getAllByRole("option").filter((o) => o.getAttribute("aria-disabled") === "true");
    expect(ocupados.length).toBe(2);
    await userEvent.click(ocupados[0]!);
    expect(await screen.findByRole("status")).toHaveTextContent("horário já reservado");
  });

  it("envia o agendamento novo com instantes ISO e fecha ao salvar", async () => {
    vi.mocked(api.criar).mockResolvedValue(existente);
    const { aoSalvar } = montar({ modo: "criar", inicio: "11:00" });
    await userEvent.type(screen.getByRole("textbox", { name: "Paciente" }), "Paciente Novo");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(api.criar).toHaveBeenCalledWith({
      profissionalId: 1,
      paciente: "Paciente Novo",
      inicio: instanteDe(DATA, "11:00"),
      fim: instanteDe(DATA, "11:30"),
    });
    expect(aoSalvar).toHaveBeenCalledTimes(1);
  });

  it("mostra a recusa do servidor quando o horário foi tomado por outra pessoa", async () => {
    vi.mocked(api.criar).mockRejectedValue(new ErroApi(409, "o profissional já tem um agendamento nesse horário"));
    const { aoSalvar } = montar({ modo: "criar", inicio: "11:00" });
    await userEvent.type(screen.getByRole("textbox", { name: "Paciente" }), "Paciente Novo");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("já tem um agendamento nesse horário");
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("ao editar, move pelo PATCH e cancela com confirmação", async () => {
    vi.mocked(api.mover).mockResolvedValue(existente);
    vi.mocked(api.cancelar).mockResolvedValue(undefined);
    const { aoSalvar } = montar({ modo: "editar", item: existente }, [existente]);
    expect(screen.getByRole("textbox", { name: "Paciente" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(api.mover).toHaveBeenCalledWith(7, instanteDe(DATA, "09:00"), instanteDe(DATA, "10:00"));

    await userEvent.click(screen.getByRole("button", { name: "Cancelar agendamento" }));
    await userEvent.click(screen.getByRole("button", { name: "Sim" }));
    expect(api.cancelar).toHaveBeenCalledWith(7);
    expect(aoSalvar).toHaveBeenCalledTimes(2);
  });

  it("avisa quando o agendamento já foi cancelado em outra tela", async () => {
    vi.mocked(api.mover).mockRejectedValue(new ErroApi(404, "agendamento não encontrado"));
    montar({ modo: "editar", item: existente }, [existente]);
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cancelado em outra tela");
  });
});
