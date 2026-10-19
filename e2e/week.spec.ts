import { expect, test, type Page } from "@playwright/test";

// "Mi semana": extra blocks by hand and through the coach (fake AI running the
// real propose_week_block tool against the emulator). Set SCREENSHOTS_DIR to
// also save screenshots of each step.
const dir = process.env.SCREENSHOTS_DIR;

async function signUpWithPlan(page: Page) {
  const email = `semana-${Date.now()}@example.com`;
  await page.goto("/login");
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre o alias").fill("Juan");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill("contraseña-segura-123");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verifica tu correo" })).toBeVisible();
  const codes = (await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-ironlog/oobCodes")).json()).oobCodes as {
    email: string;
    oobLink: string;
  }[];
  await fetch(codes.reverse().find((c) => c.email === email)!.oobLink);
  await page.getByRole("button", { name: "Ya lo verifiqué" }).click();
  await page.getByLabel("Entiendo y acepto el aviso de salud.").check();
  await page.getByRole("checkbox", { name: /política de privacidad/ }).check();
  const next = () => page.getByRole("button", { name: /Siguiente|Ver rutinas recomendadas/ }).click();
  await next();
  await page.getByLabel("Fecha de nacimiento").fill("1996-04-12");
  await page.getByRole("button", { name: "Hombre" }).click();
  await page.getByLabel("Estatura (cm)").fill("175");
  await page.getByLabel("Peso (kg)").fill("88");
  await next();
  await page.getByRole("button", { name: /^Crecer/ }).click();
  await page.getByRole("button", { name: "Principiante" }).click();
  for (const d of ["lunes", "miércoles", "viernes"]) await page.getByRole("button", { name: d, exact: true }).click();
  await next();
  await next(); // gym
  await next(); // food
  await page.getByLabel("Acepto usar el coach de IA con mis datos").check({ force: true });
  await next();
  await page.locator("section", { hasText: "Recomendadas para ti" }).getByRole("button", { name: "Usar esta rutina" }).first().click();
  await page.getByRole("button", { name: "Crear mi plan" }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
}

test("mi semana: bloque a mano y bloque propuesto por el coach", async ({ page }) => {
  const shot = async (name: string) => {
    if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  };
  await signUpWithPlan(page);

  await page.goto("/semana");
  const day = (name: string) => page.getByRole("region", { name, exact: true });
  await expect(day("lunes").getByText("Torso A + pierna")).toBeVisible();
  await expect(day("martes").getByText("Descanso")).toBeVisible();
  await page.waitForTimeout(800);
  // No sideways scrolling on a phone (a wide page also pushes sheets off-screen).
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await shot("semana-01");

  // 1) By hand: core at home on Tuesday from a preset.
  await page.getByRole("button", { name: "Añadir bloque el martes" }).click();
  await page.getByRole("button", { name: /Core en casa/ }).click();
  await expect(page.getByRole("heading", { name: "Nuevo bloque" })).toBeVisible();
  await shot("semana-02-editor");
  await page.getByRole("button", { name: "Añadir a mi semana" }).click();
  await expect(day("martes").getByText("Core en casa")).toBeVisible();
  await expect(day("martes").getByText("Extra")).toBeVisible();

  // 2) Through the coach: ask about Thursday, approve the proposal.
  await page.getByRole("button", { name: "Preguntar al coach por el jueves" }).click();
  const input = page.getByLabel("Mensaje para el coach");
  await expect(input).toHaveValue("Para el jueves: ");
  await expect(page.getByText("Hablando del jueves")).toBeVisible();
  await input.fill("Para el jueves: quiero bajar la barriga, ¿me conviene hacer abdomen en casa?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(/te propuse un bloque de core en casa/)).toBeVisible();
  await expect(page.getByText("Pregúntale a tu coach")).toHaveCount(0);
  const proposal = page.locator("#propuestas-semana");
  await expect(proposal.getByText("Core en casa para complementar tu plan")).toBeVisible();
  await expect(proposal.getByText(/jueves/)).toBeVisible();
  await shot("semana-03-propuesta");
  await proposal.getByRole("button", { name: "Aplicar" }).click();
  await expect(day("jueves").getByText("Core en casa")).toBeVisible();
  await expect(proposal).toHaveCount(0);

  // 3) Extra blocks don't change the gym sessions planned for the week.
  await expect(page.getByText("Días de gym / fuerza").locator("..").getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByText("Bloques extra").locator("..").getByText("2", { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await shot("semana-04-final");

  // 4) The home chart shows the planned extra blocks apart from the gym days.
  await page.goto("/"); // the dev-tools badge covers the "Hoy" tab in dev
  await expect(page.getByText("Bloques extra (casa, fuera)")).toBeVisible();
  await expect(page.getByText("Bloques extra", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /M: 0 series de plan \(0\/1 extra hechos\)/ })).toBeVisible();
  await page.waitForTimeout(600);
  await shot("hoy-grafica");
  await page.goto("/semana");

  // 5) Edit and remove a block.
  await day("martes")
    .getByRole("button", { name: /Core en casa/ })
    .click();
  await page.getByRole("button", { name: "Quitar" }).last().click();
  await page.getByRole("button", { name: "¿Seguro?" }).click();
  await expect(day("martes").getByText("Descanso")).toBeVisible();
});
