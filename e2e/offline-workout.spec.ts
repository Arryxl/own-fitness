import { expect, test } from "@playwright/test";

// Logs a full session with the network off, then reconnects and checks the
// session was kept (autosave + local persistence) and shows up in history.
// In demo mode the "server" is the browser store; with Firebase the same UI
// path writes to Firestore's offline cache, which syncs on reconnect.
test("registrar una sesión sin conexión y verla al reconectar", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/entrenar");
  await expect(page.getByRole("heading", { name: "Entrenar" })).toBeVisible();

  await context.setOffline(true);
  await page.getByRole("button", { name: /Iniciar Torso B/ }).click();
  await expect(page.getByText("Sin conexión").locator("visible=true")).toBeVisible();

  await page.getByLabel("Peso serie 1 en lb").fill("45");
  await page.getByLabel("Repeticiones serie 1").fill("10");
  await page.getByLabel("Marcar serie 1 como hecha").click();
  await page.getByLabel("Marcar serie 2 como hecha").click();
  await expect(page.getByText(/2\/\d+ series/)).toBeVisible();

  await page.getByRole("button", { name: "Terminar" }).click();
  await page.getByRole("radio", { name: "8" }).click();
  await page.getByRole("button", { name: "Guardar sesión" }).click();
  await expect(page.getByText("Sesión guardada")).toBeVisible();

  await context.setOffline(false);
  await page.reload();
  await page.goto("/historial");
  await page.getByRole("button", { name: /Torso B \+ pierna/ }).first().click();
  await expect(page.getByText(/10 × 45 lb/)).toBeVisible();
});
