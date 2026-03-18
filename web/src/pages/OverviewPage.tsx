import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  getOverview, getTimeseries, getChannels, getBrowsers,
  getDevices, getGeo, getPages, getReferrers, getRealtime,
} from '../lib/api'
import { useDateRange } from '../components/DashboardLayout'
import OverviewCards from '../components/OverviewCards'
import VisitorTrendChart from '../components/VisitorTrendChart'
import ChannelBreakdown from '../components/ChannelBreakdown'
import BrowserStats from '../components/BrowserStats'
import DeviceStats from '../components/DeviceStats'
import GeoMap from '../components/GeoMap'
import TopPages from '../components/TopPages'
import TopReferrers from '../components/TopReferrers'
import RealtimeBadge from '../components/RealtimeBadge'
import CalendarPicker from '../components/Calendar'

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const RANGES = [
  { label: '今天', days: 0 },
  { label: '7天', days: 7 },
  { label: '30天', days: 30 },
  { label: '90天', days: 90 },
]

export default function OverviewPage() {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)
  const { rangeDays, setRangeDays, pickedDate, setPickedDate } = useDateRange()

  const now = new Date()

  // If a specific date is picked, use that single day; otherwise use range
  let from: string
  let to: string
  let interval: string

  if (pickedDate) {
    from = pickedDate
    to = pickedDate
    interval = 'hour'
  } else {
    from = formatDate(new Date(now.getTime() - rangeDays * 86400000))
    to = formatDate(now)
    interval = rangeDays <= 1 ? 'hour' : 'day'
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

  const overview = useQuery({
    queryKey: ['overview', id, from, to],
    queryFn: () => getOverview(id, from, to),
  })
  const timeseries = useQuery({
    queryKey: ['timeseries', id, from, to],
    queryFn: () => getTimeseries(id, from, to, interval),
  })
  const channels = useQuery({
    queryKey: ['channels', id, from, to],
    queryFn: () => getChannels(id, from, to),
  })
  const browsers = useQuery({
    queryKey: ['browsers', id, from, to],
    queryFn: () => getBrowsers(id, from, to),
  })
  const devices = useQuery({
    queryKey: ['devices', id, from, to],
    queryFn: () => getDevices(id, from, to),
  })
  const geo = useQuery({
    queryKey: ['geo', id, from, to],
    queryFn: () => getGeo(id, from, to),
  })
  const pages = useQuery({
    queryKey: ['pages', id, from, to],
    queryFn: () => getPages(id, from, to),
  })
  const referrers = useQuery({
    queryKey: ['referrers', id, from, to],
    queryFn: () => getReferrers(id, from, to),
  })
  const realtime = useQuery({
    queryKey: ['realtime', id],
    queryFn: () => getRealtime(id),
    refetchInterval: 15000,
  })

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white">概览</h2>
          <RealtimeBadge count={realtime.data?.visitors ?? 0} />
        </div>
        <div className="flex items-center gap-2">
          {/* Range buttons */}
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
          {/* Calendar button */}
          <CalendarPicker pickedDate={pickedDate} onDatePick={handleDatePick} />
        </div>
      </div>

      {/* KPI Cards */}
      <OverviewCards data={overview.data} loading={overview.isLoading} />

      {/* Visitor Trend */}
      <VisitorTrendChart data={timeseries.data} loading={timeseries.isLoading} />

      {/* Channels + Geo Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChannelBreakdown data={channels.data} loading={channels.isLoading} />
        <GeoMap data={geo.data} loading={geo.isLoading} />
      </div>

      {/* Visitor Overview Stats */}
      {overview.data && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="font-bold text-white text-lg mb-4">访客概览</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatItem
              label="访问次数"
              value={`${(overview.data.sessions ?? 0).toLocaleString()} 访问次数, ${(overview.data.visitors ?? 0).toLocaleString()} 独立访客`}
            />
            <StatItem
              label="页面浏览量"
              value={`${(overview.data.pageviews ?? 0).toLocaleString()} 页面访问次数`}
            />
            <StatItem
              label="平均停留时间"
              value={formatDuration(overview.data.avg_duration ?? 0)}
            />
            <StatItem
              label="跳出率"
              value={`${(overview.data.bounce_rate ?? 0).toFixed(1)}% 跳出次数 (查看一个页面后就离开)`}
            />
          </div>
        </div>
      )}

      {/* Browser + Device */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BrowserStats data={browsers.data} loading={browsers.isLoading} />
        <DeviceStats data={devices.data} loading={devices.isLoading} />
      </div>

      {/* Pages + Referrers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopPages data={pages.data} loading={pages.isLoading} />
        <TopReferrers data={referrers.data} loading={referrers.isLoading} />
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-dark-border rounded-lg p-4">
      <p className="text-xs text-gold-400 font-medium mb-1">{label}</p>
      <p className="text-sm text-gray-300">{value}</p>
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}分 ${s}秒 平均停留时间`
}
