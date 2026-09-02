<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# tpass-schedule（T-Schedule 課表）

每日抓各年級課表 API → 算個人課表 → ICS 訂閱 + Google Calendar 同步。SSO 消費端（id `schedule`），
**尚未上線**（註冊表 `deployed:false`）。生態系總覽、`services.json` 與 `tpass` CLI 見上層 **tpass-ops** repo（`AGENTS.md`、`docs/`）。

## 鐵律

- 本機跑 `pnpm dev`（已設好 HTTPS + `schedule.lvh.me:3010` + `NODE_TLS_REJECT_UNAUTHORIZED=0`）。檢查用 `pnpm lint` + `pnpm exec tsc --noEmit`。
- SSO 驗章在套件 `tpass-auth-js`，本 repo 只在 `src/config/auth.ts` 綁 env、callback / logout 兩條 route 各一行；不要手抄驗章。
- **Google Calendar OAuth 是全生態唯一例外**：一般消費端不碰 OAuth，這裡為了寫學生自己的日曆才拿 `calendar.events` scope。refresh token 以 AES-256-GCM 加密（`src/lib/crypto.ts`，金鑰 `CALENDAR_TOKEN_KEY`）落地到 `CalendarGrant`；只用 `privateExtendedProperty=tschedule=1` 查自己寫的事件，永不列舉其他事件。界線見 `src/config/calendar.ts` 開頭，不要擴大。
- 每日排程在 `src/lib/scheduler.ts`（`src/instrumentation.ts` 啟動）：抓課表 → diff → 把受影響且已連結的學生排入同步佇列。單一 instance（pm2 `instances:1`），排程、latest.json 寫入、佇列 worker 都不可多行程併發。
- `data/*.json` 是狀態（學生名冊 `data/s<grade>.json` 手放、`data/class/s<grade>/latest.json` 排程產生），gitignored，runtime 讀檔。
- 資料庫：Prisma（`prisma/schema.prisma`），schema 改動走 `prisma migrate dev`。⚠️ 目前釘 Prisma 6，2026-09-02 資料庫準則要求 Prisma 7，待升。
- UI import 自 `tpass-ui`，light-only Neobrutalism + OKLCH；不要手刻 primitives。
