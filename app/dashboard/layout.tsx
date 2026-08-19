import Link from 'next/link'
import { LayoutDashboard, Users, Calendar, Phone } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
        <div className="p-6 border-b border-gray-100">
          <div className="font-bold text-lg text-indigo-600">LeadDash</div>
          <div className="text-xs text-gray-500">AI Lead Dashboard</div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
            { href: '/dashboard/leads', icon: Users, label: 'Leads' },
            { href: '/dashboard/appointments', icon: Calendar, label: 'Appointments' },
            { href: '/dashboard/calls', icon: Phone, label: 'Call Logs' },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-sm font-medium">
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <Link href="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
            Back to Site
          </Link>
        </div>
      </aside>
      {/* Main */}
      <main className="ml-64 flex-1 p-8">
        {children}
      </main>
    </div>
  )
}
