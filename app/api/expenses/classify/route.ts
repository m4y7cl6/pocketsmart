// app/api/expenses/classify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type { ClassifyResult, Category } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json()
    const today = new Date().toISOString().split('T')[0]

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',  // 免費模型
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
    const result = JSON.parse(text) as ClassifyResult

    const ALLOWED: Category[] = ['餐飲','交通','購物','娛樂','醫療','住宿','教育','訂閱','其他']
    if (!ALLOWED.includes(result.category)) result.category = '其他'

    return NextResponse.json(result)
  } catch (err) {
    console.error('[classify] error:', err)
    return NextResponse.json({ error: '解析失敗，請手動輸入' }, { status: 500 })
  }
}