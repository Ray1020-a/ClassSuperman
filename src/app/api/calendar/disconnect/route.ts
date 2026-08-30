import { NextResponse } from "next/server";
import { tpass, studentIdOf } from "@/config/auth";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import {
  InvalidGrantError,
  deleteEventByGoogleId,
  listAllSyncedEventIds,
  refreshAccessToken,
  revokeToken,
} from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 中斷連結：刪光已寫入的事件、撤銷授權、清掉本地紀錄。 */
export async function POST() {
  const session = await tpass.getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const studentId = studentIdOf(session);

  const grant = await prisma.calendarGrant.findUnique({ where: { studentId } });
  if (!grant) return NextResponse.json({ ok: true });

  if (!grant.invalidatedAt) {
    let accessToken: string | null = null;
    try {
      accessToken = await refreshAccessToken(decryptToken(grant.refreshToken));
    } catch (err) {
      if (!(err instanceof InvalidGrantError)) {
        console.error("[calendar/disconnect] 取得 access token 失敗，略過事件清除：", err);
      }
    }

    if (accessToken) {
      // 靠 privateExtendedProperty 直接向 Google 問「本服務寫過哪些事件」，
      // 不信任本地 SyncedEvent 表（可能跟 Google 端有落差）——這是真正的保底清除。
      try {
        const ids = await listAllSyncedEventIds(accessToken);
        for (const id of ids) {
          await deleteEventByGoogleId(accessToken, id).catch(() => {});
        }
      } catch (err) {
        console.error("[calendar/disconnect] 列出/刪除事件失敗（本地紀錄仍會清掉）：", err);
      }
      await revokeToken(decryptToken(grant.refreshToken)).catch(() => {});
    }
  }

  await prisma.syncedEvent.deleteMany({ where: { studentId } });
  await prisma.calendarGrant.delete({ where: { studentId } });

  return NextResponse.json({ ok: true });
}
