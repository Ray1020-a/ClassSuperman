// Google Calendar 雙向同步的設定中心。
//
// ⚠️ 這組 OAuth client 是 T-Pass 生態系的例外：一般消費端不碰 OAuth（登入一律走 T-Pass，
// 見上層 AGENTS.md §5）。這裡的界線很硬——這個 client **只**用來取得
// `https://www.googleapis.com/auth/calendar.events` 授權、把課表寫進學生自己的主日曆，
// **絕不能**被拿來做登入或發證。要判斷「這是誰」永遠讀 T-Pass session（見 src/config/auth.ts），
// 不是這裡的 Google profile。
//
// client 必須建在學校 Workspace 的 GCP 專案下、同意畫面設 Internal——
// 這樣才沒有 100 使用者上限、沒有「未驗證應用程式」警告，也不用送 Google 審核
// （calendar.events 是 sensitive scope，External + 未驗證要審好幾週）。
import "server-only";

const REQUIRED = [
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "CALENDAR_TOKEN_KEY",
  "SCHOOL_EMAIL_DOMAIN",
] as const;

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `[config/calendar] 缺少必填環境變數：${missing.join(", ")}（請檢查 .env.local）`,
  );
}

export const calendarConfig = {
  clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
  tokenKeyBase64: process.env.CALENDAR_TOKEN_KEY!,
  schoolEmailDomain: process.env.SCHOOL_EMAIL_DOMAIN!,
  syncRatePerMin: Number(process.env.CALENDAR_SYNC_RATE_PER_MIN ?? "300"),
  // Google 只認完整 URL；本服務自己的網址已經在 config/auth.ts 驗證過必填。
  redirectUri: `${process.env.SCHEDULE_SELF_URL}/api/calendar/oauth/callback`,
  scope: "https://www.googleapis.com/auth/calendar.events",
} as const;
