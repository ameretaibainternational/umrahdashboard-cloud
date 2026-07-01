'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_CUSTOM_INVOICE_BACKGROUND,
  DEFAULT_INVOICE_TEXT_COLOR,
  INVOICE_BACKGROUNDS,
  INVOICE_TEXT_COLOR_PRESETS,
  type InvoiceBackgroundOption,
} from '@/lib/invoice-backgrounds'
import { cn } from '@/lib/utils'

interface Props {
  backgroundSrc: string
  onBackgroundChange: (src: string) => void
  textColor: string
  onTextColorChange: (color: string) => void
  defaultBackground?: string
  defaultTextColor?: string
  backgrounds?: InvoiceBackgroundOption[]
}

export default function InvoiceAppearanceControls({
  backgroundSrc,
  onBackgroundChange,
  textColor,
  onTextColorChange,
  defaultBackground = DEFAULT_CUSTOM_INVOICE_BACKGROUND,
  defaultTextColor = DEFAULT_INVOICE_TEXT_COLOR,
  backgrounds = INVOICE_BACKGROUNDS,
}: Props) {
  const isDefaultAppearance =
    backgroundSrc === defaultBackground && textColor === defaultTextColor

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Invoice Background</Label>
        <div className="flex flex-wrap gap-2">
          {backgrounds.map(bg => {
            const selected = backgroundSrc === bg.src
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => onBackgroundChange(bg.src)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-2xl border-2 p-1.5 transition-all min-w-[4.75rem]',
                  selected
                    ? 'border-navy bg-navy/5 shadow-sm ring-2 ring-navy/20'
                    : 'border-border/60 hover:border-navy/40 hover:bg-muted/30',
                )}
                title={bg.name}
              >
                <span
                  className="block h-12 w-12 shrink-0 rounded-full border border-black/10 shadow-inner"
                  style={{ background: bg.swatch }}
                />
                <span className="text-[9px] font-medium text-center leading-tight text-muted-foreground max-w-[4.5rem]">
                  {bg.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Invoice Text Color</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="color"
            value={textColor}
            onChange={e => onTextColorChange(e.target.value)}
            className="h-9 w-12 cursor-pointer p-1 shrink-0"
            aria-label="Pick invoice text color"
          />
          <Input
            value={textColor}
            onChange={e => onTextColorChange(e.target.value)}
            placeholder="#fefefe"
            className="h-9 w-28 font-mono text-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            {INVOICE_TEXT_COLOR_PRESETS.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => onTextColorChange(preset)}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-transform hover:scale-105',
                  textColor === preset ? 'border-navy ring-2 ring-navy/25' : 'border-black/15',
                )}
                style={{ backgroundColor: preset }}
                title={preset}
                aria-label={`Use text color ${preset}`}
              />
            ))}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Applies to all text on the invoice (title, table, totals, contact, terms).
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        disabled={isDefaultAppearance}
        onClick={() => {
          onBackgroundChange(defaultBackground)
          onTextColorChange(defaultTextColor)
        }}
      >
        Reset appearance
      </Button>
    </div>
  )
}
