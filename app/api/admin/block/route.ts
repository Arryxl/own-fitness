import { z } from "zod";
import { adminAuth } from "@/lib/firebase/admin";
import { HttpError, errorResponse, requireAdmin } from "@/lib/server/auth";
import { logEvent } from "@/lib/server/events";

const Body = z.object({ uid: z.string().min(1).max(128), blocked: z.boolean() });

/** Blocks/unblocks sign-in. Revoking refresh tokens cuts off the API immediately (tokens are checked for revocation). */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Solicitud inválida");
    const { uid, blocked } = parsed.data;
    if (uid === admin.uid) throw new HttpError(400, "No puedes bloquear tu propia cuenta.");
    await adminAuth().updateUser(uid, { disabled: blocked });
    if (blocked) await adminAuth().revokeRefreshTokens(uid);
    await logEvent(blocked ? "user_blocked" : "user_unblocked", admin.uid);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
