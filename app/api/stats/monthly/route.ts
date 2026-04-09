import { NextRequest, NextResponse } from 'next/server'
import { query, getDevUserId } from '@/lib/db'

// GET /api/stats/monthly?months=6
// Returns last N months of total + per-category spend
export async function GET(req: NextRequest) {
  try {
    const userId = getDevUserId()
    const months = Math.min(Number(new URL(req.url).searchParams.get('months') ?? 6), 24)

    // Total per month
    const totals = await query<{ month: string; total: string }>(
      `SELECT
         to_char(expense_date, 'YYYY-MM') AS month,
         SUM(amount)::text               AS total
       FROM expenses
       WHERE user_id = $1
         AND expense_date >= date_trunc('month', NOW()) - ($2 - 1) * INTERVAL '1 month'
       GROUP BY month
       ORDER BY month ASC`,
      [userId, months],
    )

    // Per category per month
    const byCat = await query<{ month: string; category: string; total: string }>(
      `SELECT
         to_char(expense_date, 'YYYY-MM') AS month,
         category,
         SUM(amount)::text               AS total
       FROM expenses
       WHERE user_id = $1
         AND expense_date >= date_trunc('month', NOW()) - ($2 - 1) * INTERVAL '1 month'
       GROUP BY month, category
       ORDER BY month ASC`,
      [userId, months],
    )

    // Merge into shape: { month, total, by_category }
    const map: Record<string, { month: string; total: number; by_category: Record<string, number> }> = {}

    for (const row of totals) {
      map[row.month] = {
        month: row.month,
        total: parseFloat(row.total),
        by_category: {},
      }
    }
    for (const row of byCat) {
      if (map[row.month]) {
        map[row.month].by_category[row.category] = parseFloat(row.total)
      }
    }

    return NextResponse.json(Object.values(map))
  } catch (err) {
    console.error('[GET /api/stats/monthly]', err)
    return NextResponse.json({ error: '統計失敗' }, { status: 500 })
  }
}
