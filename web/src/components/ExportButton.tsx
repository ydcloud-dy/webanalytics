import { useParams } from 'react-router-dom'
import { getExportURL } from '../lib/api'
import { useDateRange } from './DashboardLayout'

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ExportButton({ type, label }: { type: string; label?: string }) {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)
  const { rangeDays, pickedDate } = useDateRange()

  const handleExport = () => {
    const now = new Date()
    let from: string
    let to: string
    if (pickedDate) {
      from = pickedDate
      to = pickedDate
    } else {
      from = formatDate(new Date(now.getTime() - rangeDays * 86400000))
      to = formatDate(now)
    }
    const url = getExportURL(id, type, from, to)
    window.open(url, '_blank')
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-dark-card border border-dark-border text-gray-400 hover:text-gold-400 hover:border-gold-500/50 transition-colors"
      title={`导出 ${label || type} CSV`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span>{label || '导出'}</span>
    </button>
  )
}
