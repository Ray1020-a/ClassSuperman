import { NextResponse } from "next/server";
import { tpass, studentIdOf } from "@/config/auth";
import { getOrCreateCalendarLink } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 取得訂閱日曆連結；若未開啟就順便開啟。連結固定不變。 */
export async function GET() {
  const session = await tpass.getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const studentId = studentIdOf(session);
  const link = await getOrCreateCalendarLink(studentId);
  return NextResponse.json(
    { uuid: link.uuid, enabled: !!link.enabled },
    { headers: { "cache-control": "no-store" } },
  );
}
