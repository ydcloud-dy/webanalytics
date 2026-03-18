import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getGeo, getGeoRegions } from '../lib/api'
import GeoMap from '../components/GeoMap'
import CalendarPicker from '../components/Calendar'
import { useDateRange } from '../components/DashboardLayout'
import ExportButton from '../components/ExportButton'

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function GeoPage() {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)
  const { rangeDays, setRangeDays, pickedDate, setPickedDate } = useDateRange()
  const effectiveDays = rangeDays || 7

  const now = new Date()
  const today = formatDate(now)

  let from: string
  let to: string
  if (pickedDate) {
    from = pickedDate
    to = pickedDate
  } else {
    from = formatDate(new Date(now.getTime() - effectiveDays * 86400000))
    to = today
  }

  const handleRangeDays = (days: number) => {
    setPickedDate(null)
    setRangeDays(days)
  }

  const handleDatePick = (date: string | null) => {
    setPickedDate(date)
  }

  const geo = useQuery({
    queryKey: ['geo', id, from, to],
    queryFn: () => getGeo(id, from, to),
  })

  const regions = useQuery({
    queryKey: ['geo-regions', id, from, to],
    queryFn: () => getGeoRegions(id, from, to),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">地理位置</h2>
          <p className="text-xs text-gray-500 mt-1">访客地理分布分析</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton type="geo" label="导出" />
          <div className="flex gap-1 bg-dark-card border border-dark-border rounded-lg p-1">
            {[
              { label: '7天', days: 7 },
              { label: '30天', days: 30 },
              { label: '90天', days: 90 },
            ].map((r) => (
              <button
                key={r.days}
                onClick={() => handleRangeDays(r.days)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  !pickedDate && effectiveDays === r.days
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

      {/* Full-width map */}
      <GeoMap data={geo.data} loading={geo.isLoading} />

      {/* Country + Region tables */}
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
          {!regions.data || regions.data.length === 0 ? (
            <p className="text-gray-600 text-sm">暂无数据</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-border">
                  <th className="text-left pb-2 font-medium">地区</th>
                  <th className="text-right pb-2 font-medium">访客数</th>
                  <th className="text-right pb-2 font-medium">浏览量</th>
                </tr>
              </thead>
              <tbody>
                {regions.data.map((item: any, i: number) => (
                  <tr key={item.region} className="border-b border-dark-border/50 hover:bg-dark-hover">
                    <td className="py-2.5 text-gray-300">
                      <span className="text-gray-600 mr-2 text-xs">{i + 1}.</span>
                      {item.region}
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
      </div>
    </div>
  )
}
