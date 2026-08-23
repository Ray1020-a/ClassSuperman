import "server-only";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

export interface CalendarLinkRow {
  uuid: string;
  student_id: string;
  enabled: number;
  created_at: string;
}

function createDb(): DatabaseSync {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "calendar.db"));
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_links (
      uuid TEXT PRIMARY KEY,
      student_id TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

const globalForDb = globalThis as unknown as {
  __classsupermanDb?: DatabaseSync;
};

function db(): DatabaseSync {
  globalForDb.__classsupermanDb ??= createDb();
  return globalForDb.__classsupermanDb;
}

/** 取得學生的訂閱連結（不開啟） */
export function getCalendarLink(studentId: string): CalendarLinkRow | null {
  const row = db()
    .prepare("SELECT uuid, student_id, enabled, created_at FROM calendar_links WHERE student_id = ?")
    .get(studentId) as CalendarLinkRow | undefined;
  return row ?? null;
}

/** 取得訂閱連結；若未開啟就順便開啟。連結固定不換。 */
export function getOrCreateCalendarLink(studentId: string): CalendarLinkRow {
  const existing = getCalendarLink(studentId);
  if (existing) {
    if (!existing.enabled) {
      db().prepare("UPDATE calendar_links SET enabled = 1 WHERE student_id = ?").run(
        studentId,
      );
      existing.enabled = 1;
    }
    return existing;
  }
  const uuid = crypto.randomUUID();
  db()
    .prepare(
      "INSERT INTO calendar_links (uuid, student_id, enabled) VALUES (?, ?, 1)",
    )
    .run(uuid, studentId);
  return { uuid, student_id: studentId, enabled: 1, created_at: "" };
}

/** 由 uuid 查學號（僅允許已開啟者，供唯讀查詢端點使用） */
export function studentIdByUuid(uuid: string): string | null {
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) return null;
  const row = db()
    .prepare("SELECT student_id FROM calendar_links WHERE uuid = ? AND enabled = 1")
    .get(uuid) as { student_id: string } | undefined;
  return row?.student_id ?? null;
}
