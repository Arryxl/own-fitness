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

export interface AuthedUser {
  uid: string;
  email: string;
  admin: boolean;
  /** Seconds since epoch of the last real sign-in (not token refresh). */
  authTime: number;
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verifies the Firebase ID token (including revocation, so blocked users are
 * cut off) and requires a verified email or a Google account.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Falta el token de sesión");
  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(token, true);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/user-disabled") throw new HttpError(403, "Tu cuenta está bloqueada.");
    throw new HttpError(401, "Sesión inválida o expirada. Vuelve a iniciar sesión.");
  }
  const google = decoded.firebase?.sign_in_provider === "google.com";
  if (!decoded.email_verified && !google) throw new HttpError(403, "Verifica tu correo para continuar.");
  const email = (decoded.email ?? "").toLowerCase();
  return {
    uid: decoded.uid,
    email,
    admin: decoded.admin === true || (!!email && !!decoded.email_verified && adminEmails().includes(email)),
    authTime: decoded.auth_time,
  };
}

export async function requireAdmin(req: Request): Promise<AuthedUser> {
  const u = await requireUser(req);
  if (!u.admin) throw new HttpError(403, "Solo para administradores");
  return u;
}

/** Best-effort client IP for rate limiting (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  // Never log request bodies or user data: only the error type/message.
  console.error("api error:", (err as Error)?.name, (err as Error)?.message);
  return Response.json({ error: "Error interno. Tus datos están a salvo; intenta de nuevo." }, { status: 500 });
}
