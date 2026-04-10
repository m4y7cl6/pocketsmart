'use client'

import { useEffect, useState, useCallback } from 'react'
import ExpenseForm from '@/app/components/ExpenseForm'
import ExpenseList from '@/app/components/ExpenseList'
import MonthlyChart from '@/app/components/MonthlyChart'
import type { Expense, MonthlyStats, Subscription } from '@/lib/types'

// Format YYYY-MM for display
function formatMonth(ym: string) {
  const [y, m] = ym.split('-')
  return `${y} 年 ${Number(m)} 月`
}

export default function DashboardPage() {
  const today      = new Date()
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const [month, setMonth]               = useState(defaultMonth)
  const [expenses, setExpenses]         = useState<Expense[]>([])
  const [stats, setStats]               = useState<MonthlyStats[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading]           = useState(true)

  const loadExpenses = useCallback(async () => {
    const res = await fetch(`/api/expenses?month=${month}`)
    const data = await res.json()
    setExpenses(Array.isArray(data) ? data : [])
  }, [month])

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/stats/monthly?months=6')
    const data = await res.json()
    setStats(Array.isArray(data) ? data : [])
  }, [])

  const loadSubscriptions = useCallback(async () => {
    const res = await fetch('/api/subscriptions')
    if (res.ok) {
      const data = await res.json()
      setSubscriptions(Array.isArray(data) ? data : [])
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadExpenses(), loadStats(), loadSubscriptions()])
      .finally(() => setLoading(false))
  }, [loadExpenses, loadStats, loadSubscriptions])

  function handleDelete(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    loadStats()
	loadSubscriptions()
  }

  function handleSuccess() {
    loadExpenses()
    loadStats()
	loadSubscriptions()
  }

  const monthTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const upcomingSubs = subscriptions
    .filter((s) => s.is_active)
    .sort((a, b) => a.next_billing.localeCompare(b.next_billing))
    .slice(0, 5)

  // Month navigation
  function changeMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <span className="font-bold text-gray-900">PocketSmart</span>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
            Dev Mode
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Quick-entry form */}
        <ExpenseForm onSuccess={handleSuccess} />

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 col-span-2">
            <p className="text-xs text-gray-400 mb-1">本月支出</p>
            <p className="text-3xl font-bold text-gray-900">
              NT${monthTotal.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">{formatMonth(month)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col justify-center">
            <p className="text-xs text-gray-400 mb-1">筆數</p>
            <p className="text-3xl font-bold text-gray-900">{expenses.length}</p>
            <p className="text-xs text-gray-400 mt-1">筆記錄</p>
          </div>
        </div>

        {/* Trend chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            近 6 個月趨勢
          </h3>
          <MonthlyChart stats={stats} />
        </div>

        {/* Subscriptions */}
        {upcomingSubs.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              📱 即將扣款訂閱
            </h3>
            <div className="space-y-2">
              {upcomingSubs.map((s) => {
                const daysLeft = Math.ceil(
                  (new Date(s.next_billing).getTime() - Date.now()) / 86_400_000,
                )
                return (
                  <div key={s.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {daysLeft <= 0 ? '今日扣款' : `${daysLeft} 天後扣款`}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${daysLeft <= 3 ? 'text-red-500' : 'text-gray-700'}`}>
                      NT${Number(s.amount).toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Expense list with month nav */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              明細記錄
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400
                           hover:bg-gray-50 flex items-center justify-center text-sm"
              >‹</button>
              <span className="text-xs text-gray-600 w-20 text-center">{formatMonth(month)}</span>
              <button
                onClick={() => changeMonth(1)}
                disabled={month >= defaultMonth}
                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400
                           hover:bg-gray-50 flex items-center justify-center text-sm
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >›</button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">載入中…</div>
          ) : (
            <ExpenseList expenses={expenses} onDelete={handleDelete} />
          )}
        </div>

      </main>
    </div>
  )
}
