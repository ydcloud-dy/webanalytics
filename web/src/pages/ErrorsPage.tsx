import { useState, Fragment } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDateRange } from '../components/DashboardLayout'
import CalendarPicker from '../components/Calendar'
import { getErrorOverview, getErrorTimeseries, getErrorGroups, getErrorPages } from '../lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
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

interface ErrorOverview {
  total_errors: number
  js_errors: number
  promise_errors: number
  resource_errors: number
  http_errors: number
  error_rate: number
  affected_pages: number
}

interface ErrorTimeseriesPoint {
  time: string
  js: number
  promise: number
  resource: number
  http: number
}

interface ErrorGroup {
  message: string
  source: string
  filename: string
  count: number
  visitors: number
  last_seen: string
}

interface ErrorPage {
  pathname: string
  total: number
  js: number
  http: number
}

export default function ErrorsPage() {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)
  const { rangeDays, setRangeDays, pickedDate, setPickedDate } = useDateRange()
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

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

  const overview = useQuery({
    queryKey: ['error-overview', id, from, to],
    queryFn: () => getErrorOverview(id, from, to),
  })
  const timeseries = useQuery({
    queryKey: ['error-timeseries', id, from, to],
    queryFn: () => getErrorTimeseries(id, from, to),
  })
  const groups = useQuery({
    queryKey: ['error-groups', id, from, to],
    queryFn: () => getErrorGroups(id, from, to),
  })
  const pages = useQuery({
    queryKey: ['error-pages', id, from, to],
    queryFn: () => getErrorPages(id, from, to),
  })

  const sourceColors: Record<string, string> = {
    js: '#ef4444',
    promise: '#f59e0b',
    resource: '#3b82f6',
    http: '#8b5cf6',
  }

  const sourceLabel: Record<string, string> = {
    js: 'JS 错误',
    promise: 'Promise 异常',
    resource: '资源加载',
    http: 'HTTP 错误',
  }

  const overviewData: ErrorOverview | undefined = overview.data

  return (
    <div className="space-y-6">
      {/* 顶部：标题 + 日期选择 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">错误追踪</h2>
        <div className="flex items-center gap-2">
          <ExportButton type="errors" label="导出" />
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

      {/* 概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card label="总错误数" value={overviewData?.total_errors ?? 0} color="text-red-400" loading={overview.isLoading} />
        <Card label="JS 错误" value={overviewData?.js_errors ?? 0} color="text-red-300" loading={overview.isLoading} />
        <Card label="Promise 异常" value={overviewData?.promise_errors ?? 0} color="text-yellow-400" loading={overview.isLoading} />
        <Card label="资源加载失败" value={overviewData?.resource_errors ?? 0} color="text-blue-400" loading={overview.isLoading} />
        <Card label="HTTP 4xx/5xx" value={overviewData?.http_errors ?? 0} color="text-purple-400" loading={overview.isLoading} />
        <Card label="错误率" value={`${(overviewData?.error_rate ?? 0).toFixed(2)}%`} color="text-orange-400" loading={overview.isLoading} />
      </div>

      {/* 错误趋势图 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">错误趋势</h3>
        {timeseries.isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-gray-500">加载中...</div>
        ) : (timeseries.data ?? []).length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-gray-500">暂无错误趋势数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeseries.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" stroke="#888" tick={{ fontSize: 12 }} />
              <YAxis stroke="#888" tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                labelStyle={{ color: '#ccc' }}
              />
              <Legend />
              <Bar dataKey="js" name="JS 错误" stackId="a" fill={sourceColors.js} />
              <Bar dataKey="promise" name="Promise" stackId="a" fill={sourceColors.promise} />
              <Bar dataKey="resource" name="资源" stackId="a" fill={sourceColors.resource} />
              <Bar dataKey="http" name="HTTP" stackId="a" fill={sourceColors.http} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 错误分组表 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">错误分组</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-dark-border">
                <th className="text-left py-2 px-3">错误信息</th>
                <th className="text-left py-2 px-3">类型</th>
                <th className="text-left py-2 px-3">文件</th>
                <th className="text-right py-2 px-3">次数</th>
                <th className="text-right py-2 px-3">影响访客</th>
                <th className="text-right py-2 px-3">最近发生</th>
              </tr>
            </thead>
            <tbody>
              {(groups.data ?? []).map((g: ErrorGroup, i: number) => (
                <Fragment key={i}>
                <tr
                  className="border-b border-dark-border/50 hover:bg-dark-hover cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                >
                  <td className="py-2 px-3 text-gray-300 max-w-xs truncate">
                    <span className="mr-1 text-gray-600 text-xs">{expandedRow === i ? '▼' : '▶'}</span>
                    {g.message || '-'}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: (sourceColors[g.source] || '#888') + '22', color: sourceColors[g.source] || '#888' }}
                    >
                      {sourceLabel[g.source] || g.source}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-400 max-w-[200px] truncate">
                    {g.filename || '-'}
                  </td>
                  <td className="py-2 px-3 text-right text-white font-medium">{g.count.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-gray-400">{g.visitors.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-gray-500 text-xs">{g.last_seen}</td>
                </tr>
                {expandedRow === i && (
                  <tr className="bg-dark-hover/50">
                    <td colSpan={6} className="px-3 py-4">
                      <div className="space-y-3 text-sm">
                        <DetailBlock label="错误信息" value={g.message} />
                        <DetailBlock label="文件" value={g.filename} />
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>类型: {sourceLabel[g.source] || g.source}</span>
                          <span>次数: {g.count}</span>
                          <span>影响访客: {g.visitors}</span>
                          <span>最近发生: {g.last_seen}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {!groups.isLoading && (groups.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">暂无错误数据</td>
                </tr>
              )}
              {groups.isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">加载中...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 错误页面排行 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">错误页面排行</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-dark-border">
                <th className="text-left py-2 px-3">页面路径</th>
                <th className="text-right py-2 px-3">总错误</th>
                <th className="text-right py-2 px-3">JS 错误</th>
                <th className="text-right py-2 px-3">HTTP 错误</th>
              </tr>
            </thead>
            <tbody>
              {(pages.data ?? []).map((p: ErrorPage, i: number) => (
                <tr key={i} className="border-b border-dark-border/50 hover:bg-dark-hover">
                  <td className="py-2 px-3 text-gray-300">{p.pathname}</td>
                  <td className="py-2 px-3 text-right text-white font-medium">{p.total.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-red-400">{p.js.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-purple-400">{p.http.toLocaleString()}</td>
                </tr>
              ))}
              {!pages.isLoading && (pages.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">暂无错误数据</td>
                </tr>
              )}
              {pages.isLoading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">加载中...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, color, loading }: { label: string; value: string | number; color: string; loading: boolean }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {loading ? (
        <div className="text-2xl font-bold text-gray-600">--</div>
      ) : (
        <div className={`text-2xl font-bold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      )}
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-500 text-xs">{label}</span>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-0.5 rounded bg-dark-border text-gray-400 hover:text-white hover:bg-dark-card transition-colors"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <div className="bg-[#0d1117] border border-dark-border rounded-lg p-3 text-gray-300 text-xs font-mono break-all whitespace-pre-wrap select-all max-h-40 overflow-y-auto">
        {value}
      </div>
    </div>
  )
}
