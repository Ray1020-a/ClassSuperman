// Prisma client 單例（Next dev/HMR 下避免每次重載都新建連線）+ CalendarLink 存取。
import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
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
  const existing = await getCalendarLink(studentId);
  if (existing) {
    if (existing.enabled) return existing;
    return prisma.calendarLink.update({
      where: { studentId },
      data: { enabled: true },
      select: { uuid: true, studentId: true, enabled: true },
    });
  }
  return prisma.calendarLink.create({
    data: { studentId, enabled: true },
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
