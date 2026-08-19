import DashboardNav from '@/components/DashboardNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardNav />
      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  )
}
