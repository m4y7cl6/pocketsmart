import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'
import { query, queryOne } from '@/lib/db'
import type { Category } from '@/lib/types'

// ── 驗證 Line 簽名 ────────────────────────────────────────
function validateSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET!
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64')
  return hash === signature
}

// ── 取得或建立 Line 用戶 ──────────────────────────────────
async function getOrCreateUser(lineUserId: string): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [`line:${lineUserId}`]
  )
  if (existing) {
	  await query(
		`UPDATE users SET line_user_id = $1 WHERE id = $2 AND line_user_id IS NULL`,
		[lineUserId, existing.id]
	  )
  return existing.id
  }

  const created = await queryOne<{ id: string }>(
    `INSERT INTO users (email, name, line_user_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [`line:${lineUserId}`, 'Line用戶', lineUserId]
  )
  return created!.id
}
// ── Line 推播（主動推送）────────────────────────────────
async function sendLineMessage(lineUserId: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    }),
  })
}

// ── 檢查預算並發通知 ──────────────────────────────────────
async function checkBudgetAndNotify(userId: string, lineUserId: string, month: string) {
  const totalRow = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total
     FROM expenses
     WHERE user_id = $1 AND to_char(expense_date, 'YYYY-MM') = $2`,
    [userId, month]
  )

  const budgetRow = await queryOne<{ amount: string }>(
    `SELECT amount FROM budgets WHERE user_id = $1 AND month = $2`,
    [userId, month]
  )

  if (!budgetRow || !totalRow) return

  const total = parseFloat(totalRow.total)
  const budget = parseFloat(budgetRow.amount)
  const ratio = total / budget

  if (ratio >= 1) {
    await sendLineMessage(lineUserId,
      `🚨 本月預算已超支！\n\n` +
      `預算：NT$${budget.toLocaleString()}\n` +
      `已花費：NT$${total.toLocaleString()}\n` +
      `超出：NT$${(total - budget).toLocaleString()}`
    )
  } else if (ratio >= 0.8) {
    await sendLineMessage(lineUserId,
      `⚠️ 本月預算已使用 ${Math.round(ratio * 100)}%\n\n` +
      `預算：NT$${budget.toLocaleString()}\n` +
      `已花費：NT$${total.toLocaleString()}\n` +
      `剩餘：NT$${(budget - total).toLocaleString()}`
    )
  }
}

// ── 呼叫 Groq 解析 ────────────────────────────────────────
async function classifyExpense(input: string) {
  const today = new Date().toISOString().split('T')[0]

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 256,
      messages: [
        {
          role: 'system',
          content: `你是記帳助理，從用戶輸入提取記帳資訊，只回傳JSON不要其他文字。
格式：{"amount":150,"category":"餐飲","description":"午餐便當","expense_date":"2024-01-15"}
category只能是：餐飲、交通、購物、娛樂、醫療、住宿、教育、訂閱、其他`
        },
        {
          role: 'user',
          content: `今天日期：${today}\n用戶輸入：${input}`
        }
      ]
    })
  })

  const data = await res.json()
  const text = data.choices[0].message.content.replace(/```json|```/g, '').trim()
  return JSON.parse(text)
}

