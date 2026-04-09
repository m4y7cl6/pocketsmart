'use client'

import { useState, useRef } from 'react'
import type { ClassifyResult } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'

interface Props {
  onSuccess: () => void
}

export default function ExpenseForm({ onSuccess }: Props) {
  const [input, setInput]         = useState('')
  const [parsed, setParsed]       = useState<ClassifyResult | null>(null)
  const [parsing, setParsing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const inputRef                  = useRef<HTMLInputElement>(null)

  // Step 1: send to Claude for NLP parse
  async function handleParse() {
    if (!input.trim()) return
    setParsing(true)
    setError('')
    setParsed(null)

    try {
      const res = await fetch('/api/expenses/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '解析失敗')
      if (!data.amount || data.amount <= 0) throw new Error('無法識別金額，請確認輸入')
      setParsed(data)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  // Step 2: save confirmed expense to DB
  async function handleSave() {
    if (!parsed) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed, raw_input: input }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '儲存失敗')
      setInput('')
      setParsed(null)
      onSuccess()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      parsed ? handleSave() : handleParse()
    }
    if (e.key === 'Escape') {
      setParsed(null)
      setError('')
    }
  }

  const CATEGORY_EMOJI: Record<string, string> = {
    餐飲: '🍱', 交通: '🚌', 購物: '🛍️', 娛樂: '🎮', 醫療: '💊',
    住宿: '🏠', 教育: '📚', 訂閱: '📱', 其他: '📌',
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">快速記帳</h2>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='例：午餐便當 150，或「昨天喝了咖啡 80」'
          disabled={parsing || saving}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-emerald-400
                     disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          onClick={parsed ? handleSave : handleParse}
          disabled={!input.trim() || parsing || saving}
          className="px-5 py-3 rounded-xl bg-emerald-500 text-white text-sm font-medium
                     hover:bg-emerald-600 active:scale-95 transition
                     disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {parsing ? '解析中…' : saving ? '儲存中…' : parsed ? '✓ 確認記帳' : '解析'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Parsed preview — editable */}
      {parsed && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
          <p className="text-xs text-emerald-700 font-medium">✓ 解析結果（可修改後確認）</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Amount */}
            <label className="space-y-1">
              <span className="text-xs text-gray-500">金額</span>
              <input
                type="number"
                value={parsed.amount}
                onChange={(e) => setParsed({ ...parsed, amount: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </label>

            {/* Category */}
            <label className="space-y-1">
              <span className="text-xs text-gray-500">分類</span>
              <select
                value={parsed.category}
                onChange={(e) => setParsed({ ...parsed, category: e.target.value as ClassifyResult['category'] })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>
                ))}
              </select>
            </label>

            {/* Description */}
            <label className="space-y-1">
              <span className="text-xs text-gray-500">說明</span>
              <input
                type="text"
                value={parsed.description}
                onChange={(e) => setParsed({ ...parsed, description: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </label>

            {/* Date */}
            <label className="space-y-1">
              <span className="text-xs text-gray-500">日期</span>
              <input
                type="date"
                value={parsed.expense_date}
                onChange={(e) => setParsed({ ...parsed, expense_date: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium
                         hover:bg-emerald-600 active:scale-95 transition disabled:opacity-40"
            >
              {saving ? '儲存中…' : '✓ 確認記帳'}
            </button>
            <button
              onClick={() => { setParsed(null); setError('') }}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        按 Enter 快速解析 · 確認後再次 Enter 儲存 · Esc 取消
      </p>
    </div>
  )
}
