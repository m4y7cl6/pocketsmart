import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, getDevUserId } from '@/lib/db'
import type { Expense } from '@/lib/types'

// GET /api/expenses?month=2024-01&limit=50
export async function GET(req: NextRequest) {
  try {
    const userId = getDevUserId()
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')   // e.g. "2024-01"
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

// POST /api/expenses  — create a new expense
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

    await query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
      [id, userId],
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/expenses]', err)
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  }
}
