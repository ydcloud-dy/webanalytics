import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useDateRange } from '../components/DashboardLayout'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getPerformanceOverview,
  getPerformanceTimeseries,
  getPagePerformance,
} from '../lib/api'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatMs(ms: number): string {
  if (!ms || ms <= 0) return '0ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatXLabel(raw: string, interval: string): string {
  // raw from backend: "2026-03-17" for day/week, "2026-03-01" for month, "2026-01-01" for year
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  const mm = d.getMonth() + 1
  const dd = d.getDate()
  switch (interval) {
    case 'day':
      return `${String(mm).padStart(2, '0')}月${String(dd).padStart(2, '0')}日${WEEKDAYS[d.getDay()]}`
    case 'week': {
      const end = new Date(d.getTime() + 6 * 86400000)
      const emm = end.getMonth() + 1
      const edd = end.getDate()
      if (mm === emm) {
        return `${String(mm).padStart(2, '0')}月${String(dd).padStart(2, '0')}日至${String(edd).padStart(2, '0')}日`
      }
      return `${String(mm).padStart(2, '0')}月${String(dd).padStart(2, '0')}日至${String(emm).padStart(2, '0')}月${String(edd).padStart(2, '0')}日`
    }
    case 'month':
      return `${d.getFullYear()}年${String(mm).padStart(2, '0')}月`
    case 'year':
      return `${d.getFullYear()}年`
    default:
      return raw
  }
}

