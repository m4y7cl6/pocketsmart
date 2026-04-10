import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, getDevUserId } from '@/lib/db'
import type { Expense } from '@/lib/types'

// ── Line 推播 ─────────────────────────────────────────────
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
async function checkBudgetAndNotify(userId: string, month: string) {
  // 查本月總花費
  const totalRow = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total
     FROM expenses
     WHERE user_id = $1 AND to_char(expense_date, 'YYYY-MM') = $2`,
    [userId, month]
  )

  // 查本月預算
  const budgetRow = await queryOne<{ amount: string }>(
    `SELECT amount FROM budgets WHERE user_id = $1 AND month = $2`,
    [userId, month]
  )

  if (!budgetRow || !totalRow) return

  const total = parseFloat(totalRow.total)
  const budget = parseFloat(budgetRow.amount)
  const ratio = total / budget

  // 只在 80% 和 100% 時通知，避免每筆都推
  if (ratio < 0.8) return

  // 查 Line user id
  const userRow = await queryOne<{ line_user_id: string }>(
    `SELECT line_user_id FROM users WHERE id = $1`,
    [userId]
  )
  if (!userRow?.line_user_id) return

  if (ratio >= 1) {
    await sendLineMessage(
      userRow.line_user_id,
      `🚨 本月預算已超支！\n\n` +
      `預算：NT$${budget.toLocaleString()}\n` +
      `已花費：NT$${total.toLocaleString()}\n` +
      `超出：NT$${(total - budget).toLocaleString()}`
    )
  } else if (ratio >= 0.8) {
    await sendLineMessage(
      userRow.line_user_id,
      `⚠️ 本月預算已使用 ${Math.round(ratio * 100)}%\n\n` +
      `預算：NT$${budget.toLocaleString()}\n` +
      `已花費：NT$${total.toLocaleString()}\n` +
      `剩餘：NT$${(budget - total).toLocaleString()}`
    )
  }
}

// GET /api/expenses?month=2024-01&limit=50
export async function GET(req: NextRequest) {
  try {
    const userId = getDevUserId()
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)

    let rows: Expense[]

    if (month) {
      rows = await query<Expense>(
        `SELECT * FROM expenses
         WHERE user_id = $1
           AND to_char(expense_date, 'YYYY-MM') = $2
         ORDER BY expense_date DESC, created_at DESC
         LIMIT $3`,
        [userId, month, limit],
      )
    } else {
      rows = await query<Expense>(
        `SELECT * FROM expenses
         WHERE user_id = $1
         ORDER BY expense_date DESC, created_at DESC
         LIMIT $2`,
        [userId, limit],
      )
    }

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/expenses]', err)
    return NextResponse.json({ error: '讀取失敗' }, { status: 500 })
  }
}

// POST /api/expenses
export async function POST(req: NextRequest) {
  try {
    const userId = getDevUserId()
    const body = await req.json()
    const { amount, category, description, note, raw_input, expense_date } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '金額必須大於 0' }, { status: 400 })
    }
    if (!description) {
      return NextResponse.json({ error: '請填寫說明' }, { status: 400 })
    }

    const row = await queryOne<Expense>(
      `INSERT INTO expenses (user_id, amount, category, description, note, raw_input, expense_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        amount,
        category ?? '其他',
        description,
        note ?? null,
        raw_input ?? null,
        expense_date ?? new Date().toISOString().split('T')[0],
      ],
    )

    // 如果是訂閱，同時存到 subscriptions
    if (category === '訂閱') {
      await queryOne(
        `INSERT INTO subscriptions (user_id, name, amount, billing_cycle, next_billing)
         VALUES ($1, $2, $3, 'monthly', CURRENT_DATE + INTERVAL '30 days')
         ON CONFLICT DO NOTHING`,
        [userId, description, amount],
      )
    }

    // 檢查預算並發 Line 通知
    const month = (expense_date ?? new Date().toISOString().split('T')[0]).slice(0, 7)
    await checkBudgetAndNotify(userId, month)

    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    console.error('[POST /api/expenses]', err)
    return NextResponse.json({ error: '新增失敗' }, { status: 500 })
  }
}

// DELETE /api/expenses?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const userId = getDevUserId()
    const id = new URL(req.url).searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 })
    }

    const expense = await queryOne<{ category: string; description: string }>(
      'SELECT category, description FROM expenses WHERE id = $1 AND user_id = $2',
      [id, userId],
    )

    await query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
      [id, userId],
    )

    if (expense?.category === '訂閱') {
      await query(
        `DELETE FROM subscriptions WHERE user_id = $1 AND name ILIKE $2`,
        [userId, `%${expense.description}%`],
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/expenses]', err)
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  }
}