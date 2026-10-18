// Generates firestore.rules from firestore.rules.tmpl using ALLOWED_EMAIL.
// Usage: node --env-file=.env.local scripts/build-rules.mjs
import { readFileSync, writeFileSync } from "node:fs";

const emails = (process.env.ALLOWED_EMAIL ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
if (emails.length === 0) {
  console.error("ALLOWED_EMAIL is empty. Set it in .env.local or the environment.");
  process.exit(1);
}
for (const e of emails) {
  if (!/^[^\s@'"\\]+@[^\s@'"\\]+$/.test(e)) {
    console.error(`Invalid email: ${e}`);
    process.exit(1);
  }
}
const tmpl = readFileSync(new URL("../firestore.rules.tmpl", import.meta.url), "utf8");
const out = tmpl.replace("__ALLOWED_EMAILS__", emails.map((e) => `'${e}'`).join(", "));
writeFileSync(new URL("../firestore.rules", import.meta.url), out);
console.log(`firestore.rules written for ${emails.length} allowed email(s).`);
