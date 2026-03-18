import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDateRange } from '../components/DashboardLayout'
import CalendarPicker from '../components/Calendar'
import { getIPRanking } from '../lib/api'
import ExportButton from '../components/ExportButton'

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

interface IPStat {
  ip: string
  pageviews: number
  visitors: number
  sessions: number
  country: string
  region: string
  city: string
  last_seen: string
}

export default function IPRankingPage() {
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

  const handleDatePick = (date: string | null) => {
    if (date) {
      setPickedDate(date)
    } else {
      setPickedDate(null)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['ip-ranking', id, from, to],
    queryFn: () => getIPRanking(id, from, to),
  })

  const ipList: IPStat[] = data ?? []

  return (
    <div className="space-y-6">
      {/* 顶部：标题 + 日期选择 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">IP 排行</h2>
        <div className="flex items-center gap-2">
          <ExportButton type="ip-ranking" label="导出" />
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

      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">独立 IP 数</div>
          <div className="text-2xl font-bold text-gold-400">{ipList.length}</div>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">总浏览量</div>
          <div className="text-2xl font-bold text-blue-400">
            {ipList.reduce((sum, ip) => sum + ip.pageviews, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">总会话数</div>
          <div className="text-2xl font-bold text-green-400">
            {ipList.reduce((sum, ip) => sum + ip.sessions, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">涉及地区</div>
          <div className="text-2xl font-bold text-purple-400">
            {new Set(ipList.map(ip => ip.country).filter(Boolean)).size}
          </div>
        </div>
      </div>

      {/* IP 排行表 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">IP 地址排行</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-dark-border">
                <th className="text-left py-2 px-3 w-8">#</th>
                <th className="text-left py-2 px-3">IP 地址</th>
                <th className="text-right py-2 px-3">浏览量</th>
                <th className="text-right py-2 px-3">访客数</th>
                <th className="text-right py-2 px-3">会话数</th>
                <th className="text-left py-2 px-3">国家</th>
                <th className="text-left py-2 px-3">地区</th>
                <th className="text-left py-2 px-3">城市</th>
                <th className="text-right py-2 px-3">最近访问</th>
              </tr>
            </thead>
            <tbody>
              {ipList.map((ip, i) => (
                <tr key={ip.ip} className="border-b border-dark-border/50 hover:bg-dark-hover">
                  <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                  <td className="py-2 px-3">
                    <span className="font-mono text-gold-400">{ip.ip}</span>
                  </td>
                  <td className="py-2 px-3 text-right text-white font-medium">{ip.pageviews.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{ip.visitors.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{ip.sessions.toLocaleString()}</td>
                  <td className="py-2 px-3 text-gray-300">{ip.country || '-'}</td>
                  <td className="py-2 px-3 text-gray-400">{ip.region || '-'}</td>
                  <td className="py-2 px-3 text-gray-400">{ip.city || '-'}</td>
                  <td className="py-2 px-3 text-right text-gray-500 text-xs">{ip.last_seen}</td>
                </tr>
              ))}
              {!isLoading && ipList.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">暂无 IP 访问数据</td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">加载中...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
