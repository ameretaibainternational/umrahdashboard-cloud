'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isDemoMode } from '@/lib/is-demo'

import { isTurnstileEnabled } from '@/lib/turnstile'

async function verifyTurnstile(token: string, remoteIp?: string): Promise<{ ok: boolean; message?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) return { ok: true }

  try {
    const body: Record<string, string> = { secret: secretKey, response: token }
    if (remoteIp) body.remoteip = remoteIp

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { success?: boolean; 'error-codes'?: string[] }
    if (data.success === true) return { ok: true }

    const codes = data['error-codes'] ?? []
    if (codes.includes('invalid-input-secret')) {
      return { ok: false, message: 'CAPTCHA misconfigured (invalid secret key). Check TURNSTILE_SECRET_KEY in Netlify.' }
    }
    if (codes.includes('timeout-or-duplicate')) {
      return { ok: false, message: 'CAPTCHA expired. Please complete it again.' }
    }
    if (codes.includes('invalid-input-response')) {
      return { ok: false, message: 'CAPTCHA verification failed. Refresh the page and try again.' }
    }
    return { ok: false, message: 'CAPTCHA verification failed. Please try again.' }
  } catch {
    return { ok: false, message: 'CAPTCHA verification unavailable. Try again in a moment.' }
  }
}

export async function login(formData: FormData) {
  if (isDemoMode()) {
    return { error: 'Demo mode active — use the demo login button.' }
  }

  // Verify Turnstile CAPTCHA when both keys are configured
  const turnstileToken = formData.get('cf_turnstile_token') as string | null
  if (isTurnstileEnabled()) {
    if (!turnstileToken) {
      return { error: 'CAPTCHA verification required. Complete the challenge below the password field.' }
    }
    const { headers } = await import('next/headers')
    const h = await headers()
    const remoteIp = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    const valid = await verifyTurnstile(turnstileToken, remoteIp)
    if (!valid.ok) {
      return { error: valid.message ?? 'CAPTCHA verification failed. Please try again.' }
    }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: staffUser } = await supabase
      .from('staff_users').select('status').eq('id', user.id).single()
    if (staffUser?.status === 'Inactive') {
      await supabase.auth.signOut()
      return { error: 'Your account is inactive. Contact admin.' }
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  if (isDemoMode()) {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    cookieStore.delete('demo_session')
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  revalidatePath('/', 'layout')
  redirect('/login')
}
