import { expect, test, type Page } from "@playwright/test";

const PROJECT = "demo-ironlog";
const AUTH = "http://127.0.0.1:9099";
const FS = "http://127.0.0.1:8080";

async function verifyEmail(email: string) {
  const res = await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const { oobCodes } = (await res.json()) as { oobCodes: { email: string; requestType: string; oobLink: string }[] };
  const code = oobCodes.reverse().find((c) => c.email === email && c.requestType === "VERIFY_EMAIL");
  expect(code, "verification email").toBeTruthy();
  await fetch(code!.oobLink.replace("127.0.0.1:9099", "127.0.0.1:9099"));
}

async function accountExists(email: string): Promise<boolean> {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, {
    method: "POST",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ expression: [{ email }], returnUserInfo: true }),
  });
  const j = (await res.json()) as { userInfo?: unknown[] };
  return (j.userInfo?.length ?? 0) > 0;
}

async function next(page: Page) {
  await page.getByRole("button", { name: /Siguiente|Ver rutinas recomendadas/ }).click();
}

test("registro → onboarding → rutina → entreno offline → informe IA → cuota → borrar cuenta", async ({ page, context }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // 1) Sign up with email/password and verify the address.
  await page.goto("/login");
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre o alias").fill("Prueba");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill("contraseña-segura-123");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verifica tu correo" })).toBeVisible();
  await verifyEmail(email);
  await page.getByRole("button", { name: "Ya lo verifiqué" }).click();

  // 2) Onboarding (health + privacy acceptance, adult check, AI consent).
  await expect(page.getByText(/Paso 1 de 6/)).toBeVisible();
  await page.getByLabel("Entiendo y acepto el aviso de salud.").check();
  await page.getByRole("checkbox", { name: /política de privacidad/ }).check();
  await next(page);
  await page.getByLabel("Fecha de nacimiento").fill("2015-01-01");
  await expect(page.getByRole("alert").filter({ hasText: /mayores de 18/ })).toBeVisible();
  await page.getByLabel("Fecha de nacimiento").fill("1995-05-10");
  await page.getByRole("button", { name: "Hombre" }).click();
  await page.getByLabel("Estatura (cm)").fill("180");
  await page.getByLabel("Peso (kg)").fill("75");
  await next(page);
  await page.getByRole("button", { name: /^Crecer/ }).click();
  await page.getByRole("button", { name: "Principiante" }).click();
  for (const d of ["lunes", "miércoles", "viernes"]) await page.getByRole("button", { name: d, exact: true }).click();
  await next(page);
  await next(page); // gym
  await next(page); // food
  await page.getByLabel("Acepto usar el coach de IA con mis datos").check({ force: true });
  await next(page);

  // 3) Recommended routine for 3-day beginner hypertrophy is H1.
  await expect(page.getByRole("heading", { name: "Rutinas" })).toBeVisible();
  const recommended = page.locator("section", { hasText: "Recomendadas para ti" });
  await expect(recommended.getByText("Full Body ×3")).toBeVisible();
  await recommended.getByRole("button", { name: "Usar esta rutina" }).first().click();
  await page.getByRole("button", { name: "Crear mi plan" }).click();
  // The app returns to Hoy after saving the plan; reloading before that can lose the write.
  await expect(page).toHaveURL(/:\d+\/$/);
  await expect(page.getByText("Hoy toca").or(page.getByText("Hoy no hay gimnasio"))).toBeVisible();

  // 4) First workout, logged with the network off.
  await page.goto("/entrenar");
  await page.getByRole("button", { name: /Iniciar Torso A/ }).click();
  await context.setOffline(true);
  await page.getByLabel(/Peso serie 1 en/).first().fill("40");
  await page.getByLabel("Repeticiones serie 1").first().fill("10");
  await page.getByLabel("Marcar serie 1 como hecha").first().click();
  await page.getByRole("button", { name: "Terminar" }).click();
  await page.getByRole("radio", { name: "7" }).click();
  await page.getByRole("button", { name: "Guardar sesión" }).click();
  await expect(page.getByText("Sesión guardada")).toBeVisible();
  await context.setOffline(false);
  await page.goto("/historial");
  await page.getByRole("button", { name: /Torso A/ }).first().click();
  await expect(page.getByText(/10 × 40/)).toBeVisible();

  // 5) AI report (fake model) and the per-user daily quota (AI_DAILY_MESSAGES=2).
  await page.goto("/coach");
  await page.getByRole("tab", { name: "Informes" }).click();
  await page.getByRole("button", { name: /Semana actual/ }).click();
  await expect(page.getByText("Informe de prueba", { exact: false })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Semana actual/ }).click();
  await expect(page.getByText("Informe listo").first()).toBeVisible();
  await page.getByRole("button", { name: /Semana actual/ }).click();
  await expect(page.getByText(/límite diario/)).toBeVisible();

  // 6) Delete the account and every document.
  await page.goto("/ajustes");
  await page.getByRole("button", { name: /Borrar mi cuenta/ }).click();
  await page.getByLabel(/Escribe "BORRAR"/).fill("BORRAR");
  await page.getByRole("button", { name: "Borrar todo definitivamente" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  expect(await accountExists(email)).toBe(false);
  const docs = await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/users`, { headers: { Authorization: "Bearer owner" } }).then((r) => r.json());
  expect(docs.documents ?? []).toEqual([]);
});
