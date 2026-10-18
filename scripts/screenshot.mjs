// Dev helper: screenshots routes in mobile and desktop sizes.
// Usage: node scripts/screenshot.mjs <outDir> <baseUrl> /route1 /route2 ...
import { chromium } from "@playwright/test";

const [outDir, base, ...routes] = process.argv.slice(2);
const browser = await chromium.launch();
const sizes = [
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
];
const scheme = process.env.SCHEME ?? "light";
for (const s of sizes) {
  if (process.env.ONLY && process.env.ONLY !== s.name) continue;
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.deviceScaleFactor, isMobile: s.isMobile, hasTouch: s.hasTouch, colorScheme: scheme, locale: "es-CO" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: "networkidle" });
    await page.waitForTimeout(Number(process.env.WAIT ?? 1500));
    const file = `${outDir}/${s.name}-${scheme}${r.replace(/\//g, "_") || "_home"}.png`;
    await page.screenshot({ path: file, fullPage: process.env.FULL !== "0" });
    console.log("shot", file);
  }
  if (errors.length) console.log("ERRORS", s.name, errors.slice(0, 8).join("\n"));
  await ctx.close();
}
await browser.close();
