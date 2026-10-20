import { expect, test } from "@playwright/test";

// Routines for women: choosing "Glúteo y pierna" during onboarding recommends
// the glute templates, and the routines page can filter them. Set
// SCREENSHOTS_DIR to also save screenshots of each step.
const dir = process.env.SCREENSHOTS_DIR;

test("rutinas para mujeres según el enfoque elegido", async ({ page }) => {
  const shot = async (name: string) => {
    if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  };
  const email = `mujer-${Date.now()}@example.com`;
  await page.goto("/login");
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre o alias").fill("Laura");
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
  await page.getByLabel("Fecha de nacimiento").fill("1997-08-21");
  await page.getByRole("button", { name: "Mujer" }).click();
  await page.getByLabel("Estatura (cm)").fill("163");
  await page.getByLabel("Peso (kg)").fill("60");
  await next();

  await page.getByRole("button", { name: /^Crecer/ }).click();
  await page.getByRole("button", { name: "Glúteo y pierna", exact: true }).click();
  await expect(page.getByText("Priorizar glúteo, con pierna completa como base.")).toBeVisible();
  await page.getByRole("button", { name: "Principiante" }).click();
  for (const d of ["lunes", "martes", "jueves", "viernes"]) await page.getByRole("button", { name: d, exact: true }).click();
  await shot("mujeres-01-objetivo");
  await next();
  await next(); // gym
  await next(); // food
  await page.getByLabel("Acepto usar el coach de IA con mis datos").check({ force: true });
  await next();

  const recommended = page.locator("section", { hasText: "Recomendadas para ti" });
  await expect(recommended.getByText("Glúteo y pierna · 4 días (pierna-torso)")).toBeVisible();
  await expect(recommended.getByText("Pierna completa · 4 días (pierna-torso)")).toBeVisible();
  await page.waitForTimeout(800);
  await shot("mujeres-02-recomendadas");

  await page.getByRole("radiogroup", { name: "Enfoque" }).getByRole("radio", { name: "Para mujeres" }).click();
  await expect(page.getByText("8 rutinas")).toBeVisible();
  await shot("mujeres-03-filtro");

  await recommended.getByRole("button", { name: "Usar esta rutina" }).first().click();
  await page.waitForTimeout(500);
  await shot("mujeres-04-usar");
  await page.getByRole("button", { name: "Crear mi plan" }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
  await page.waitForTimeout(1500);
  await shot("mujeres-05-hoy");
});
