import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function BrandingSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{value}px</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 accent-navy cursor-pointer"
      />
    </div>
  )
}

export function BrandingResetButton({
  onReset,
  disabled = false,
}: {
  onReset: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onReset}
      disabled={disabled}
      className="h-8 w-full text-xs gap-1.5"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Reset to defaults
    </Button>
  )
}
