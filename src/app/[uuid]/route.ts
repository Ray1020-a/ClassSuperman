import { NextResponse } from "next/server";
import { studentIdByUuid } from "@/lib/db";
import { getUserCourses } from "@/lib/data";
import { buildICS } from "@/lib/ics";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_LIMIT = 20; // 每分鐘每 uuid，避免被 DoS 短時間查詢太多次
const IP_LIMIT = 60;

/** 訂閱日曆 feed（唯讀）：重新輸出最新課表為 iCalendar */
export async function GET(
  req: Request,
  ctx: RouteContext<"/[uuid]">,
) {
  const { uuid } = await ctx.params;

  let rl = rateLimit(`ics:uuid:${uuid}`, UUID_LIMIT);
  if (!rl.allowed) return tooMany(rl.retryAfterSec);
  rl = rateLimit(`ics:ip:${clientIp(req)}`, IP_LIMIT);
  if (!rl.allowed) return tooMany(rl.retryAfterSec);

  const studentId = await studentIdByUuid(uuid);
  if (!studentId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const user = await getUserCourses(studentId);
  if (!user) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ics = buildICS(user.courses, user.name, uuid);
  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="timetable-${studentId}.ics"`,
      "cache-control": "no-store",
    },
  });
}

function tooMany(retryAfterSec: number): NextResponse {
  return new NextResponse("Too Many Requests", {
    status: 429,
    headers: { "retry-after": String(retryAfterSec) },
  });
}
