'use client'

import { useState } from 'react'
import { CheckCircle, Phone, Mail, Star, Shield, Zap, Users } from 'lucide-react'

export default function LandingPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', service: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const services = ['Consulting', 'Web Development', 'Marketing', 'SEO', 'Social Media', 'Other']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to submit')
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="font-bold text-xl text-indigo-600">
            {process.env.NEXT_PUBLIC_BUSINESS_NAME || 'YourBusiness'}
          </div>
          <div className="flex gap-6 text-sm text-gray-600">
            <a href="#services" className="hover:text-indigo-600 transition-colors">Services</a>
            <a href="#about" className="hover:text-indigo-600 transition-colors">About</a>
            <a href="#contact" className="hover:text-indigo-600 transition-colors">Contact</a>
          </div>
          <a href="/dashboard" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
            Dashboard
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Trusted by 500+ Businesses
            </div>
            <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
              Grow Your Business with{' '}
              <span className="text-indigo-600">Expert Services</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              {process.env.NEXT_PUBLIC_BUSINESS_TAGLINE || 'Professional services tailored to your needs. Let\'s build something great together.'}
            </p>
            <div className="flex gap-4">
              <a href="#contact" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
                Get Free Consultation
              </a>
              <a href="#services" className="border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-indigo-300 transition-colors">
                Learn More
              </a>
            </div>
            <div className="flex gap-6 mt-10 text-sm text-gray-600">
              {['No commitment required', 'Fast response time', '100% Satisfaction'].map(t => (
                <div key={t} className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {t}
                </div>
              ))}
            </div>
          </div>
          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: '500+', label: 'Happy Clients', icon: Users },
              { value: '98%', label: 'Satisfaction Rate', icon: Star },
              { value: '24/7', label: 'Support', icon: Shield },
              { value: '5min', label: 'Response Time', icon: Zap },
            ].map(({ value, label, icon: Icon }) => (
              <div key={label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                <Icon className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900">{value}</div>
                <div className="text-sm text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What We Offer</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Comprehensive solutions designed to accelerate your business growth.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Consulting', desc: 'Strategic guidance to help you make the right decisions and achieve your goals faster.', icon: '🎯' },
              { title: 'Web Development', desc: 'Modern, fast, and beautiful websites that convert visitors into customers.', icon: '💻' },
              { title: 'Digital Marketing', desc: 'Data-driven marketing campaigns that reach your target audience effectively.', icon: '📈' },
              { title: 'SEO Optimization', desc: 'Rank higher on search engines and drive organic traffic to your business.', icon: '🔍' },
              { title: 'Social Media', desc: 'Build a strong online presence and engage with your community.', icon: '📱' },
              { title: 'Custom Solutions', desc: 'Tailored solutions built specifically for your unique business needs.', icon: '⚡' },
            ].map(({ title, desc, icon }) => (
              <div key={title} className="p-6 border border-gray-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all group">
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{title}</h3>
                <p className="text-gray-600 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Capture Form */}
      <section id="contact" className="py-20 bg-gradient-to-br from-indigo-600 to-purple-700">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-4">Get Your Free Consultation</h2>
            <p className="text-indigo-200">Fill out the form below and we&apos;ll get back to you within 24 hours.</p>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-2xl">
            {submitted ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
                <p className="text-gray-600">We&apos;ve received your inquiry and will contact you within 24 hours.</p>
                <button onClick={() => { setSubmitted(false); setForm({ name: '', email: '', phone: '', service: '', message: '' }) }}
                  className="mt-6 text-indigo-600 underline text-sm">Submit another inquiry</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="John Smith"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                    <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="john@example.com"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Interested In</label>
                  <select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                    <option value="">Select a service...</option>
                    {services.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                    placeholder="Tell us about your project or goals..."
                    rows={4}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none" />
                </div>
                {error && <div className="md:col-span-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl">{error}</div>}
                <div className="md:col-span-2">
                  <button type="submit" disabled={loading}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-lg">
                    {loading ? 'Sending...' : 'Get Free Consultation'}
                  </button>
                  <p className="text-center text-xs text-gray-500 mt-3">No spam. We respect your privacy.</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-gray-900 text-center text-gray-400 text-sm">
        <div className="flex justify-center gap-6 mb-4">
          <div className="flex items-center gap-2"><Phone className="w-4 h-4" /><span>+1 (555) 000-0000</span></div>
          <div className="flex items-center gap-2"><Mail className="w-4 h-4" /><span>hello@yourbusiness.com</span></div>
        </div>
        <p>© {new Date().getFullYear()} {process.env.NEXT_PUBLIC_BUSINESS_NAME || 'YourBusiness'}. All rights reserved.</p>
      </footer>
    </div>
  )
}
