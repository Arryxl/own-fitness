import { errorResponse, requireUser } from "@/lib/server/auth";

export async function GET(req: Request) {
  try {
    await requireUser(req);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
