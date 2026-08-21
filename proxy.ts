import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Protect all /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const session = req.cookies.get('dash_session')?.value
    const secret  = process.env.DASHBOARD_SECRET

    if (!session || !secret || session !== secret) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
