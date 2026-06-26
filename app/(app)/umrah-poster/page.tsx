import UmrahPosterForm from '@/components/umrah-poster/UmrahPosterForm'
import { ImageIcon } from 'lucide-react'

export default function UmrahPosterPage() {
  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-navy flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy">Umrah Package Poster</h1>
          <p className="text-xs text-muted-foreground">
            Design a print-ready package poster and download at 1587 × 2245 px
          </p>
        </div>
      </div>

      <UmrahPosterForm />
    </div>
  )
}
