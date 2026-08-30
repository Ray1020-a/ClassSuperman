// Google Calendar API 的最小 REST 包裝。刻意不用 googleapis SDK——只需要
// token exchange/refresh、userinfo、events insert/patch/delete/list 這幾個端點，
// fetch 直接打比引入一個大型 SDK 更清楚（CLAUDE.md：選最笨但最清楚的做法）。
import "server-only";
import { createHash } from "node:crypto";
import { calendarConfig } from "@/config/calendar";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const EVENTS_BASE =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string; // 只有第一次同意（access_type=offline + prompt=consent）才會回
  expiresIn: number;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  emailVerified: boolean;
  hd?: string; // Workspace 網域（消費端帳號沒有這個欄位）
}

/** 一次性 code 換 token（授權流程 callback 用） */
export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: calendarConfig.clientId,
      client_secret: calendarConfig.clientSecret,
      redirect_uri: calendarConfig.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`[google-calendar] code 交換失敗：HTTP ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  };
}

/** invalid_grant：refresh token 已失效（學生自己在 Google 帳號頁撤銷、或密碼重設） */
export class InvalidGrantError extends Error {}

/** 用 refresh token 換一個新的 access token（同步引擎每次執行前呼叫一次） */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: calendarConfig.clientId,
      client_secret: calendarConfig.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 400 && body.includes("invalid_grant")) {
      throw new InvalidGrantError(body);
    }
    throw new Error(`[google-calendar] refresh 失敗：HTTP ${res.status} ${body}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`[google-calendar] userinfo 失敗：HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    sub: string;
    email: string;
    email_verified?: boolean;
    hd?: string;
  };
  return {
    sub: json.sub,
    email: json.email,
    emailVerified: json.email_verified ?? false,
    hd: json.hd,
  };
}

/** 撤銷 refresh token（disconnect 用；連 access token 一起失效） */
export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  // Google 對已撤銷/不存在的 token 也回 200，不特別檢查失敗——disconnect 不該因為
  // 這一步卡住（本地事件與 grant record 才是使用者真正在意的東西）。
}

// ── Calendar events ──────────────────────────────────────────────────

export interface SyncEvent {
  key: string; // "<課名>|<M/D>|<起始節>"
  summary: string;
  location?: string;
  start: string; // ISO8601 本地時間，不含時區 offset（配 timeZone 欄位）
  end: string;
}

/** Google 自訂 event id 只能是小寫 base32hex 字元（0-9、a-v），5~1024 字。 */
function base32hex(buf: Buffer): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuv";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

/** studentId+key -> 固定 event id。本地 DB 全毀也能重算出同一組 id 精準刪除。 */
export function eventIdFor(studentId: string, key: string): string {
  const digest = createHash("sha1").update(`tschedule|${studentId}|${key}`).digest();
  return `tsched${base32hex(digest)}`;
}

function eventBody(ev: SyncEvent) {
  return {
    summary: ev.summary,
    location: ev.location || undefined,
    start: { dateTime: ev.start, timeZone: "Asia/Taipei" },
    end: { dateTime: ev.end, timeZone: "Asia/Taipei" },
    // opaque：佔用忙碌時段，這樣 free/busy 與「尋找時間」才會生效（唯一目的）。
    transparency: "opaque",
    reminders: { useDefault: false, overrides: [] },
    extendedProperties: { private: { tschedule: "1", key: ev.key } },
  };
}

async function callEvents(
  accessToken: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${EVENTS_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

export interface CalendarApiError extends Error {
  status: number;
}

function apiError(status: number, body: string): CalendarApiError {
  const err = new Error(`[google-calendar] HTTP ${status} ${body}`) as CalendarApiError;
  err.status = status;
  return err;
}

/** insert；撞已存在的 id（409）就當作呼叫端該改走 patchEvent 處理。 */
export async function insertEvent(
  accessToken: string,
  studentId: string,
  ev: SyncEvent,
): Promise<void> {
  const id = eventIdFor(studentId, ev.key);
  const res = await callEvents(accessToken, "", {
    method: "POST",
    body: JSON.stringify({ id, ...eventBody(ev) }),
  });
  if (res.status === 409) return; // 已存在（例如上次同步中斷在寫入後、記錄前）——視同成功
  if (!res.ok) throw apiError(res.status, await res.text());
}

export async function patchEvent(
  accessToken: string,
  studentId: string,
  ev: SyncEvent,
): Promise<void> {
  const id = eventIdFor(studentId, ev.key);
  const res = await callEvents(accessToken, `/${id}`, {
    method: "PATCH",
    body: JSON.stringify(eventBody(ev)),
  });
  if (res.status === 404) return insertEvent(accessToken, studentId, ev);
  if (!res.ok) throw apiError(res.status, await res.text());
}

export async function deleteEventByGoogleId(
  accessToken: string,
  id: string,
): Promise<void> {
  const res = await callEvents(accessToken, `/${id}`, { method: "DELETE" });
  // 404/410＝早就不在了（可能上次同步已經刪過），視同成功。
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw apiError(res.status, await res.text());
  }
}

export async function deleteEvent(
  accessToken: string,
  studentId: string,
  key: string,
): Promise<void> {
  return deleteEventByGoogleId(accessToken, eventIdFor(studentId, key));
}

/** disconnect 用：列出所有本服務寫過的事件 id（靠 extendedProperties 過濾，不列舉其他事件）。 */
export async function listAllSyncedEventIds(accessToken: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      privateExtendedProperty: "tschedule=1",
      maxResults: "2500",
      showDeleted: "false",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await callEvents(accessToken, `?${params}`, { method: "GET" });
    if (!res.ok) throw apiError(res.status, await res.text());
    const json = (await res.json()) as {
      items?: { id: string }[];
      nextPageToken?: string;
    };
    for (const item of json.items ?? []) ids.push(item.id);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return ids;
}
