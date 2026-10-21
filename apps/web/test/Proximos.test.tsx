import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agendamento } from "../src/api";
import { instanteDe } from "../src/datas";
import { Proximos } from "../src/componentes/Proximos";

vi.mock("../src/api", async (original) => {
  const real = await original<typeof import("../src/api")>();
  return { ...real, api: { proximos: vi.fn() } };
});

const { api } = await import("../src/api");

const item = (id: number, dia: string, hhmm: string, paciente: string): Agendamento => ({
  id, profissionalId: 1, paciente, observacao: null, criadoEm: "", atualizadoEm: "",
  inicio: instanteDe(dia, hhmm), fim: instanteDe(dia, hhmm.replace(":00", ":30")),
});

describe("Próximos agendamentos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ao passar o mouse, busca e lista os próximos com data, hora e paciente", async () => {
    vi.mocked(api.proximos).mockResolvedValue([item(1, "2031-03-10", "09:00", "Paciente Um"), item(2, "2031-03-11", "14:00", "Paciente Dois")]);
    render(<Proximos profissional={1} aoEscolher={vi.fn()} />);
    await userEvent.hover(screen.getByRole("button", { name: "Próximos agendamentos" }));
    const linhas = await screen.findAllByRole("listitem");
    expect(api.proximos).toHaveBeenCalledWith(1);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent("10/03");
    expect(linhas[0]).toHaveTextContent("09:00");
    expect(linhas[0]).toHaveTextContent("Paciente Um");
  });

  it("ao clicar num item, entrega o agendamento e fecha", async () => {
    const escolhido = item(7, "2031-03-10", "09:00", "Paciente Um");
    vi.mocked(api.proximos).mockResolvedValue([escolhido]);
    const aoEscolher = vi.fn();
    render(<Proximos profissional={1} aoEscolher={aoEscolher} />);
    await userEvent.click(screen.getByRole("button", { name: "Próximos agendamentos" }));
    await userEvent.click(await screen.findByRole("listitem", { name: /Paciente Um/ }));
    expect(aoEscolher).toHaveBeenCalledWith(escolhido);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("avisa quando não há agendamentos futuros", async () => {
    vi.mocked(api.proximos).mockResolvedValue([]);
    render(<Proximos profissional={1} aoEscolher={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Próximos agendamentos" }));
    expect(await screen.findByText("Nenhum agendamento futuro")).toBeInTheDocument();
  });
});
