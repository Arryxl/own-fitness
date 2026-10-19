import { connection } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { errorResponse, requireAdmin } from "@/lib/server/auth";

/** Account metadata only (no training, health or chat data). */
export async function GET(req: Request) {
  await connection(); // per-request: never prerender
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const pageToken = url.searchParams.get("pageToken") || undefined;
    const page = await adminAuth().listUsers(50, pageToken);
    return Response.json({
      users: page.users.map((u) => ({
        uid: u.uid,
        email: u.email ?? null,
        verified: u.emailVerified || u.providerData.some((p) => p.providerId === "google.com"),
        providers: u.providerData.map((p) => p.providerId),
        disabled: u.disabled,
        admin: u.customClaims?.admin === true,
        createdAt: u.metadata.creationTime,
        lastSignInAt: u.metadata.lastSignInTime,
      })),
      nextPageToken: page.pageToken ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
