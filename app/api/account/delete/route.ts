import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { HttpError, errorResponse, requireUser } from "@/lib/server/auth";
import { logEvent } from "@/lib/server/events";

export const maxDuration = 60;

/** Max age of the last real sign-in to allow deleting the account. */
const RECENT_LOGIN_SEC = 15 * 60;

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== "BORRAR") throw new HttpError(400, 'Escribe "BORRAR" para confirmar.');
    if (Date.now() / 1000 - user.authTime > RECENT_LOGIN_SEC) {
      throw new HttpError(401, "Por seguridad, cierra sesión, vuelve a entrar y repite el borrado (debe ser un inicio de sesión reciente).");
    }
    // Everything under users/{uid}: profile, plans, workouts, metrics, meals, chats, reports, memories, usage counters.
    await adminDb().recursiveDelete(adminDb().doc(`users/${user.uid}`));
    await adminAuth().deleteUser(user.uid);
    await logEvent("account_deleted", null);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
