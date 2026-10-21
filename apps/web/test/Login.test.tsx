import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErroApi } from "../src/api";
import { Login } from "../src/telas/Login";

async function preencherEEnviar(aoEntrar: (email: string, senha: string) => Promise<void>) {
  render(<Login aoEntrar={aoEntrar} />);
  await userEvent.type(screen.getByLabelText("E-mail"), "recepcao@example.com");
  await userEvent.type(screen.getByLabelText("Senha"), "senha-teste");
  await userEvent.click(screen.getByRole("button", { name: /Entrar/ }));
}

describe("Login", () => {
  it("entrega e-mail e senha para entrar", async () => {
    const aoEntrar = vi.fn().mockResolvedValue(undefined);
    await preencherEEnviar(aoEntrar);
    expect(aoEntrar).toHaveBeenCalledWith("recepcao@example.com", "senha-teste");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra a mensagem do servidor quando a senha está errada", async () => {
    const aoEntrar = vi.fn().mockRejectedValue(new ErroApi(401, "e-mail ou senha inválidos"));
    await preencherEEnviar(aoEntrar);
    expect(await screen.findByRole("alert")).toHaveTextContent("e-mail ou senha inválidos");
    expect(screen.getByRole("button", { name: /Entrar/ })).toBeEnabled();
  });
});
