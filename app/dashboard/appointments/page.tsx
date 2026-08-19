'use client'

import { useEffect, useState } from 'react'
import { Calendar, Clock, User } from 'lucide-react'

interface Appointment {
  id: string
  title: string
  scheduledAt: string
  duration: number
  type: string
  status: string
  notes: string | null
  lead: { name: string; email: string; phone: string | null }
}

const TYPE_COLORS: Record<string, string> = {
  CALL: 'bg-blue-50 text-blue-700',
  MEETING: 'bg-green-50 text-green-700',
  DEMO: 'bg-purple-50 text-purple-700',
}

const APPT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-yellow-50 text-yellow-700',
  COMPLETED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700',
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])

  const load = () => fetch('/api/appointments').then(r => r.json()).then(setAppointments)
  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/appointments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load()
  }

  const upcoming = appointments.filter(a => a.status === 'SCHEDULED' && new Date(a.scheduledAt) >= new Date())
  const past = appointments.filter(a => a.status !== 'SCHEDULED' || new Date(a.scheduledAt) < new Date())

  const AppointmentCard = ({ a }: { a: Appointment }) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{a.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <User className="w-3 h-3 text-gray-400" />
            <span className="text-sm text-gray-500">{a.lead.name}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${TYPE_COLORS[a.type] || 'bg-gray-50 text-gray-700'}`}>{a.type}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${APPT_STATUS_COLORS[a.status] || 'bg-gray-50 text-gray-700'}`}>{a.status}</span>
        </div>
      </div>
      <div className="flex gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(a.scheduledAt).toLocaleDateString()}</div>
        <div className="flex items-center gap-1"><Clock className="w-4 h-4" />{new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        <div>{a.duration} min</div>
      </div>
      {a.status === 'SCHEDULED' && (
        <div className="flex gap-2 mt-4">
          <button onClick={() => updateStatus(a.id, 'COMPLETED')} className="flex-1 bg-green-50 text-green-700 py-1.5 rounded-xl text-xs font-medium hover:bg-green-100 transition-colors">Completed</button>
          <button onClick={() => updateStatus(a.id, 'CANCELLED')} className="flex-1 bg-red-50 text-red-700 py-1.5 rounded-xl text-xs font-medium hover:bg-red-100 transition-colors">Cancel</button>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <p className="text-sm text-gray-500">{appointments.length} total · {upcoming.length} upcoming</p>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 uppercase mb-4">Upcoming</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {upcoming.map(a => <AppointmentCard key={a.id} a={a} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase mb-4">Past</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-75">
            {past.map(a => <AppointmentCard key={a.id} a={a} />)}
          </div>
        </div>
      )}

      {appointments.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No appointments yet. Schedule one from the Leads page.</p>
        </div>
      )}
    </div>
  )
}
