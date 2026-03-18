import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getGeo } from '../lib/api'
import GeoMap from '../components/GeoMap'
import { useDateRange } from '../components/DashboardLayout'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function GeoPage() {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)
  const { rangeDays, setRangeDays } = useDateRange()

  const now = new Date()
  const from = formatDate(new Date(now.getTime() - rangeDays * 86400000))
  const to = formatDate(now)

  const geo = useQuery({
    queryKey: ['geo', id, from, to],
    queryFn: () => getGeo(id, from, to),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">地理位置</h2>
          <p className="text-xs text-gray-500 mt-1">访客地理分布分析</p>
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

      {/* Full-width map */}
      <GeoMap data={geo.data} loading={geo.isLoading} />

      {/* Country table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="font-bold text-white text-lg mb-4">国家</h3>
          {!geo.data || geo.data.length === 0 ? (
            <p className="text-gray-600 text-sm">暂无数据</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-border">
                  <th className="text-left pb-2 font-medium">国家</th>
                  <th className="text-right pb-2 font-medium">访客数</th>
                  <th className="text-right pb-2 font-medium">浏览量</th>
                </tr>
              </thead>
              <tbody>
                {geo.data.map((item: any, i: number) => (
                  <tr key={item.country} className="border-b border-dark-border/50 hover:bg-dark-hover">
                    <td className="py-2.5 text-gray-300">
                      <span className="text-gray-600 mr-2 text-xs">{i + 1}.</span>
                      {item.country}
                    </td>
                    <td className="py-2.5 text-right text-gold-400 font-medium">
                      {item.visitors.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-gray-400">
                      {item.pageviews.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="font-bold text-white text-lg mb-4">地区</h3>
          <p className="text-sm text-gray-500">
            需要 GeoIP 数据库支持，配置 GEOIP_PATH 环境变量指向 MaxMind GeoLite2-City.mmdb 文件后可显示详细地区数据。
          </p>
          <div className="mt-4 p-4 bg-dark-hover rounded-lg border border-dark-border/50">
            <p className="text-xs text-gold-400">配置提示</p>
            <code className="text-xs text-gray-400 block mt-1">
              GEOIP_PATH=/path/to/GeoLite2-City.mmdb
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}
