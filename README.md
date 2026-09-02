# T-Schedule — 課表拉取器

每天自動抓各年級課表 API，比對每位學生的修課清單算出個人課表：年級總表／個人課表切換、
訂閱式 ICS feed、**Google Calendar 同步**（把課表寫進學生自己的主日曆，讓「尋找時間」看得到彼此的空堂——
訂閱式 ICS 不參與 free/busy，做不到這件事）。SSO 消費端（id `schedule`），**尚未上線**（註冊表 `deployed:false`）。

## 本機跑

```bash
pnpm install
pnpm exec prisma migrate dev     # 或上層 scripts/tpass db setup schedule
pnpm dev                         # https://schedule.lvh.me:3010（已內建 HTTPS + NODE_TLS_REJECT_UNAUTHORIZED=0）
```

- 憑證在 `$HOME/tpass-certs`（上層 `scripts/tpass setup`）；auth 要同時在跑，一次跑多個用上層 `scripts/tpass dev`。
- 學生名冊 `data/s1.json` / `s2.json` / `s3.json` 要自己放（gitignored，格式見 `src/lib/data.ts` 的 `StudentMap`）；
  `data/class/s<grade>/latest.json` 由排程自動產生。學號取自信箱 `@` 前的部分，不在名冊裡就查不到課表。

檢查：`pnpm lint` + `pnpm exec tsc --noEmit` + `pnpm build`。

## 環境變數

範本 `.env.example`，真值寫 `.env.local`。必填真相在 `src/config/auth.ts`（SSO，綁 `tpass-auth-js`）與
`src/config/calendar.ts`（`GOOGLE_CALENDAR_CLIENT_ID/SECRET`、`CALENDAR_TOKEN_KEY`＝`openssl rand -base64 32`、
`SCHEDULE_API_URL_S1/S2/S3`、`SCHOOL_EMAIL_DOMAIN`、`CALENDAR_SYNC_RATE_PER_MIN`）。

## 部署

`tpass deploy schedule`（上層 tpass-ops CLI；上線前要先把註冊表 `deployed` 翻 `true`）。

## 資料庫

Prisma + PostgreSQL（`prisma/schema.prisma`，`prisma migrate dev`）。目前釘 Prisma 6，待升 Prisma 7。

## 設計要點

- **排程**（`src/lib/scheduler.ts`）：啟動時抓一次，之後每天 18:00（UTC+8）重抓；新舊 diff 找出變動課名，
  把「修了這些課且已連結日曆」的學生排入同步佇列——調課影響一群人，是刻意行為。單一 instance，不可多行程併發。
- **ICS**（`/api/getuuid` → `GET /<uuid>`）：固定訂閱連結，RFC 5545。
- **Google Calendar**：`/api/calendar/connect` → 同意畫面（`calendar.events`，offline + consent）→ `oauth/callback`
  驗 state、核對 Google 帳號與 T-Pass session 一致才存加密 refresh token（`src/lib/crypto.ts`）。
  同步（`calendar-sync.ts`）用 deterministic event id 只送真正變動；佇列（`calendar-queue.ts`）就是 `CalendarGrant.pendingSince`，
  單 worker + token bucket。`disconnect` 靠 `privateExtendedProperty=tschedule=1` 刪光自己寫過的事件並撤銷 token。
  這組 OAuth 是生態系唯一例外，界線見 `src/config/calendar.ts` 與 `AGENTS.md`。

## 文件

agent 規則：`AGENTS.md`。SSO 合約：`tpass-auth/INTEGRATION.md`。生態系地圖與部員手冊：上層 tpass-ops 的 `AGENTS.md` 與 `docs/handbook/`。
