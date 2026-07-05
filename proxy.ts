import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isDemoMode() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return !url || url.includes('your-project')
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Demo mode: allow everything except redirect / → /dashboard
  if (isDemoMode()) {
    // Mark demo session via cookie so app can detect it
    const demoSession = request.cookies.get('demo_session')?.value

    if (!demoSession && pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (demoSession && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname === '/') {
      return NextResponse.redirect(new URL(demoSession ? '/dashboard' : '/login', request.url))
    }
    return NextResponse.next({ request })
  }

  // Production mode: real Supabase auth
  //
  // Fast-path: if there is no Supabase session cookie at all, skip the
  // network round-trip and redirect straight to /login. This prevents an
  // 11-second hang on every unauthenticated request.
  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-'))

  if (!hasSession) {
    if (pathname === '/login') return NextResponse.next({ request })
    return NextResponse.redirect(new URL('/login', request.url))
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() reads the JWT from the cookie — no network call, instant.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  // Avoid /login ↔ /dashboard loops when the app layout cannot load staff_users.
  if (
    user &&
    pathname === '/login' &&
    !request.nextUrl.searchParams.get('error')
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  if (pathname === '/') {
    return NextResponse.redirect(new URL(user ? '/dashboard' : '/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
