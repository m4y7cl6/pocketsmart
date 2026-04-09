import { redirect } from 'next/navigation'

// Root "/" always redirects to the dashboard
// In a real app you'd check session here first
export default function RootPage() {
  redirect('/dashboard')
}
