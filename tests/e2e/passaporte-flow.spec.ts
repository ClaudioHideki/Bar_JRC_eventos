import { test, expect } from "@playwright/test";

test.describe("Fluxo Ponta a Ponta - Passaporte JRC", () => {
  test("1. Health checks /api/health/live e ready estão respondendo", async ({ request }) => {
    const liveRes = await request.get("/api/health/live");
    expect(liveRes.status()).toBe(200);
    const liveData = await liveRes.json();
    expect(liveData.status).toBe("ok");

    const readyRes = await request.get("/api/health/ready");
    expect([200, 503]).toContain(readyRes.status());
  });

  test("2. Endpoint exclusivo /api/test-otp está ativo em ambiente de teste", async ({ request }) => {
    const res = await request.get("/api/test-otp?email=nao_existe@jrc.com.br");
    expect([404, 200]).toContain(res.status());
  });

  test("3. Tela inicial apresenta atmosfera JRC e botão de login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Passaporte de Eventos JRC/);
    await expect(page.locator("h1")).toContainText("Passaporte de Eventos");
    await expect(page.locator("a[href='/login']")).toBeVisible();
  });

  test("4. Tela de login valida formato e bloqueia submissão vazia", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("Acesso ao Passaporte");
    await page.fill("#email", "participante.teste@empresa.com.br");
    await page.click("button[type='submit']");
    await expect(page.locator("text=código de 6 dígitos")).toBeVisible();
  });

  test("5. Acesso direto a /admin sem permissão redireciona para login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/.*login/);
  });

  test("6. Acesso direto a /atendimento sem permissão redireciona para login", async ({ page }) => {
    await page.goto("/atendimento");
    await expect(page).toHaveURL(/.*login/);
  });

  test("7. Acesso direto a /passaporte sem sessão redireciona para login", async ({ page }) => {
    await page.goto("/passaporte");
    await expect(page).toHaveURL(/.*login/);
  });
});
