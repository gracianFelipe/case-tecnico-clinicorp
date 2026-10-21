import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SeletorHora } from "../src/componentes/SeletorHora";

const ocupadoDas9as10 = (h: string) => h >= "09:00" && h < "10:00";

async function abrir(props: Partial<React.ComponentProps<typeof SeletorHora>> = {}) {
  const aoMudar = vi.fn();
  const aoBloqueado = vi.fn();
  render(<SeletorHora rotulo="Início" valor="08:00" aoMudar={aoMudar} aoBloqueado={aoBloqueado} {...props} />);
  await userEvent.click(screen.getByRole("button", { name: props.rotulo ?? "Início" }));
  return { aoMudar, aoBloqueado };
}

function opcao(hora: string, minuto: "00" | "30") {
  const rotulo = screen.getByText(hora, { selector: "span" });
  const el = minuto === "00" ? rotulo.nextElementSibling : rotulo.nextElementSibling?.nextElementSibling;
  return el as HTMLButtonElement;
}

describe("SeletorHora", () => {
  it("mostra os horários do expediente em passos de 30 minutos", async () => {
    await abrir();
    expect(screen.getByText("07", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("19", { selector: "span" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(26);
  });

  it("escolhe um horário livre e fecha", async () => {
    const { aoMudar } = await abrir();
    await userEvent.click(opcao("08", "30"));
    expect(aoMudar).toHaveBeenCalledWith("08:30");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("risca os horários ocupados e avisa em vez de escolher", async () => {
    const { aoMudar, aoBloqueado } = await abrir({ bloqueado: ocupadoDas9as10 });
    const nove = opcao("09", "00");
    expect(nove).toHaveAttribute("aria-disabled", "true");
    expect(nove.className).toContain("line-through");
    await userEvent.click(nove);
    expect(aoMudar).not.toHaveBeenCalled();
    expect(aoBloqueado).toHaveBeenCalledTimes(1);
    expect(opcao("10", "00")).toHaveAttribute("aria-disabled", "false");
  });

  it("como seletor de fim, só oferece horários depois do início", async () => {
    await abrir({ rotulo: "Fim", minimo: "09:30", valor: "10:00" });
    expect(screen.queryByText("09", { selector: "span" })).not.toBeInTheDocument();
    expect(opcao("10", "00")).toHaveAttribute("role", "option");
    expect(opcao("20", "00")).toHaveTextContent("00");
    expect(screen.getAllByRole("option")).toHaveLength(21);
  });
});
