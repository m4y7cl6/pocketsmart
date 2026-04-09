'use client'

import { useState } from 'react'
import type { Expense } from '@/lib/types'

interface Props {
  expenses: Expense[]
  onDelete: (id: string) => void
}

const CATEGORY_EMOJI: Record<string, string> = {
  餐飲: '🍱', 交通: '🚌', 購物: '🛍️', 娛樂: '🎮', 醫療: '💊',
  住宿: '🏠', 教育: '📚', 訂閱: '📱', 其他: '📌',
}

const CATEGORY_COLOR: Record<string, string> = {
  餐飲: 'bg-orange-100 text-orange-700',
  交通: 'bg-blue-100 text-blue-700',
  購物: 'bg-pink-100 text-pink-700',
  娛樂: 'bg-purple-100 text-purple-700',
  醫療: 'bg-red-100 text-red-700',
  住宿: 'bg-indigo-100 text-indigo-700',
  教育: 'bg-yellow-100 text-yellow-700',
  訂閱: 'bg-teal-100 text-teal-700',
  其他: 'bg-gray-100 text-gray-600',
}

export default function ExpenseList({ expenses, onDelete }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('確定刪除這筆記錄？')) return
    setDeletingId(id)
    try {
      await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' })
      onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-sm">本月尚無記錄，用上方輸入框新增第一筆！</p>
      </div>
    )
  }

  // Group by date
  const grouped = expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    const d = e.expense_date.slice(0, 10)
    ;(acc[d] ??= []).push(e)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, items]) => {
        const dayTotal = items.reduce((s, e) => s + Number(e.amount), 0)
        return (
          <div key={date}>
            {/* Date header */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {new Date(date + 'T00:00:00').toLocaleDateString('zh-TW', {
                  month: 'short', day: 'numeric', weekday: 'short',
                })}
              </span>
              <span className="text-xs text-gray-400">
                小計 NT${dayTotal.toLocaleString()}
              </span>
            </div>

            {/* Items */}
            <div className="space-y-2">
              {items.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 bg-white rounded-xl border border-gray-100
                             px-4 py-3 hover:shadow-sm transition group"
                >
                  <span className="text-xl">{CATEGORY_EMOJI[e.category] ?? '📌'}</span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                    {e.note && (
                      <p className="text-xs text-gray-400 truncate">{e.note}</p>
                    )}
                  </div>

                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLOR[e.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {e.category}
                  </span>

                  <span className="text-sm font-semibold text-gray-900 shrink-0 w-20 text-right">
                    NT${Number(e.amount).toLocaleString()}
                  </span>

                  <button
                    onClick={() => handleDelete(e.id)}
                    disabled={deletingId === e.id}
                    className="opacity-0 group-hover:opacity-100 ml-1 text-gray-300 hover:text-red-400
                               transition text-lg leading-none disabled:opacity-50"
                    title="刪除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
