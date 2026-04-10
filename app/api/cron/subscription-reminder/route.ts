import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// 驗證是否來自合法的 Cron 呼叫
function validateCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret')
  return secret === process.env.CRON_SECRET
}

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

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 查詢 3 天內到期的訂閱，同時撈 line_user_id
    const rows = await query<{
      name: string
      amount: string
      next_billing: string
      line_user_id: string
    }>(
      `SELECT s.name, s.amount::text, s.next_billing::text, u.line_user_id
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       WHERE s.is_active = true
         AND u.line_user_id IS NOT NULL
         AND s.next_billing BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'`
    )

    if (!rows.length) {
      return NextResponse.json({ message: '沒有即將到期的訂閱', count: 0 })
    }

    // 依 line_user_id 分組，一個用戶可能有多筆訂閱
    const grouped: Record<string, typeof rows> = {}
    for (const row of rows) {
      if (!grouped[row.line_user_id]) grouped[row.line_user_id] = []
      grouped[row.line_user_id].push(row)
    }

    // 逐一發送通知
    for (const [lineUserId, subs] of Object.entries(grouped)) {
      const lines = subs.map(s => {
        const days = Math.ceil(
          (new Date(s.next_billing).getTime() - Date.now()) / 86_400_000
        )
        const daysText = days <= 0 ? '今日扣款' : `${days} 天後扣款`
        return `${s.name}：NT$${parseFloat(s.amount).toLocaleString()}（${daysText}）`
      })

      const total = subs.reduce((sum, s) => sum + parseFloat(s.amount), 0)

      await sendLineMessage(lineUserId,
        `🔔 訂閱即將扣款提醒\n${'─'.repeat(16)}\n` +
        `${lines.join('\n')}\n` +
        `${'─'.repeat(16)}\n` +
        `合計：NT$${total.toLocaleString()}\n\n` +
        `記得確認帳戶餘額是否充足！`
      )
    }

    return NextResponse.json({ message: '通知發送完成', count: rows.length })
  } catch (err) {
    console.error('[cron subscription-reminder]', err)
    return NextResponse.json({ error: '執行失敗' }, { status: 500 })
  }
}