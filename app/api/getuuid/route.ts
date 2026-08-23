import { NextResponse } from "next/server";
import { getSession, studentIdOf } from "@/lib/tpass-auth";
import { getOrCreateCalendarLink } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 取得訂閱日曆連結；若未開啟就順便開啟。連結固定不變。 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const studentId = studentIdOf(session);
  const link = getOrCreateCalendarLink(studentId);
  return NextResponse.json(
    { uuid: link.uuid, enabled: !!link.enabled },
    { headers: { "cache-control": "no-store" } },
  );
}
