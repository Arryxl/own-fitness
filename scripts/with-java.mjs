// Runs a command with the portable JRE in .tools/ on PATH (used for the
// Firebase emulators). Falls back to the system Java if .tools is absent.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const tools = path.resolve(".tools");
const jre = existsSync(tools) ? readdirSync(tools).find((d) => d.startsWith("jdk")) : undefined;
const env = { ...process.env };
if (jre) {
  const bin = path.join(tools, jre, "bin");
  env.PATH = `${bin}${path.delimiter}${env.PATH ?? env.Path ?? ""}`;
  env.Path = env.PATH;
  env.JAVA_HOME = path.join(tools, jre);
}
const [cmd, ...args] = process.argv.slice(2);
// With a shell (needed on Windows for npx), re-quote arguments that contain spaces.
const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a));
const r = spawnSync(cmd, quoted, { stdio: "inherit", env, shell: process.platform === "win32" });
process.exit(r.status ?? 1);
