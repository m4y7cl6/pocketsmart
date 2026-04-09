import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, getDevUserId } from '@/lib/db'
import type { Subscription } from '@/lib/types'

export async function GET() {
  try {
    const userId = getDevUserId()
    const rows = await query<Subscription>(
      `SELECT * FROM subscriptions
       WHERE user_id = $1
       ORDER BY next_billing ASC`,
      [userId],
    )
    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/subscriptions]', err)
    return NextResponse.json({ error: '讀取失敗' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getDevUserId()
    const { name, amount, billing_cycle, next_billing } = await req.json()

    if (!name || !amount || !next_billing) {
      return NextResponse.json({ error: '缺少必填欄位' }, { status: 400 })
    }

    const row = await queryOne<Subscription>(
      `INSERT INTO subscriptions (user_id, name, amount, billing_cycle, next_billing)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, name, amount, billing_cycle ?? 'monthly', next_billing],
    )
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    console.error('[POST /api/subscriptions]', err)
    return NextResponse.json({ error: '新增失敗' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = getDevUserId()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

    await query(
      'DELETE FROM subscriptions WHERE id = $1 AND user_id = $2',
      [id, userId],
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/subscriptions]', err)
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  }
}
