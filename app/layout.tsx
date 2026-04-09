import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PocketSmart — 智慧記帳',
  description: '最適合懶人的 AI 記帳工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
