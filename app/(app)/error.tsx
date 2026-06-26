'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full rounded-2xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The page failed to load. This is often caused by a bad{' '}
          <code className="font-mono text-xs bg-muted px-1 rounded">DATABASE_URL</code>{' '}
          on Netlify. Check that the password is URL-encoded (@ → %40, $ → %24).
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.href = '/login'}>
            Back to login
          </Button>
        </div>
      </div>
    </div>
  )
}
