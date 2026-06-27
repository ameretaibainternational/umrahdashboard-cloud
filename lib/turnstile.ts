/** Turnstile is active only when both keys are set (site key is baked in at build time). */
export function isTurnstileEnabled(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY?.trim() &&
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim(),
  )
}

export function turnstileSiteKey(): string | undefined {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined
}
