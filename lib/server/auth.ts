import "server-only";
import { adminAuth } from "@/lib/firebase/admin";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export interface AuthedUser {
  uid: string;
  email: string;
}

/** Verifies the Firebase ID token in the Authorization header and the email allowlist. */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Falta el token de sesión");
  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(token);
  } catch {
    throw new HttpError(401, "Sesión inválida o expirada");
  }
  const email = (decoded.email ?? "").toLowerCase();
  const allow = allowedEmails();
  if (allow.length === 0) throw new HttpError(500, "ALLOWED_EMAIL no está configurada en el servidor");
  if (!decoded.email_verified || !allow.includes(email)) throw new HttpError(403, "Esta cuenta no tiene acceso");
  return { uid: decoded.uid, email };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: "Error interno. Tus datos están a salvo; intenta de nuevo." }, { status: 500 });
}
