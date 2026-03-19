import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  getRealtime,
  getRealtimeOverview,
  getRecentVisits,
  getTimeseries,
  getRealtimeStats,
  getQPSTrend,
} from '../lib/api'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function pctChange(current: number, previous: number): string | null {
  if (previous === 0) return current > 0 ? '+100%' : null
  const pct = ((current - previous) / previous) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export default function RealtimePage() {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)

  const now = new Date()
  const today = formatDate(now)

  const realtime = useQuery({
    queryKey: ['realtime', id],
    queryFn: () => getRealtime(id),
    refetchInterval: 5000,
  })

  const rtStats = useQuery({
    queryKey: ['realtime-stats', id],
    queryFn: () => getRealtimeStats(id),
    refetchInterval: 5000,
  })

  const qpsTrend = useQuery({
    queryKey: ['qps-trend', id],
    queryFn: () => getQPSTrend(id),
    refetchInterval: 30000,
  })

  const rtOverview = useQuery({
    queryKey: ['realtime-overview', id],
    queryFn: () => getRealtimeOverview(id),
    refetchInterval: 15000,
  })

  const todayTS = useQuery({
    queryKey: ['timeseries-today', id, today],
    queryFn: () => getTimeseries(id, today, today, 'hour'),
    refetchInterval: 30000,
  })

  const recentVisits = useQuery({
    queryKey: ['recent-visits', id],
    queryFn: () => getRecentVisits(id),
    refetchInterval: 10000,
  })

  const stats = rtStats.data
  const pvChange = stats ? pctChange(stats.today_pv, stats.yesterday_pv) : null
  const uvChange = stats ? pctChange(stats.today_uv, stats.yesterday_uv) : null

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">实时访问</h2>

      {/* Top stat cards: 5 columns */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Online visitors */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 text-center">
          <p className="text-gray-500 text-xs mb-1">当前在线</p>
          <p className="text-3xl font-bold text-gold-400">
            {realtime.data?.visitors ?? 0}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">过去5分钟</p>
        </div>

        {/* Today PV */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 text-center">
          <p className="text-gray-500 text-xs mb-1">今日 PV</p>
          <p className="text-3xl font-bold text-white">
            {stats?.today_pv?.toLocaleString() ?? '—'}
          </p>
          {pvChange && (
            <p
              className={`text-xs mt-1 ${
                pvChange.startsWith('+') ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {pvChange.startsWith('+') ? '↑' : '↓'}
              {pvChange} vs 昨日
            </p>
          )}
        </div>

        {/* Today UV */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 text-center">
          <p className="text-gray-500 text-xs mb-1">今日 UV</p>
          <p className="text-3xl font-bold text-white">
            {stats?.today_uv?.toLocaleString() ?? '—'}
          </p>
          {uvChange && (
            <p
              className={`text-xs mt-1 ${
                uvChange.startsWith('+') ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {uvChange.startsWith('+') ? '↑' : '↓'}
              {uvChange} vs 昨日
            </p>
          )}
        </div>

        {/* 实时 QPS */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 text-center">
          <p className="text-gray-500 text-xs mb-1">实时 QPS</p>
          <p className="text-3xl font-bold text-gold-400">
            {stats?.qps_1m?.toFixed(1) ?? '—'}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            峰值: {stats?.peak_qps?.toFixed(1) ?? '—'}
            {stats?.peak_qps_time ? ` @ ${stats.peak_qps_time.slice(11, 16)}` : ''}
          </p>
        </div>

        {/* Total PV */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 text-center">
          <p className="text-gray-500 text-xs mb-1">累计总 PV</p>
          <p className="text-3xl font-bold text-white">
            {stats?.total_pv?.toLocaleString() ?? '—'}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            总 UV: {stats?.total_uv?.toLocaleString() ?? '—'}
          </p>
        </div>
      </div>

      {/* QPS 趋势 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-2">QPS 趋势</h3>
        <p className="text-xs text-gray-500 mb-4">今日按分钟统计的每秒请求量（含所有事件类型）</p>
        {!qpsTrend.data || qpsTrend.data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-600">
            暂无足够数据生成 QPS 趋势图
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={qpsTrend.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#888', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fill: '#888', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#e6b400' }}
                formatter={(value: number) => [value.toFixed(2), 'QPS']}
              />
              <Line
                type="monotone"
                dataKey="qps"
                stroke="#e6b400"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#e6b400' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Today's hourly chart */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-2">今日小时趋势</h3>
        <p className="text-xs text-gray-500 mb-4">按小时统计的访问数据</p>
        {!todayTS.data || todayTS.data.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-600">
            今日暂无足够数据生成趋势图
          </div>
        ) : (() => {
          const maxVal = Math.max(...todayTS.data.map((p: any) => p.pageviews || 0), 1)
          const barHeight = 128 // px, 柱子最大高度
          return (
          <div className="flex gap-1 items-end" style={{ height: 180 }}>
            {todayTS.data.map((point: any, i: number) => {
              const h = Math.max(4, (point.pageviews / maxVal) * barHeight)
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                  <span className="text-[10px] text-gold-400">{point.pageviews || ''}</span>
                  <div
                    className="w-full bg-gold-500/70 rounded-t"
                    style={{ height: `${h}px` }}
                    title={`${point.time}: ${point.pageviews} 浏览量`}
                  />
                  <span className="text-[10px] text-gray-600">
                    {point.time?.slice(11, 13) || ''}
                  </span>
                </div>
              )
            })}
          </div>
          )
        })()
        }
      </div>

      {/* Traffic overview + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <p className="text-gray-500 text-sm mb-3">流量概览</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-dark-border">
                <th className="text-left pb-2">时段</th>
                <th className="text-right pb-2">访问</th>
                <th className="text-right pb-2">页面浏览</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-dark-border/50">
                <td className="py-2 text-gray-300">最近24小时</td>
                <td className="py-2 text-right text-gold-400 font-medium">
                  {rtOverview.data?.visits_24h?.toLocaleString() ?? '—'}
                </td>
                <td className="py-2 text-right text-gray-400">
                  {rtOverview.data?.pageviews_24h?.toLocaleString() ?? '—'}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-gray-300">最近30分钟</td>
                <td className="py-2 text-right text-gold-400 font-medium">
                  {rtOverview.data?.visits_30m?.toLocaleString() ?? '—'}
                </td>
                <td className="py-2 text-right text-gray-400">
                  {rtOverview.data?.pageviews_30m?.toLocaleString() ?? '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <p className="text-gray-500 text-sm mb-3">状态</p>
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-medium">数据采集正常运行</span>
          </div>
          <p className="text-xs text-gray-600 mt-4">自动刷新: 每5秒</p>
          <p className="text-xs text-gray-600">
            最后更新: {new Date().toLocaleTimeString('zh-CN', { hour12: false })}
          </p>
        </div>
      </div>

      {/* Recent visit log */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">最近访问</h3>
        {!recentVisits.data || recentVisits.data.length === 0 ? (
          <p className="text-sm text-gray-500">
            暂无访问记录。请确保目标网站已嵌入 tracker.js SDK。
          </p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {recentVisits.data.map((v: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 bg-dark-hover rounded-lg border border-dark-border/50"
              >
                <div className="w-8 h-8 bg-gold-500/10 rounded-full flex items-center justify-center text-sm shrink-0">
                  {v.device_type === 'mobile' ? '📱' : '🖥'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-300 truncate font-medium">{v.pathname}</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-500 text-xs shrink-0">{v.browser}</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-500 text-xs shrink-0">{v.os}</span>
                    {v.country && (
                      <>
                        <span className="text-gray-600">·</span>
                        <span className="text-gray-500 text-xs shrink-0">{v.country}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                    <span>{v.time}</span>
                    {v.referrer ? (
                      <span className="text-blue-400 truncate">来自: {v.referrer}</span>
                    ) : (
                      <span>直接链接</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
