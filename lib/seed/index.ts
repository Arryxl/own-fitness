// The validated seed, importable on server and client (bundled JSON).
// Firestore `catalog/*` is the runtime source of truth; this bundle is the
// offline fallback and what the seed script uploads.
import raw from "@/data/seed/rutinas_seed.json";
import { SeedSchema, type Seed } from "./schema";

let cached: Seed | null = null;

export function seed(): Seed {
  cached ??= SeedSchema.parse(raw);
  return cached;
}