function formatSecondsAxis(ms: number): string {
  if (!ms || ms <= 0) return '0s'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// 填充时间范围内缺失的日期点（空柱子）
function fillTimeseries(
  data: any[] | undefined,
  fromStr: string,
  toStr: string,
  interval: string,
): any[] {
  const empty = {
    avg_network_time: 0,
    avg_server_time: 0,
    avg_transfer_time: 0,
    avg_dom_processing: 0,
    avg_dom_complete: 0,
    avg_on_load_time: 0,
    sample_count: 0,
  }

  // 把后端返回的数据按 time key 索引
  const map = new Map<string, any>()
  if (data) {
    for (const d of data) {
      map.set(d.time, d)
    }
  }

  const result: any[] = []
  const from = new Date(fromStr)
  const to = new Date(toStr)

  const cur = new Date(from)
  while (cur <= to) {
    const key = formatDate(cur)
    result.push(map.get(key) || { time: key, ...empty })

    switch (interval) {
      case 'week':
        cur.setDate(cur.getDate() + 7)
        break
      case 'month':
        cur.setMonth(cur.getMonth() + 1)
        break
      case 'year':
        cur.setFullYear(cur.getFullYear() + 1)
        break
      default: // day
        cur.setDate(cur.getDate() + 1)
        break
    }
  }
  return result
}

type SortField = string
type SortDir = 'asc' | 'desc'

export default function PerformancePage() {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)
  const { rangeDays, setRangeDays } = useDateRange()
  const [interval, setInterval] = useState<string>('day')
  const [sortField, setSortField] = useState<SortField>('unique_pageviews')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const now = new Date()
  const from = formatDate(new Date(now.getTime() - rangeDays * 86400000))
  const to = formatDate(now)

  const overview = useQuery({
    queryKey: ['perf-overview', id, from, to],
    queryFn: () => getPerformanceOverview(id, from, to),
  })

  // 趋势图时间范围由粒度决定：日=近1月，周=近3月，月=近1年，年=近5年
  const tsRange = useMemo(() => {
    const n = new Date()
    let f: Date
    switch (interval) {
      case 'week':
        f = new Date(n.getFullYear(), n.getMonth() - 3, n.getDate())
        break
      case 'month':
        f = new Date(n.getFullYear() - 1, n.getMonth(), n.getDate())
        break
      case 'year':
        f = new Date(n.getFullYear() - 5, n.getMonth(), n.getDate())
        break
      default: // day
        f = new Date(n.getFullYear(), n.getMonth() - 1, n.getDate())
        break
    }
    return { from: formatDate(f), to: formatDate(n) }
  }, [interval])

  const timeseries = useQuery({
    queryKey: ['perf-timeseries', id, tsRange.from, tsRange.to, interval],
    queryFn: () => getPerformanceTimeseries(id, tsRange.from, tsRange.to, interval),
  })

  const filledTimeseries = useMemo(
    () => fillTimeseries(timeseries.data, tsRange.from, tsRange.to, interval),
    [timeseries.data, tsRange.from, tsRange.to, interval],
  )

  const pagePerf = useQuery({
    queryKey: ['page-performance', id, from, to],
    queryFn: () => getPagePerformance(id, from, to),
  })

  const sortedPages = useMemo(() => {
    if (!pagePerf.data) return []
    return [...pagePerf.data].sort((a: any, b: any) => {
      const av = a[sortField] ?? 0
      const bv = b[sortField] ?? 0
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [pagePerf.data, sortField, sortDir])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortIcon = (field: string) => {
    if (sortField !== field) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  function exportData(data: any[], filename: string, format: 'csv' | 'json') {
    let content: string
    let mime: string
    if (format === 'json') {
      content = JSON.stringify(data, null, 2)
      mime = 'application/json'
    } else {
      if (!data.length) return
      const keys = Object.keys(data[0])
      const lines = [keys.join(',')]
      data.forEach((row) => lines.push(keys.map((k) => row[k] ?? '').join(',')))
      content = lines.join('\n')
      mime = 'text/csv'
    }
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const COLORS = {
    network: '#22c55e',
    server: '#f97316',
    transfer: '#ef4444',
    dom_processing: '#3b82f6',
    dom_complete: '#a855f7',
    on_load: '#1e3a5f',
  }

  const overviewCards = overview.data
    ? [
        { label: '平均网络时间', value: formatMs(overview.data.avg_network_time) },
        { label: '平均服务器时间', value: formatMs(overview.data.avg_server_time) },
        { label: '平均传输时间', value: formatMs(overview.data.avg_transfer_time) },
        { label: '平均DOM处理时间', value: formatMs(overview.data.avg_dom_processing) },
        { label: '平均DOM完成时间', value: formatMs(overview.data.avg_dom_complete) },
        { label: '平均OnLoad时间', value: formatMs(overview.data.avg_on_load_time) },
        { label: '平均页面加载时间', value: formatMs(overview.data.avg_page_load_time) },
        { label: '采样数', value: overview.data.sample_count?.toLocaleString() || '0' },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">性能</h2>
          <p className="text-xs text-gray-500 mt-1">页面加载性能分析</p>
        </div>
        <div className="flex gap-1 bg-dark-card border border-dark-border rounded-lg p-1">
          {[
            { label: '7天', days: 7 },
            { label: '30天', days: 30 },
            { label: '90天', days: 90 },
          ].map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1 rounded-md text-sm ${
                rangeDays === r.days
                  ? 'bg-gold-500 text-black font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1: Timeseries Chart */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-white text-lg">页面性能指标的演变</h3>
            <p className="text-xs text-gray-500">
              {interval === 'day' && '近1个月每天'}
              {interval === 'week' && '近3个月每周'}
              {interval === 'month' && '近1年每月'}
              {interval === 'year' && '近5年每年'}
              的平均时间堆叠图（{tsRange.from} ~ {tsRange.to}）
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 bg-dark-bg border border-dark-border rounded-lg p-1">
              {[
                { label: '日', val: 'day' },
                { label: '周', val: 'week' },
                { label: '月', val: 'month' },
                { label: '年', val: 'year' },
              ].map((i) => (
                <button
                  key={i.val}
                  onClick={() => setInterval(i.val)}
                  className={`px-2 py-1 rounded text-xs ${
                    interval === i.val
                      ? 'bg-gold-500 text-black font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => filledTimeseries.length && exportData(filledTimeseries, 'performance-timeseries', 'csv')}
                className="px-2 py-1 rounded text-xs bg-dark-bg border border-dark-border text-gray-400 hover:text-white"
              >
                CSV
              </button>
              <button
                onClick={() => filledTimeseries.length && exportData(filledTimeseries, 'performance-timeseries', 'json')}
                className="px-2 py-1 rounded text-xs bg-dark-bg border border-dark-border text-gray-400 hover:text-white"
              >
                JSON
              </button>
            </div>
          </div>
        </div>
        {timeseries.isLoading ? (
          <div className="h-80 bg-dark-border/30 rounded-lg animate-pulse" />
        ) : filledTimeseries.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-600">暂无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filledTimeseries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="time"
                tickFormatter={(v) => formatXLabel(v, interval)}
                tick={{ fill: '#999', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatSecondsAxis}
                tick={{ fill: '#999', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                labelStyle={{ color: '#ccc', fontWeight: 'bold', marginBottom: 4 }}
                labelFormatter={(v) => {
                  const label = formatXLabel(v as string, interval)
                  const prefix = interval === 'day' ? '日' : interval === 'week' ? '周' : interval === 'month' ? '月' : '年'
                  return `${prefix} ${label}`
                }}
                formatter={(value: number, name: string) => [`${formatMs(value)}`, name]}
                itemSorter={() => 0}
                content={({ payload, label }) => {
                  if (!payload || !payload.length) return null
                  const total = payload.reduce((s, p) => s + ((p.value as number) || 0), 0)
                  const prefix = interval === 'day' ? '日' : interval === 'week' ? '周' : interval === 'month' ? '月' : '年'
                  return (
                    <div style={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                      <div style={{ color: '#ccc', fontWeight: 'bold', marginBottom: 4 }}>
                        {prefix} {formatXLabel(label as string, interval)}
                      </div>
                      {payload.map((entry, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block' }} />
                          <span style={{ color: '#aaa' }}>{formatMs(entry.value as number)}</span>
                          <span style={{ color: '#888' }}>{entry.name}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid #444', marginTop: 4, paddingTop: 4, color: '#fff', fontWeight: 'bold' }}>
                        {formatMs(total)} 总额
                      </div>
                    </div>
                  )
                }}
              />
              <Legend />
              <Bar dataKey="avg_network_time" name="Avg. network time" stackId="perf" fill={COLORS.network} />
              <Bar dataKey="avg_server_time" name="Avg. server time" stackId="perf" fill={COLORS.server} />
              <Bar dataKey="avg_transfer_time" name="平均传输时间" stackId="perf" fill={COLORS.transfer} />
              <Bar dataKey="avg_dom_processing" name="平均DOM处理时间" stackId="perf" fill={COLORS.dom_processing} />
              <Bar dataKey="avg_dom_complete" name="平均DOM完成时间" stackId="perf" fill={COLORS.dom_complete} />
              <Bar dataKey="avg_on_load_time" name="Avg. on load time" stackId="perf" fill={COLORS.on_load} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Section 2: Performance Overview Cards */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-1">Performance Overview</h3>
        <p className="text-xs text-gray-500 mb-4">各性能阶段的平均耗时</p>
        {overview.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-dark-border/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !overview.data ? (
          <div className="h-32 flex items-center justify-center text-gray-600">暂无数据</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {overviewCards.map((card) => (
              <div
                key={card.label}
                className="bg-dark-bg border border-dark-border rounded-lg p-4"
              >
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className="text-xl font-bold text-gold-400">{card.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Page Performance Table */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-white text-lg">网页网址性能</h3>
            <p className="text-xs text-gray-500">按页面网址统计性能数据</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => sortedPages.length && exportData(sortedPages, 'page-performance', 'csv')}
              className="px-2 py-1 rounded text-xs bg-dark-bg border border-dark-border text-gray-400 hover:text-white"
            >
              CSV
            </button>
            <button
              onClick={() => sortedPages.length && exportData(sortedPages, 'page-performance', 'json')}
              className="px-2 py-1 rounded text-xs bg-dark-bg border border-dark-border text-gray-400 hover:text-white"
            >
              JSON
            </button>
          </div>
        </div>
        {pagePerf.isLoading ? (
          <div className="h-48 bg-dark-border/30 rounded-lg animate-pulse" />
        ) : !sortedPages.length ? (
          <div className="h-48 flex items-center justify-center text-gray-600">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-border">
                  <th className="text-left pb-3 font-medium">页面网址</th>
                  {[
                    { key: 'unique_pageviews', label: '唯一页面浏览量' },
                    { key: 'avg_network_time', label: '平均网络时间' },
                    { key: 'avg_server_time', label: '平均服务器时间' },
                    { key: 'avg_transfer_time', label: '平均传输时间' },
                    { key: 'avg_dom_processing', label: '平均DOM处理' },
                    { key: 'avg_dom_complete', label: '平均DOM完成' },
                    { key: 'avg_on_load_time', label: '平均OnLoad' },
                    { key: 'avg_page_load_time', label: '平均页面加载' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="text-right pb-3 font-medium cursor-pointer hover:text-gray-300 select-none"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}{sortIcon(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPages.map((page: any) => (
                  <tr
                    key={page.pathname}
                    className="border-b border-dark-border/50 hover:bg-dark-hover transition-colors"
                  >
                    <td className="py-3 text-gray-300 max-w-xs truncate" title={page.pathname}>
                      {page.pathname}
                    </td>
                    <td className="py-3 text-right text-gold-400 font-medium">
                      {(page.unique_pageviews ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-gray-400">{formatMs(page.avg_network_time)}</td>
                    <td className="py-3 text-right text-gray-400">{formatMs(page.avg_server_time)}</td>
                    <td className="py-3 text-right text-gray-400">{formatMs(page.avg_transfer_time)}</td>
                    <td className="py-3 text-right text-gray-400">{formatMs(page.avg_dom_processing)}</td>
                    <td className="py-3 text-right text-gray-400">{formatMs(page.avg_dom_complete)}</td>
                    <td className="py-3 text-right text-gray-400">{formatMs(page.avg_on_load_time)}</td>
                    <td className="py-3 text-right text-gray-400">{formatMs(page.avg_page_load_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
