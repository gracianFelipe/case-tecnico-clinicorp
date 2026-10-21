import { expect, test, type Page } from "@playwright/test";

const CONTA = { email: "recepcao@clinica.test", senha: "recepcao123" };
const DIAS_A_FRENTE = 5;
const PACIENTE = "Paciente E2E";

async function entrar(page: Page) {
  await page.goto("/");
  await page.getByLabel("E-mail").fill(CONTA.email);
  await page.getByLabel("Senha").fill(CONTA.senha);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  for (let i = 0; i < DIAS_A_FRENTE; i++) await page.getByRole("button", { name: "Próximo dia" }).click();
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
}

async function cancelarSeExistir(page: Page) {
  const cartao = page.getByRole("button", { name: new RegExp(`^${PACIENTE},`) });
  if (await cartao.count()) {
    await cartao.first().click();
    await page.getByRole("button", { name: "Cancelar agendamento" }).click();
    await page.getByRole("button", { name: "Sim" }).click();
    await expect(cartao).toHaveCount(0);
  }
}

test.describe("agenda em duas abas", () => {
  test("login sobrevive ao recarregamento", async ({ page }) => {
    await entrar(page);
    await page.reload();
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveCount(0);
  });

  test("criar numa aba aparece na outra sem recarregar, e o horário fica protegido", async ({ browser }) => {
    const abaA = await (await browser.newContext()).newPage();
    const abaB = await (await browser.newContext()).newPage();
    await entrar(abaA);
    await entrar(abaB);
    await cancelarSeExistir(abaA);

    await abaA.getByRole("button", { name: "Criar às 18:30" }).click();
    await abaB.getByRole("button", { name: "Criar às 18:30" }).click();
    await abaA.getByRole("textbox", { name: "Paciente" }).fill(PACIENTE);
    await abaB.getByRole("textbox", { name: "Paciente" }).fill("Paciente Atrasado");

    await abaA.getByRole("button", { name: "Salvar" }).click();
    await expect(abaA.getByRole("button", { name: `${PACIENTE}, 18:30 às 19:00` })).toBeVisible();
    await expect(abaB.getByRole("button", { name: `${PACIENTE}, 18:30 às 19:00` })).toBeVisible({ timeout: 5_000 });

    await abaB.getByRole("button", { name: "Salvar" }).click();
    await expect(abaB.getByRole("alert")).toContainText("já tem um agendamento nesse horário");
    await abaB.getByRole("button", { name: "Fechar" }).click();

    await abaA.getByRole("button", { name: `${PACIENTE}, 18:30 às 19:00` }).click();
    await abaA.getByRole("button", { name: "Cancelar agendamento" }).click();
    await abaA.getByRole("button", { name: "Sim" }).click();
    await expect(abaB.getByRole("button", { name: new RegExp(`^${PACIENTE},`) })).toHaveCount(0, { timeout: 5_000 });
  });
});
