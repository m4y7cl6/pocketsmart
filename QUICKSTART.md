# PocketSmart — 快速啟動

## 前置需求
- Node.js 20+
- Docker Desktop（已啟動）
- Anthropic API Key（[取得免費額度](https://console.anthropic.com/)）

---

## 本地開發（推薦）

```bash
# 1. 填入你的 API Key
vim .env.local        # 把 sk-ant-your-key-here 換成真實 Key

# 2. 一鍵啟動
chmod +x setup.sh && ./setup.sh

# 訪問 http://localhost:3000
```

或分步執行：

```bash
npm install
docker-compose up -d postgres   # 只啟動 DB
npm run dev                     # Next.js dev server（含 hot reload）
```

---

## Docker 完整打包（生產用）

```bash
# 確認 .env.local 已填好後執行
docker-compose up -d --build

# 查看日誌
docker-compose logs -f app
docker-compose logs -f postgres
```

> **注意**：`docker-compose up --build` 會同時啟動 PostgreSQL + Next.js App，
> App 容器等 DB healthy 後才啟動（見 `depends_on`）。

---

## 常見問題

### `Cannot connect to database`
```bash
docker-compose ps            # 確認 postgres 是 healthy
docker-compose logs postgres # 看詳細錯誤
```

### `ANTHROPIC_API_KEY is not set`
```bash
cat .env.local | grep ANTHROPIC   # 確認 Key 存在
# Docker 模式需要在 .env.local 設好，compose 會自動讀取
```

### NLP 解析回傳 amount: 0
- 輸入需包含數字金額，例如「午餐 150」而非「午餐花了一百五」
- 繁體數字目前不支援，請用阿拉伯數字

### Docker build 失敗（`standalone` 相關）
確認 `next.config.js` 有 `output: 'standalone'`，這是 Dockerfile 多階段 build 的必要設定。

---

## 目錄結構

```
pocketsmart/
├── Dockerfile                   # 多階段 build：deps → builder → runner
├── docker-compose.yml           # postgres + app 兩個 service
├── init.sql                     # DB schema + seed 資料（首次啟動自動執行）
├── next.config.js               # output: standalone（Docker 必要）
├── .env.local                   # 環境變數（勿 commit）
│
├── lib/
│   ├── db.ts                    # pg Pool + query/queryOne helpers
│   └── types.ts                 # 共用 TypeScript 型別
│
└── app/
    ├── page.tsx                 # redirect → /dashboard
    ├── layout.tsx
    ├── api/
    │   ├── expenses/
    │   │   ├── route.ts         # GET / POST / DELETE
    │   │   └── classify/        # POST → Claude NLP 解析
    │   ├── stats/monthly/       # GET → 月度彙總
    │   └── subscriptions/       # GET / POST / DELETE
    ├── components/
    │   ├── ExpenseForm.tsx      # 自然語言輸入 → 解析預覽 → 確認儲存
    │   ├── ExpenseList.tsx      # 按日期分組列表
    │   └── MonthlyChart.tsx     # Recharts 長條圖
    └── (authenticated)/
        └── dashboard/page.tsx   # 主頁面
```

---

## 常用指令

```bash
# 停止所有服務
docker-compose down

# 清除 DB 資料重來
docker-compose down -v && docker-compose up -d

# 進入 DB 查看資料
docker exec -it pocketsmart-db psql -U pocketsmart_user -d pocketsmart
\dt                    -- 列出所有資料表
SELECT * FROM expenses LIMIT 10;

# 備份資料
docker exec pocketsmart-db pg_dump -U pocketsmart_user pocketsmart > backup.sql
```
