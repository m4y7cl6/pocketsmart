import { NextRequest, NextResponse } from 'next/server'
import { queryOne, getDevUserId } from '@/lib/db'

// GET /api/budgets?month=2024-01
export async function GET(req: NextRequest) {
  try {
    const userId = getDevUserId()
    const month = new URL(req.url).searchParams.get('month')
      ?? new Date().toISOString().slice(0, 7)

    const row = await queryOne<{ amount: string }>(
      `SELECT amount FROM budgets WHERE user_id = $1 AND month = $2`,
      [userId, month]
    )

    return NextResponse.json({ amount: row ? parseFloat(row.amount) : null })
  } catch (err) {
    console.error('[GET /api/budgets]', err)
    return NextResponse.json({ error: '讀取失敗' }, { status: 500 })
  }
}

// POST /api/budgets
export async function POST(req: NextRequest) {
  try {
    const userId = getDevUserId()
    const { amount, month } = await req.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '預算必須大於 0' }, { status: 400 })
    }

    const currentMonth = month ?? new Date().toISOString().slice(0, 7)

    const row = await queryOne(
      `INSERT INTO budgets (user_id, month, amount)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, month)
       DO UPDATE SET amount = EXCLUDED.amount
       RETURNING *`,
      [userId, currentMonth, amount]
    )

    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    console.error('[POST /api/budgets]', err)
    return NextResponse.json({ error: '設定失敗' }, { status: 500 })
  }
}