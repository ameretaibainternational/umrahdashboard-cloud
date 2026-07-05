'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const prevPath = useRef(pathname)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  function clear() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function later(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms)
    timers.current.push(t)
  }

  function start() {
    clear()
    setVisible(true)
    setWidth(8)
    later(() => setWidth(30), 120)
    later(() => setWidth(58), 450)
    later(() => setWidth(75), 950)
  }

  function done() {
    clear()
    setWidth(100)
    later(() => setVisible(false), 280)
    later(() => setWidth(0), 330)
  }

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      done()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href]')
      if (!a) return
      const href = a.getAttribute('href')!
      if (/^(#|https?:|mailto:|tel:)/.test(href)) return
      if (href === pathname) return
      start()
    }
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      clear()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px]"
      style={{
        width: `${width}%`,
        backgroundImage: 'linear-gradient(135deg, #d7ab52, #f1c97c)',
        boxShadow: visible ? '0 0 10px #d7ab5299' : 'none',
        opacity: visible ? 1 : 0,
        transition: visible
          ? width >= 100
            ? 'width 220ms ease-out'
            : 'width 700ms ease-out'
          : 'opacity 180ms ease-out',
      }}
    />
  )
}
