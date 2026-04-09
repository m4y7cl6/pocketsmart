#!/usr/bin/env bash
# PocketSmart — Docker 啟動腳本
# 使用方式：chmod +x setup.sh && ./setup.sh
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔══════════════════════════════════════╗"
echo "║   🚀  PocketSmart Docker 啟動程序    ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. 確認 Docker 有在跑 ─────────────────────────────────
echo -e "${YELLOW}[1/4] 檢查 Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker 未啟動，請先開啟 Docker Desktop${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker 正在運行${NC}"

# ── 2. 確認 .env.local 已填入真實 API Key ────────────────
echo -e "\n${YELLOW}[2/4] 檢查環境變數...${NC}"
if [ ! -f .env.local ]; then
  echo -e "${RED}❌ 找不到 .env.local${NC}"
  exit 1
fi
if grep -q "sk-ant-your-key-here" .env.local; then
  echo -e "${RED}❌ 請先編輯 .env.local，把 ANTHROPIC_API_KEY 換成你的真實 Key${NC}"
  echo -e "   取得 Key：${CYAN}https://console.anthropic.com/${NC}"
  exit 1
fi
echo -e "${GREEN}✓ .env.local 已設定${NC}"

# ── 3. Build + 啟動所有服務 ───────────────────────────────
echo -e "\n${YELLOW}[3/4] Build Docker 映像檔並啟動服務...${NC}"
echo -e "   （首次 build 約需 2-3 分鐘，請稍候）\n"

docker-compose up -d --build

# ── 4. 等待 App 就緒 ──────────────────────────────────────
echo -e "\n${YELLOW}[4/4] 等待服務就緒...${NC}"

echo -n "   PostgreSQL"
for i in $(seq 1 20); do
  sleep 1
  echo -n "."
  if docker-compose exec -T postgres pg_isready -U pocketsmart_user -q 2>/dev/null; then
    echo -e " ${GREEN}✓${NC}"
    break
  fi
done

echo -n "   Next.js App"
for i in $(seq 1 30); do
  sleep 2
  echo -n "."
  if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo -e " ${GREEN}✓${NC}"
    break
  fi
done

# ── 完成 ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  啟動成功！                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "   瀏覽器開啟：${CYAN}http://localhost:3000${NC}"
echo ""
echo -e "   常用指令："
echo -e "   ${CYAN}docker-compose logs -f app${NC}      # 查看 App 日誌"
echo -e "   ${CYAN}docker-compose logs -f postgres${NC} # 查看 DB 日誌"
echo -e "   ${CYAN}docker-compose down${NC}             # 停止所有服務"
echo -e "   ${CYAN}docker-compose down -v${NC}          # 停止並清除資料庫"
echo ""