// ── 傳送 Line 回覆訊息 ────────────────────────────────────
async function replyMessage(replyToken: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

// ── 查詢本月花費 ──────────────────────────────────────────
async function getMonthlyTotal(userId: string): Promise<string> {
  const month = new Date().toISOString().slice(0, 7)
  const rows = await query<{ category: string; total: string }>(
    `SELECT category, SUM(amount)::text AS total
     FROM expenses
     WHERE user_id = $1
       AND to_char(expense_date, 'YYYY-MM') = $2
     GROUP BY category
     ORDER BY SUM(amount) DESC`,
    [userId, month]
  )

  if (!rows.length) return '本月尚無記錄'

  const grandTotal = rows.reduce((s, r) => s + parseFloat(r.total), 0)
  const lines = rows.map(r => `${r.category}：NT$${parseFloat(r.total).toLocaleString()}`)
  return `📊 本月花費統計\n${'─'.repeat(16)}\n${lines.join('\n')}\n${'─'.repeat(16)}\n💰 總計：NT$${grandTotal.toLocaleString()}`
}

// ── 查詢訂閱列表 ──────────────────────────────────────────
async function getSubscriptions(userId: string): Promise<string> {
  const rows = await query<{ name: string; amount: string; next_billing: string }>(
    `SELECT name, amount::text, next_billing::text
     FROM subscriptions
     WHERE user_id = $1 AND is_active = true
     ORDER BY next_billing ASC`,
    [userId]
  )

  if (!rows.length) return '目前沒有訂閱項目'

  const lines = rows.map(r => {
    const days = Math.ceil((new Date(r.next_billing).getTime() - Date.now()) / 86_400_000)
    const daysText = days <= 0 ? '今日扣款' : `${days} 天後`
    return `${r.name}：NT$${parseFloat(r.amount).toLocaleString()}（${daysText}）`
  })

  const monthTotal = rows.reduce((s, r) => s + parseFloat(r.amount), 0)
  return `📱 訂閱管理\n${'─'.repeat(16)}\n${lines.join('\n')}\n${'─'.repeat(16)}\n月訂閱總額：NT$${monthTotal.toLocaleString()}`
}

// ── 查詢最近 10 筆記錄 ────────────────────────────────────
async function getRecentExpenses(userId: string): Promise<string> {
  const rows = await query<{ id: string; description: string; amount: string; category: string; expense_date: string }>(
    `SELECT id, description, amount::text, category, expense_date::text
     FROM expenses
     WHERE user_id = $1
     UNION ALL
     SELECT id, name AS description, amount::text, '訂閱' AS category, next_billing::text AS expense_date
     FROM subscriptions
     WHERE user_id = $1 AND is_active = true
     ORDER BY expense_date DESC
     LIMIT 10`,
    [userId]
  )

  if (!rows.length) return '尚無記錄'

  const lines = rows.map((r, i) =>
    `${i + 1}. ${r.description} NT$${parseFloat(r.amount).toLocaleString()} [${r.category}] ${r.expense_date.slice(5)}`
  )

  return `📋 最近 10 筆記錄\n${'─'.repeat(16)}\n${lines.join('\n')}\n${'─'.repeat(16)}\n輸入「刪除 1」可刪除第 1 筆`
}

// ── 刪除第 N 筆記錄 ───────────────────────────────────────
async function deleteExpenseByIndex(userId: string, index: number): Promise<string> {
  const rows = await query<{ id: string; description: string; amount: string; source: string }>(
    `SELECT id, description, amount::text, 'expense' AS source
     FROM expenses
     WHERE user_id = $1
     UNION ALL
     SELECT id, name AS description, amount::text, 'subscription' AS source
     FROM subscriptions
     WHERE user_id = $1 AND is_active = true
     ORDER BY source
     LIMIT 10`,
    [userId]
  )

  const target = rows[index - 1]
  if (!target) return `❌ 找不到第 ${index} 筆，請先輸入「紀錄」查看清單`

  if (target.source === 'expense') {
    await query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`, [target.id, userId])
  } else {
    await query(`DELETE FROM subscriptions WHERE id = $1 AND user_id = $2`, [target.id, userId])
  }

  return `🗑️ 已刪除：${target.description} NT$${parseFloat(target.amount).toLocaleString()}`
}

// ── 指令說明 ──────────────────────────────────────────────
const HELP_TEXT = `💰 PocketSmart 記帳機器人

📝 記帳（直接輸入）：
  午餐便當 150
  昨天買衣服 2500
  Netflix 訂閱 199

📊 查詢指令：
  查詢 或 本月 → 本月花費統計
  記錄 或 紀錄 → 最近 10 筆明細
  訂閱 → 訂閱列表
  預算 → 本月預算狀況
  設定預算 10000 → 設定本月預算
  刪除 1 → 刪除第 1 筆記錄
  說明 或 help → 顯示此說明`

// ── 主要 Webhook Handler ──────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!validateSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const events = body.events ?? []

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue

    const replyToken = event.replyToken
    const userInput = event.message.text.trim()
    const lineUserId = event.source.userId
    const userId = await getOrCreateUser(lineUserId)

    try {

      // ── 查詢本月花費 ──
      if (['查詢', '本月', '統計'].includes(userInput)) {
        const result = await getMonthlyTotal(userId)
        await replyMessage(replyToken, result)
        continue
      }

      // ── 訂閱列表 ──
      if (['訂閱', '訂閱管理'].includes(userInput)) {
        const result = await getSubscriptions(userId)
        await replyMessage(replyToken, result)
        continue
      }

      // ── 最近記錄 ──
      if (['記錄', '紀錄', '最近', '明細'].includes(userInput)) {
        const result = await getRecentExpenses(userId)
        await replyMessage(replyToken, result)
        continue
      }

      // ── 刪除 N ──
      const deleteMatch = userInput.match(/^刪除\s*(\d+)$/)
      if (deleteMatch) {
        const index = parseInt(deleteMatch[1])
        const result = await deleteExpenseByIndex(userId, index)
        await replyMessage(replyToken, result)
        continue
      }

      // ── 查詢預算 ──
      if (['預算', '本月預算'].includes(userInput)) {
        const month = new Date().toISOString().slice(0, 7)
        const budgetRow = await queryOne<{ amount: string }>(
          `SELECT amount FROM budgets WHERE user_id = $1 AND month = $2`,
          [userId, month]
        )
        const totalRow = await queryOne<{ total: string }>(
          `SELECT COALESCE(SUM(amount), 0)::text AS total
           FROM expenses WHERE user_id = $1 AND to_char(expense_date, 'YYYY-MM') = $2`,
          [userId, month]
        )

        if (!budgetRow) {
          await replyMessage(replyToken, '尚未設定本月預算\n\n輸入「設定預算 10000」來設定')
        } else {
          const budget = parseFloat(budgetRow.amount)
          const total = parseFloat(totalRow?.total ?? '0')
          const ratio = Math.round(total / budget * 100)
          const remaining = budget - total

          await replyMessage(replyToken,
            `💰 本月預算狀況\n${'─'.repeat(16)}\n` +
            `預算：NT$${budget.toLocaleString()}\n` +
            `已花費：NT$${total.toLocaleString()}（${ratio}%）\n` +
            `剩餘：NT$${remaining.toLocaleString()}\n${'─'.repeat(16)}\n` +
            (ratio >= 100 ? '🚨 已超支！' : ratio >= 80 ? '⚠️ 快超支了！' : '✅ 預算充足')
          )
        }
        continue
      }

      // ── 設定預算 ──
      const budgetMatch = userInput.match(/^設定預算\s*(\d+)$/)
      if (budgetMatch) {
        const amount = parseInt(budgetMatch[1])
        const month = new Date().toISOString().slice(0, 7)

        await queryOne(
          `INSERT INTO budgets (user_id, month, amount)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, month)
           DO UPDATE SET amount = EXCLUDED.amount`,
          [userId, month, amount]
        )

        await replyMessage(replyToken,
          `✅ 本月預算設定完成\n\n💰 NT$${amount.toLocaleString()}`
        )
        continue
      }

      // ── 說明 ──
      if (['說明', 'help', '幫助', '?', '？'].includes(userInput.toLowerCase())) {
        await replyMessage(replyToken, HELP_TEXT)
        continue
      }

      // ── 記帳（包含數字就嘗試解析）──
      if (/\d/.test(userInput)) {
        const parsed = await classifyExpense(userInput)

        if (!parsed.amount || parsed.amount <= 0) {
          await replyMessage(replyToken, '❌ 無法識別金額，請確認輸入包含數字\n例：午餐 150')
          continue
        }

        await queryOne(
          `INSERT INTO expenses (user_id, amount, category, description, raw_input, expense_date)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            parsed.amount,
            parsed.category as Category,
            parsed.description,
            userInput,
            parsed.expense_date,
          ]
        )

        // 如果是訂閱，同時存到 subscriptions
        if (parsed.category === '訂閱') {
          await queryOne(
            `INSERT INTO subscriptions (user_id, name, amount, billing_cycle, next_billing)
             VALUES ($1, $2, $3, 'monthly', CURRENT_DATE + INTERVAL '30 days')
             ON CONFLICT DO NOTHING`,
            [userId, parsed.description, parsed.amount]
          )
        }

        await replyMessage(
          replyToken,
          `✅ 記帳成功！\n\n📝 ${parsed.description}\n💰 NT$${parsed.amount.toLocaleString()}\n🏷️ ${parsed.category}\n📅 ${parsed.expense_date}`
        )
		await checkBudgetAndNotify(userId, lineUserId, parsed.expense_date.slice(0, 7))
		
        continue
      }

      // ── 看不懂的輸入 ──
      await replyMessage(replyToken, `不太懂你的意思 😅\n\n輸入「說明」查看使用方式`)

    } catch (err) {
      console.error('[line webhook] error:', err)
      await replyMessage(replyToken, '❌ 系統錯誤，請稍後再試')
    }
  }

  return NextResponse.json({ ok: true })
}