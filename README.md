# T-Schedule — 課表拉取器

TSchool 數位服務平台的課表子模組（消費端）。每天自動抓取各年級課表 API，比對每位學生的
修課清單算出個人課表，提供切換檢視（年級總表 / 個人課表）、週曆填寫建議、實體課節排行榜，
以及訂閱式 ICS 日曆 feed。透過 T-Pass SSO 認身分，**只用 JWKS 公鑰本地驗章**，不回呼 auth、
不碰私鑰。

- 子網域（本機）：`https://schedule.lvh.me:3010`（tpass-auth:3000 / tpass-portal:3001 之後）
- 技術棧：Next 16.3 + React 19 + Tailwind v4 + jose

> **目前狀態**：對齊平台標準中。個人課表 / 切換檢視 / 週曆建議 / 排行榜 / ICS 訂閱皆已可用；
> Google Calendar 雙向同步（把課表寫進學生自己主日曆，讓大家在 GCal 原生看到彼此空堂）
> 正在後續 PR 進行（會把持久層一併換成 Prisma/Postgres），見 `tpass-registry` 的
> `schedule` 服務 note。

## 本機啟動

1. **環境變數**：`cp .env.example .env.local`，填上 `SCHEDULE_API_URL_S1/S2/S3`。
   其餘 SSO / 網域變數已有本機預設值。
2. **學生名冊 / 課表快取**：`data/s1.json`、`data/s2.json`、`data/s3.json`（gitignored，
   本機自行放置——格式見 `src/lib/data.ts` 的 `StudentMap`）。`data/class/s<grade>/latest.json`
   由排程自動抓取產生，不必手動準備；訂閱連結資料庫（`data/calendar.db`，SQLite）
   會在第一次存取時自動建立。
3. **HTTPS 憑證**（與 tpass-auth / tpass-portal 共用 mkcert，見上層 `docs/ONBOARDING.md`）。
4. **啟動**：
   ```bash
   pnpm dev   # https://schedule.lvh.me:3010（package.json 已設好 HTTPS + NODE_TLS_REJECT_UNAUTHORIZED=0）
   ```
5. **登入**：用學校 Google 帳號（`auth` 服務需同時在跑）。學號取自信箱 `@` 前的部分，
   須出現在 `data/s<grade>.json` 才查得到課表。

## 檢查

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

## 課表抓取與更新

`src/lib/scheduler.ts` 在服務啟動（`src/instrumentation.ts`）時立即抓取一次所有年級，
之後每天 18:00（UTC+8）自動重抓。單一 instance（`pm2` 設定見 ops repo的
`deploy/ecosystem.config.js`，`instances: 1`）——備份輪替與 latest.json 寫入不可多行程併發。

## ICS 訂閱

每位學生有一條固定不變的訂閱連結（`/api/getuuid` 取得），輸出符合 RFC 5545 的 iCalendar
（`GET /<uuid>`），可加入 Google Calendar 或其他行事曆 App。⚠️ 這種訂閱式日曆**無法被
Google Calendar 的「尋找時間」查到**（不參與 free/busy），只適合個人自己看，這正是
Google Calendar 雙向同步要解決的限制。
