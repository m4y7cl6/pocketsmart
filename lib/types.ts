export type Category =
  | '餐飲' | '交通' | '購物' | '娛樂' | '醫療'
  | '住宿' | '教育' | '訂閱' | '其他'

export const CATEGORIES: Category[] = [
  '餐飲', '交通', '購物', '娛樂', '醫療',
  '住宿', '教育', '訂閱', '其他',
]

export interface Expense {
  id: string
  user_id: string
  amount: number
  category: Category
  description: string
  raw_input?: string
  note?: string
  expense_date: string   // ISO date string YYYY-MM-DD
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  name: string
  amount: number
  billing_cycle: 'monthly' | 'yearly' | 'weekly'
  next_billing: string   // ISO date string
  is_active: boolean
  created_at: string
}

export interface MonthlyStats {
  month: string          // 'YYYY-MM'
  total: number
  by_category: Record<Category, number>
}

// Shape returned from Claude classify API
export interface ClassifyResult {
  amount: number
  category: Category
  description: string
  note?: string
  expense_date: string   // YYYY-MM-DD
}
