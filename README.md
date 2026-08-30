# T-Schedule — 課表拉取器

TSchool 數位服務平台的課表子模組（消費端）。每天自動抓取各年級課表 API，比對每位學生的
修課清單算出個人課表，提供切換檢視（年級總表 / 個人課表）、週曆填寫建議、實體課節排行榜、
訂閱式 ICS 日曆 feed，以及 **Google Calendar 雙向同步**——把課表寫進學生自己帳號的主日曆，
讓大家在 Google Calendar 原生的「尋找時間」看到彼此的空堂（訂閱式 ICS 做不到這件事，
它不參與 free/busy）。透過 T-Pass SSO 認身分，**只用 JWKS 公鑰本地驗章**，不回呼 auth、
不碰私鑰。

- 子網域（本機）：`https://schedule.lvh.me:3010`（tpass-auth:3000 / tpass-portal:3001 之後）
- 技術棧：Next 16.3 + React 19 + Tailwind v4 + jose + Prisma(Postgres)

## 本機啟動

1. **環境變數**：`cp .env.example .env.local`，填上 `DATABASE_URL`（本機慣例見下）、
   `SCHEDULE_API_URL_S1/S2/S3`、`GOOGLE_CALENDAR_CLIENT_ID/SECRET`、`CALENDAR_TOKEN_KEY`
   （`openssl rand -base64 32`）、`SCHOOL_EMAIL_DOMAIN`。其餘 SSO / 網域變數已有本機預設值。
2. **資料庫建表**：
   ```bash
   pnpm exec prisma migrate dev
   ```
   或透過上層 ops repo：`scripts/tpass db setup schedule`。
3. **學生名冊 / 課表快取**：`data/s1.json`、`data/s2.json`、`data/s3.json`（gitignored，
   本機自行放置——格式見 `src/lib/data.ts` 的 `StudentMap`）。`data/class/s<grade>/latest.json`
   由排程自動抓取產生，不必手動準備。
4. **HTTPS 憑證**（與 tpass-auth / tpass-portal 共用 mkcert，見上層 `docs/ONBOARDING.md`）。
5. **啟動**：
   ```bash
   pnpm dev   # https://schedule.lvh.me:3010（package.json 已設好 HTTPS + NODE_TLS_REJECT_UNAUTHORIZED=0）
   ```
6. **登入**：用學校 Google 帳號（`auth` 服務需同時在跑）。學號取自信箱 `@` 前的部分，
   須出現在 `data/s<grade>.json` 才查得到課表。

## 檢查

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

## 課表抓取與更新

`src/lib/scheduler.ts` 在服務啟動（`src/instrumentation.ts`）時立即抓取一次所有年級，
之後每天 18:00（UTC+8）自動重抓。單一 instance（`pm2` 設定見 ops repo 的
`deploy/ecosystem.config.js`，`instances: 1`）——備份輪替、latest.json 寫入、同步佇列 worker
都不可多行程併發。

抓完會拿新舊課表比對（`diffAffectedCourseNames`），找出新增/移除/時間或地點變動的課名，
把「修了這些課、且已連結 Google Calendar」的學生排入同步佇列——**調課會影響一群人，
不是一個人**，這是刻意的行為，不是 bug。

## ICS 訂閱

每位學生有一條固定不變的訂閱連結（`/api/getuuid` 取得），輸出符合 RFC 5545 的 iCalendar
（`GET /<uuid>`），可加入 Google Calendar 或其他行事曆 App。⚠️ 這種訂閱式日曆**無法被
Google Calendar 的「尋找時間」查到**（不參與 free/busy），只適合個人自己看。

## Google Calendar 雙向同步

`/api/calendar/connect` 導去 Google 同意畫面（`https://www.googleapis.com/auth/calendar.events`，
`access_type=offline` + `prompt=consent`），`/api/calendar/oauth/callback` 驗 state、換 token、
核對 Google 帳號的網域與學號跟 T-Pass session 一致，才把加密後的 refresh token 存進
`CalendarGrant` 並排入同步佇列。**學生按完同意就能關分頁**——寫入是伺服器背景做的，
之後每天課表更新也是伺服器自動推送，不需要學生再打開這個網站。

- `src/lib/calendar-sync.ts`：算目標事件、跟上次同步快照（`SyncedEvent`）diff，
  只送真正變動的 insert/patch/delete。事件 id 是 `studentId+key` 算出來的 deterministic id
  （`eventIdFor`），本地資料庫全毀也能精準刪除，不會在學生日曆留下幽靈課。
- `src/lib/calendar-queue.ts`：佇列狀態就是 `CalendarGrant.pendingSince` 這個欄位本身
  （持久化、重啟不掉），單一 worker + token bucket 限速（`CALENDAR_SYNC_RATE_PER_MIN`，
  預設 300/min，Google 專案上限 600/min）。
- `/api/calendar/disconnect`：靠 `privateExtendedProperty=tschedule=1` 向 Google 問「本服務
  寫過哪些事件」直接刪光（不信任本地表可能的落差），撤銷 token，清掉本地紀錄。

⚠️ scope 是 `calendar.events`（沒有更小的選項能只碰主日曆上自己建的事件並保留 free/busy），
所以程式只用 `privateExtendedProperty` 查詢自己寫的事件，永不列舉其他事件。
這組 OAuth client 是 T-Pass 生態系的例外（一般消費端不碰 OAuth），界線見 `src/config/calendar.ts`
開頭與上層 `AGENTS.md` §5。
