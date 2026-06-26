'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/app/actions/auth'
import { Plane, Eye, EyeOff, Loader2, Zap, Copy, Check, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'

const IS_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

const SHOW_DEMO_CREDENTIALS = process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === 'true'
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const DEMO_EMAIL = 'demo@umrahdashboard.pk'
const DEMO_PASSWORD = 'Demo1234'

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [turnstileToken, setTurnstileToken] = useState('')
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const router = useRouter()

  function handleDemoLogin() {
    document.cookie = 'demo_session=1; path=/; max-age=86400'
    router.push('/dashboard')
    router.refresh()
  }

  async function handleSubmit(formData: FormData) {
    setError('')

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Please complete the CAPTCHA verification.')
      return
    }

    if (TURNSTILE_SITE_KEY) {
      formData.set('cf_turnstile_token', turnstileToken)
    }

    startTransition(async () => {
      const result = await login(formData)
      if (result?.error) {
        setError(result.error)
        // Reset Turnstile on error so user can retry
        turnstileRef.current?.reset()
        setTurnstileToken('')
      }
    })
  }

  function copyToClipboard(text: string, type: 'email' | 'password') {
    navigator.clipboard.writeText(text)
    if (type === 'email') {
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    } else {
      setCopiedPassword(true)
      setTimeout(() => setCopiedPassword(false), 2000)
    }
  }

  return (
    <div className="min-h-screen flex bg-navy">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-center items-center w-[480px] flex-shrink-0 px-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-gold/5 translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-full bg-transparent flex items-center justify-center mx-auto mb-6 shadow-xl">
          <img src="/logo.png" alt="Amere Taiba International" className="w-20 h-20 object-contain" /> 
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Amere Taiba International</h1>
          <p className="text-gold text-lg font-medium mb-1">Demo</p>
          <p className="text-white/40 text-sm max-w-xs">
            Complete package management for Umrah operators
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              { value: '100+', label: 'Bookings' },
              { value: '50+', label: 'Hotels' },
              { value: '10+', label: 'Airlines' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white/5 rounded-xl p-3">
                <p className="text-gold text-xl font-bold">{value}</p>
                <p className="text-white/50 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 rounded-l-[2rem] lg:rounded-l-[3rem]">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center">
              <img src="/logo.png" alt="Amere Taiba International" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <p className="font-bold text-navy text-sm">Amere Taiba International</p>
              <p className="text-xs text-muted-foreground">Demo</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-navy mb-1">Welcome back</h2>
          <p className="text-muted-foreground text-sm mb-6">Sign in to your dashboard</p>

          {/* Demo mode banner (local dev without Supabase) */}
          {IS_DEMO && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Demo Mode</p>
                  <p className="text-xs text-amber-700 mt-0.5 mb-3">
                    Supabase is not configured. All data is stored in memory and resets on server restart.
                  </p>
                  <Button
                    onClick={handleDemoLogin}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold h-9 text-sm"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    Enter Demo (no password needed)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Public demo credentials card */}
          {!IS_DEMO && SHOW_DEMO_CREDENTIALS && (
            <div className="bg-navy/5 border border-navy/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-navy" />
                <p className="text-sm font-semibold text-navy">Try the Demo</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Use these credentials to explore the CRM:
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Email</p>
                    <p className="text-sm font-mono text-navy">{DEMO_EMAIL}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(DEMO_EMAIL, 'email')}
                    className="text-muted-foreground hover:text-navy transition-colors p-1"
                    title="Copy email"
                  >
                    {copiedEmail ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Password</p>
                    <p className="text-sm font-mono text-navy">{DEMO_PASSWORD}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(DEMO_PASSWORD, 'password')}
                    className="text-muted-foreground hover:text-navy transition-colors p-1"
                    title="Copy password"
                  >
                    {copiedPassword ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@fasttravels.pk"
                defaultValue={IS_DEMO ? 'admin@fasttravels.pk' : (SHOW_DEMO_CREDENTIALS ? DEMO_EMAIL : '')}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  defaultValue={IS_DEMO ? 'admin123' : ''}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile CAPTCHA */}
            {!IS_DEMO && TURNSTILE_SITE_KEY && (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => {
                    setTurnstileToken('')
                    setError('CAPTCHA failed to load. Please refresh the page.')
                  }}
                  options={{ theme: 'light', size: 'normal' }}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {!IS_DEMO && (
              <Button
                type="submit"
                disabled={isPending || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
                className="w-full h-11 bg-navy hover:bg-navy-2 text-white font-semibold disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in…
                  </>
                ) : 'Sign In'}
              </Button>
            )}
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
           Amere Taiba International - a complete package management system for Umrah operators

           <br />
           A product by <a href="https://axiusdigital.com" target="_blank" className="text-blue-500">Axius Digital</a>
          </p>
        </div>
      </div>
    </div>
  )
}
