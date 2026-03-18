import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDateRange } from '../components/DashboardLayout'
import CalendarPicker from '../components/Calendar'
import { getPathOverview, getEntryPages, getExitPages, getPageFlow } from '../lib/api'

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

interface PathOverviewStats {
  total_sessions: number
  avg_pages_per_session: number
  single_page_sessions: number
  single_page_rate: number
}

interface EntryPageStat {
  pathname: string
  sessions: number
  visitors: number
}

interface ExitPageStat {
  pathname: string
  sessions: number
  visitors: number
}

interface PageFlowStat {
  from_page: string
  to_page: string
  count: number
}

export default function UserPathPage() {
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

  const pathOverview = useQuery({
    queryKey: ['path-overview', id, from, to],
    queryFn: () => getPathOverview(id, from, to),
  })
  const entryPages = useQuery({
    queryKey: ['entry-pages', id, from, to],
    queryFn: () => getEntryPages(id, from, to),
  })
  const exitPages = useQuery({
    queryKey: ['exit-pages', id, from, to],
    queryFn: () => getExitPages(id, from, to),
  })
  const pageFlow = useQuery({
    queryKey: ['page-flow', id, from, to],
    queryFn: () => getPageFlow(id, from, to),
  })

  const stats: PathOverviewStats | undefined = pathOverview.data
  const entryList: EntryPageStat[] = entryPages.data ?? []
  const exitList: ExitPageStat[] = exitPages.data ?? []
  const flowList: PageFlowStat[] = pageFlow.data ?? []

  return (
    <div className="space-y-6">
      {/* 顶部：标题 + 日期选择 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">用户行为路径</h2>
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

      {/* 路径概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">总会话数</div>
          <div className="text-2xl font-bold text-gold-400">
            {pathOverview.isLoading ? '--' : (stats?.total_sessions ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">平均页面数/会话</div>
          <div className="text-2xl font-bold text-blue-400">
            {pathOverview.isLoading ? '--' : (stats?.avg_pages_per_session ?? 0).toFixed(1)}
          </div>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">单页会话数</div>
          <div className="text-2xl font-bold text-orange-400">
            {pathOverview.isLoading ? '--' : (stats?.single_page_sessions ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">单页率</div>
          <div className="text-2xl font-bold text-red-400">
            {pathOverview.isLoading ? '--' : `${(stats?.single_page_rate ?? 0).toFixed(1)}%`}
          </div>
        </div>
      </div>

      {/* 入口页面 + 出口页面 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 入口页面 */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="font-bold text-white text-lg mb-4">入口页面</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-dark-border">
                  <th className="text-left py-2 px-3 w-8">#</th>
                  <th className="text-left py-2 px-3">页面路径</th>
                  <th className="text-right py-2 px-3">会话数</th>
                  <th className="text-right py-2 px-3">访客数</th>
                </tr>
              </thead>
              <tbody>
                {entryList.map((p, i) => (
                  <tr key={p.pathname} className="border-b border-dark-border/50 hover:bg-dark-hover">
                    <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                    <td className="py-2 px-3 text-gray-300 truncate max-w-[200px]" title={p.pathname}>{p.pathname}</td>
                    <td className="py-2 px-3 text-right text-white font-medium">{p.sessions.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-gray-400">{p.visitors.toLocaleString()}</td>
                  </tr>
                ))}
                {!entryPages.isLoading && entryList.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">暂无数据</td></tr>
                )}
                {entryPages.isLoading && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">加载中...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 出口页面 */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="font-bold text-white text-lg mb-4">出口页面</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-dark-border">
                  <th className="text-left py-2 px-3 w-8">#</th>
                  <th className="text-left py-2 px-3">页面路径</th>
                  <th className="text-right py-2 px-3">会话数</th>
                  <th className="text-right py-2 px-3">访客数</th>
                </tr>
              </thead>
              <tbody>
                {exitList.map((p, i) => (
                  <tr key={p.pathname} className="border-b border-dark-border/50 hover:bg-dark-hover">
                    <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                    <td className="py-2 px-3 text-gray-300 truncate max-w-[200px]" title={p.pathname}>{p.pathname}</td>
                    <td className="py-2 px-3 text-right text-white font-medium">{p.sessions.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-gray-400">{p.visitors.toLocaleString()}</td>
                  </tr>
                ))}
                {!exitPages.isLoading && exitList.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">暂无数据</td></tr>
                )}
                {exitPages.isLoading && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">加载中...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 页面流转 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">页面流转路径</h3>
        <p className="text-xs text-gray-500 mb-4">展示用户在页面之间的跳转关系</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-dark-border">
                <th className="text-left py-2 px-3 w-8">#</th>
                <th className="text-left py-2 px-3">来源页面</th>
                <th className="text-center py-2 px-3 w-8">→</th>
                <th className="text-left py-2 px-3">目标页面</th>
                <th className="text-right py-2 px-3">跳转次数</th>
              </tr>
            </thead>
            <tbody>
              {flowList.map((f, i) => (
                <tr key={i} className="border-b border-dark-border/50 hover:bg-dark-hover">
                  <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                  <td className="py-2 px-3 text-gray-300 truncate max-w-[200px]" title={f.from_page}>{f.from_page}</td>
                  <td className="py-2 px-3 text-center text-gold-400">→</td>
                  <td className="py-2 px-3 text-gray-300 truncate max-w-[200px]" title={f.to_page}>{f.to_page}</td>
                  <td className="py-2 px-3 text-right text-white font-medium">{f.count.toLocaleString()}</td>
                </tr>
              ))}
              {!pageFlow.isLoading && flowList.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">暂无页面流转数据</td></tr>
              )}
              {pageFlow.isLoading && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">加载中...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
