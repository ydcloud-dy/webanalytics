import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPagesExt, getReferrers } from '../lib/api'
import { useDateRange } from '../components/DashboardLayout'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PagesPage() {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)
  const { rangeDays, setRangeDays } = useDateRange()

  const now = new Date()
  const from = formatDate(new Date(now.getTime() - rangeDays * 86400000))
  const to = formatDate(now)

  const pages = useQuery({
    queryKey: ['pages-ext', id, from, to],
    queryFn: () => getPagesExt(id, from, to),
  })

  const referrers = useQuery({
    queryKey: ['referrers', id, from, to],
    queryFn: () => getReferrers(id, from, to),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">页面</h2>
          <p className="text-xs text-gray-500 mt-1">页面浏览数据分析</p>
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

      {/* Full-width pages table */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-1">页面</h3>
        <p className="text-xs text-gray-500 mb-4">按页面网址统计浏览数据</p>
        {pages.isLoading ? (
          <div className="h-48 bg-dark-border/30 rounded-lg animate-pulse" />
        ) : !pages.data || pages.data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-600">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-border">
                  <th className="text-left pb-3 font-medium">页面网址</th>
                  <th className="text-right pb-3 font-medium">浏览次数</th>
                  <th className="text-right pb-3 font-medium">唯一页面浏览量</th>
                  <th className="text-right pb-3 font-medium">跳出率</th>
                  <th className="text-right pb-3 font-medium">平均停留时间</th>
                </tr>
              </thead>
              <tbody>
                {pages.data.map((page: any) => (
                  <tr
                    key={page.pathname}
                    className="border-b border-dark-border/50 hover:bg-dark-hover transition-colors"
                  >
                    <td className="py-3 text-gray-300">
                      <span className="hover:text-gold-400 cursor-default" title={page.pathname}>
                        {page.pathname}
                      </span>
                    </td>
                    <td className="py-3 text-right text-gold-400 font-medium">
                      {page.pageviews.toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-gray-400">
                      {page.visitors.toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-gray-400">
                      {page.bounce_rate.toFixed(0)}%
                    </td>
                    <td className="py-3 text-right text-gray-400">
                      {formatDuration(page.avg_duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-dark-border">
                  <td className="py-3 text-gray-500 text-sm font-medium">
                    共 {pages.data.length} 个页面
                  </td>
                  <td className="py-3 text-right text-gold-400 font-bold">
                    {pages.data.reduce((s: number, p: any) => s + p.pageviews, 0).toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-gray-400 font-medium">
                    {pages.data.reduce((s: number, p: any) => s + p.visitors, 0).toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-gray-500">—</td>
                  <td className="py-3 text-right text-gray-500">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Referrers full table */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-1">来源站点</h3>
        <p className="text-xs text-gray-500 mb-4">外部流量来源明细</p>
        {referrers.isLoading ? (
          <div className="h-48 bg-dark-border/30 rounded-lg animate-pulse" />
        ) : !referrers.data || referrers.data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-600">暂无数据</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-dark-border">
                <th className="text-left pb-3 font-medium">#</th>
                <th className="text-left pb-3 font-medium">来源网址</th>
                <th className="text-right pb-3 font-medium">访客数</th>
                <th className="text-right pb-3 font-medium">浏览量</th>
              </tr>
            </thead>
            <tbody>
              {referrers.data.map((ref: any, i: number) => (
                <tr
                  key={ref.referrer}
                  className="border-b border-dark-border/50 hover:bg-dark-hover transition-colors"
                >
                  <td className="py-3 text-gray-600 text-xs w-8">{i + 1}</td>
                  <td className="py-3 text-gray-300 truncate max-w-md" title={ref.referrer}>
                    {ref.referrer}
                  </td>
                  <td className="py-3 text-right text-gold-400 font-medium">
                    {ref.visitors.toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {ref.pageviews.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
