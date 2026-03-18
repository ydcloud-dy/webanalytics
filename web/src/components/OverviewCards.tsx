interface Props {
  data?: {
    pageviews: number
    visitors: number
    sessions: number
    avg_duration: number
    bounce_rate: number
    views_per_visit: number
  }
  loading: boolean
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}分${s}秒`
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString()
}

const cards = [
  {
    key: 'pageviews' as const,
    label: '浏览次数',
    subtitle: '页面总浏览量',
    icon: '📄',
    color: 'text-gold-400',
    bgIcon: 'bg-gold-500/10',
    format: formatNumber,
  },
  {
    key: 'visitors' as const,
    label: '独立访客',
    subtitle: '唯一访客数',
    icon: '👤',
    color: 'text-emerald-400',
    bgIcon: 'bg-emerald-500/10',
    format: formatNumber,
  },
  {
    key: 'sessions' as const,
    label: '会话次数',
    subtitle: '访问会话总数',
    icon: '🔗',
    color: 'text-blue-400',
    bgIcon: 'bg-blue-500/10',
    format: formatNumber,
  },
  {
    key: 'avg_duration' as const,
    label: '平均停留时间',
    subtitle: '用户活跃度',
    icon: '⏱',
    color: 'text-purple-400',
    bgIcon: 'bg-purple-500/10',
    format: formatDuration,
  },
  {
    key: 'bounce_rate' as const,
    label: '跳出率',
    subtitle: '单页退出占比',
    icon: '↩️',
    color: 'text-orange-400',
    bgIcon: 'bg-orange-500/10',
    format: (v: number) => v.toFixed(1) + '%',
  },
]

export default function OverviewCards({ data, loading }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div
          key={c.key}
          className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-gold-500/30 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">{c.label}</p>
              <p className="text-xs text-gray-600 mt-0.5">{c.subtitle}</p>
            </div>
            <div className={`w-10 h-10 rounded-lg ${c.bgIcon} flex items-center justify-center text-lg`}>
              {c.icon}
            </div>
          </div>
          {loading ? (
            <div className="h-9 bg-dark-border rounded animate-pulse" />
          ) : (
            <p className={`text-3xl font-bold ${c.color}`}>
              {data ? c.format(data[c.key] as number) : '—'}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
