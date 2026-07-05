'use client'

import { Menu, Calculator } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import StorageUsageWidget from '@/components/storage/StorageUsageWidget'

interface TopbarProps {
  title: string
  onMenuClick: () => void
  storageTotalBytes?: number
}

export default function Topbar({ title, onMenuClick, storageTotalBytes }: TopbarProps) {
  return (
    <header className="h-14 bg-white border-b border-border flex items-center px-4 gap-4 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-base font-semibold text-foreground flex-1 truncate">{title}</h1>

      {storageTotalBytes !== undefined && (
        <StorageUsageWidget totalBytes={storageTotalBytes} compact className="hidden md:flex" />
      )}

      <Link href="/calculator">
        <Button size="sm" className="bg-navy hover:bg-navy-2 h-9 text-white gap-1.5 hidden sm:flex">
          <Calculator className="w-3.5 h-3.5" />
          New Package
        </Button>
      </Link>
    </header>
  )
}
