import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getLoyalty } from '../lib/api'
import CalendarPicker from '../components/Calendar'
import { useDateRange } from '../components/DashboardLayout'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const RANGES = [
  { label: '7天', days: 7 },
  { label: '30天', days: 30 },
  { label: '90天', days: 90 },
]

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}分${s}秒`
}

interface LoyaltyBucket {
  label: string
  visits: number
  pct: number
}

interface VisitorGroupStats {
  visitors: number
  avg_duration: number
  pages_per_visit: number
  bounce_rate: number
  actions: number
}

interface LoyaltyData {
  returning_trend: { date: string; returning_visitors: number }[]
  frequency_overview: {
    returning: VisitorGroupStats
    new: VisitorGroupStats
  }
  duration_buckets: LoyaltyBucket[]
  pages_buckets: LoyaltyBucket[]
  visit_frequency: LoyaltyBucket[]
  days_since_last_visit: LoyaltyBucket[]
}

const tooltipStyle = {
  backgroundColor: '#1a1a2e',
  border: '1px solid #333',
  borderRadius: '8px',
  color: '#fff',
  fontSize: 12,
}

export default function LoyaltyPage() {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)
  const { rangeDays, setRangeDays, pickedDate, setPickedDate } = useDateRange()

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

  const handleRangeClick = (days: number) => {
    setPickedDate(null)
    setRangeDays(days)
  }

  const handleDatePick = (date: string) => {
    if (date) {
      setPickedDate(date)
    } else {
      setPickedDate(null)
    }
  }

  const { data, isLoading } = useQuery<LoyaltyData>({
    queryKey: ['loyalty', id, from, to],
    queryFn: () => getLoyalty(id, from, to),
  })

  const skeleton = <div className="h-64 bg-dark-border/30 rounded-lg animate-pulse" />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">忠诚度</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-dark-card border border-dark-border rounded-lg p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => handleRangeClick(r.days)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  !pickedDate && rangeDays === r.days
                    ? 'bg-gold-500 text-black'
                    : 'text-gray-400 hover:text-white hover:bg-dark-hover'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <CalendarPicker pickedDate={pickedDate} onDatePick={handleDatePick} />
        </div>
      </div>

      {/* Returning visitor trend */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">老访客趋势</h3>
        {isLoading ? (
          skeleton
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data?.returning_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: '#888', fontSize: 11 }} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#e6b400' }}
                formatter={(value: number) => [value.toLocaleString(), '回访访客']}
              />
              <Line
                type="monotone"
                dataKey="returning_visitors"
                stroke="#e6b400"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* New vs Returning comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VisitorGroupCard
          title="回访用户"
          stats={data?.frequency_overview?.returning}
          loading={isLoading}
          color="gold"
        />
        <VisitorGroupCard
          title="新访客"
          stats={data?.frequency_overview?.new}
          loading={isLoading}
          color="blue"
        />
      </div>

      {/* Duration + Pages buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BucketBarChart
          title="基于停留时间段的访问次数"
          buckets={data?.duration_buckets}
          loading={isLoading}
        />
        <BucketBarChart
          title="基于浏览页面数的访问次数"
          buckets={data?.pages_buckets}
          loading={isLoading}
        />
      </div>

      {/* Visit frequency + Days since last visit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BucketTable
          title="基于访问次数的统计"
          buckets={data?.visit_frequency}
          loading={isLoading}
          colLabel="次数"
        />
        <BucketTable
          title="距离上次访问天数的访问量"
          buckets={data?.days_since_last_visit}
          loading={isLoading}
          colLabel="天数"
        />
      </div>
    </div>
  )
}

function VisitorGroupCard({
  title,
  stats,
  loading,
  color,
}: {
  title: string
  stats?: VisitorGroupStats
  loading: boolean
  color: 'gold' | 'blue'
}) {
  const accentClass = color === 'gold' ? 'text-gold-400' : 'text-blue-400'
  const borderClass = color === 'gold' ? 'border-gold-500/30' : 'border-blue-500/30'

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <div className="h-40 bg-dark-border/30 rounded-lg animate-pulse" />
      </div>
    )
  }

  const s = stats || { visitors: 0, avg_duration: 0, pages_per_visit: 0, bounce_rate: 0, actions: 0 }

  return (
    <div className={`bg-dark-card border ${borderClass} rounded-xl p-6`}>
      <h3 className={`font-bold text-lg mb-4 ${accentClass}`}>{title}</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
          <span className="text-gray-400 text-sm">访客数</span>
          <span className={`text-2xl font-bold ${accentClass}`}>
            {s.visitors.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
          <span className="text-gray-400 text-sm">平均访问时间</span>
          <span className="text-white font-medium">{formatDuration(s.avg_duration)}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
          <span className="text-gray-400 text-sm">每次访问页面数</span>
          <span className="text-white font-medium">{s.pages_per_visit.toFixed(1)}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
          <span className="text-gray-400 text-sm">跳出率</span>
          <span className="text-white font-medium">{s.bounce_rate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-gray-400 text-sm">总行动数</span>
          <span className="text-white font-medium">{s.actions.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

function BucketBarChart({
  title,
  buckets,
  loading,
}: {
  title: string
  buckets?: LoyaltyBucket[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">{title}</h3>
        <div className="h-64 bg-dark-border/30 rounded-lg animate-pulse" />
      </div>
    )
  }

  const data = buckets || []

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <h3 className="font-bold text-white text-lg mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: '#888', fontSize: 11 }}
            width={80}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: '#e6b400' }}
            formatter={(value: number, _name: string, props: any) => [
              `${value.toLocaleString()} (${props.payload.pct.toFixed(1)}%)`,
              '访问',
            ]}
          />
          <Bar dataKey="visits" fill="#e6b400" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BucketTable({
  title,
  buckets,
  loading,
  colLabel,
}: {
  title: string
  buckets?: LoyaltyBucket[]
  loading: boolean
  colLabel: string
}) {
  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">{title}</h3>
        <div className="h-64 bg-dark-border/30 rounded-lg animate-pulse" />
      </div>
    )
  }

  const data = buckets || []
  const maxVisits = Math.max(...data.map((d) => d.visits), 1)

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <h3 className="font-bold text-white text-lg mb-4">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-dark-border">
            <th className="text-left pb-2 font-medium">{colLabel}</th>
            <th className="text-right pb-2 font-medium">访问</th>
            <th className="text-right pb-2 font-medium">占比</th>
            <th className="text-left pb-2 font-medium pl-4 w-1/3">分布</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const barWidth = (item.visits / maxVisits) * 100
            return (
              <tr
                key={item.label}
                className="border-b border-dark-border/50 hover:bg-dark-hover"
              >
                <td className="py-2 text-gray-300">{item.label}</td>
                <td className="py-2 text-right text-gold-400 font-medium">
                  {item.visits.toLocaleString()}
                </td>
                <td className="py-2 text-right text-gray-400">{item.pct.toFixed(1)}%</td>
                <td className="py-2 pl-4">
                  <div className="w-full bg-dark-border rounded-full h-2">
                    <div
                      className="bg-gold-500/70 h-2 rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
