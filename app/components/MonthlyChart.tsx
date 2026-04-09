'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { MonthlyStats } from '@/lib/types'

interface Props {
  stats: MonthlyStats[]
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white shadow-lg rounded-xl p-3 border border-gray-100 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      <p className="text-emerald-600 font-bold">
        總計 NT${Number(payload[0].value).toLocaleString()}
      </p>
      {payload[0].payload.by_category && (
        <div className="mt-2 space-y-0.5 text-xs text-gray-500">
          {Object.entries(payload[0].payload.by_category as Record<string, number>)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([cat, amt]) => (
              <div key={cat} className="flex justify-between gap-4">
                <span>{cat}</span>
                <span>NT${Number(amt).toLocaleString()}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default function MonthlyChart({ stats }: Props) {
  if (!stats.length) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        尚無統計資料
      </div>
    )
  }

  const data = stats.map((s) => ({
    ...s,
    month: s.month.slice(5), // show "01", "02" etc
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
        <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
