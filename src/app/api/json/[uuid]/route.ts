import { NextResponse } from "next/server";
import { studentIdByUuid } from "@/lib/db";
import { getUserCourses } from "@/lib/data";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_LIMIT = 20; // 每分鐘每 uuid
const IP_LIMIT = 60; // 每分鐘每 IP

/** 取得該訂閱者的 JSON 課表（唯讀，依 latest.json 即時輸出） */
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/json/[uuid]">,
) {
  const { uuid } = await ctx.params;

  let rl = rateLimit(`json:uuid:${uuid}`, UUID_LIMIT);
  if (!rl.allowed)
    return tooMany(rl.retryAfterSec);
  rl = rateLimit(`json:ip:${clientIp(req)}`, IP_LIMIT);
  if (!rl.allowed)
    return tooMany(rl.retryAfterSec);

  const studentId = await studentIdByUuid(uuid);
  if (!studentId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const user = await getUserCourses(studentId);
  if (!user) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      student_id: studentId,
      name: user.name,
      courses: user.courses,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

function tooMany(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "rate limited" },
    {
      status: 429,
      headers: { "retry-after": String(retryAfterSec) },
    },
  );
}
