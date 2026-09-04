// Prisma client 單例（Next dev/HMR 下避免每次重載都新建連線）+ CalendarLink 存取。
import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 的連線池就是 pg 的 Pool，預設沒有任何逾時。這裡明確給上限：
// 依賴變慢時 request 會失敗而不是無限排隊把整台服務拖垮（準則見 tpass-ops handbook〈資料庫〉）。
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  options: "-c statement_timeout=30000",
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export interface CalendarLinkRow {
  uuid: string;
  studentId: string;
  enabled: boolean;
}

/** 取得學生的訂閱連結（不開啟） */
export async function getCalendarLink(
  studentId: string,
): Promise<CalendarLinkRow | null> {
  return prisma.calendarLink.findUnique({
    where: { studentId },
    select: { uuid: true, studentId: true, enabled: true },
  });
}

/** 取得訂閱連結；若未開啟就順便開啟。連結固定不換。 */
export async function getOrCreateCalendarLink(
  studentId: string,
): Promise<CalendarLinkRow> {
  return prisma.calendarLink.upsert({
    where: { studentId },
    update: { enabled: true },
    create: { studentId, enabled: true },
    select: { uuid: true, studentId: true, enabled: true },
  });
}

/** 由 uuid 查學號（僅允許已開啟者，供唯讀查詢端點使用） */
export async function studentIdByUuid(uuid: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) return null;
  const row = await prisma.calendarLink.findFirst({
    where: { uuid, enabled: true },
    select: { studentId: true },
  });
  return row?.studentId ?? null;
}
