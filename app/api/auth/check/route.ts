import { connection } from "next/server";
import { errorResponse, requireUser } from "@/lib/server/auth";

export async function GET(req: Request) {
  await connection(); // per-request: never prerender
  try {
    await requireUser(req);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
