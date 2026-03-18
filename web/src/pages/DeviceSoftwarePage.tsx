import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getBrowsers, getDevices, getScreenResolutions } from '../lib/api'
import api from '../lib/api'
import BrowserStats from '../components/BrowserStats'
import DeviceStats from '../components/DeviceStats'
import CalendarPicker from '../components/Calendar'
import { useDateRange } from '../components/DashboardLayout'

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DEVICE_NAMES: Record<string, string> = {
  desktop: '桌面',
  mobile: '智能手机',
  tablet: '平板电脑',
  bot: '爬虫',
}

export default function DeviceSoftwarePage() {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)
  const { rangeDays, setRangeDays, pickedDate, setPickedDate } = useDateRange()

  const now = new Date()
  const today = formatDate(now)

  let from: string
  let to: string
  if (pickedDate) {
    from = pickedDate
    to = pickedDate
  } else {
    from = formatDate(new Date(now.getTime() - rangeDays * 86400000))
    to = today
  }

  const handleRangeDays = (days: number) => {
    setPickedDate(null)
    setRangeDays(days)
  }

  const handleDatePick = (date: string | null) => {
    setPickedDate(date)
  }

  const browsers = useQuery({
    queryKey: ['browsers', id, from, to],
    queryFn: () => getBrowsers(id, from, to),
  })

  const devices = useQuery({
    queryKey: ['devices', id, from, to],
    queryFn: () => getDevices(id, from, to),
  })

  const osStats = useQuery({
    queryKey: ['os', id, from, to],
    queryFn: () => api.get(`/dashboard/${id}/os`, { params: { from, to } }).then((r) => r.data),
  })

  const screenRes = useQuery({
    queryKey: ['screen-resolutions', id, from, to],
    queryFn: () => getScreenResolutions(id, from, to),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">设备与软件</h2>
          <p className="text-xs text-gray-500 mt-1">访客使用的设备、浏览器和操作系统</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Range buttons */}
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
                  !pickedDate && rangeDays === r.days
                    ? 'bg-gold-500 text-black'
                    : 'text-gray-400 hover:text-white hover:bg-dark-hover'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {/* Calendar */}
          <CalendarPicker pickedDate={pickedDate} onDatePick={handleDatePick} />
        </div>
      </div>

      {/* Device type + Device details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeviceStats data={devices.data} loading={devices.isLoading} />

        {/* Device type table */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="font-bold text-white text-lg mb-1">设备类型详情</h3>
          <p className="text-xs text-gray-500 mb-4">按类型统计</p>
          {!devices.data || devices.data.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-600">暂无数据</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-border">
                  <th className="text-left pb-2 font-medium">类型</th>
                  <th className="text-right pb-2 font-medium">访客数</th>
                  <th className="text-right pb-2 font-medium">占比</th>
                </tr>
              </thead>
              <tbody>
                {devices.data.map((item: any) => (
                  <tr key={item.device_type} className="border-b border-dark-border/50 hover:bg-dark-hover">
                    <td className="py-3 text-gray-300">
                      {DEVICE_NAMES[item.device_type] || item.device_type}
                    </td>
                    <td className="py-3 text-right text-gold-400 font-medium">
                      {item.visitors.toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-gray-400">{item.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* OS + Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OS Stats */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="font-bold text-white text-lg mb-1">操作系统版本</h3>
          <p className="text-xs text-gray-500 mb-4">操作系统使用分布</p>
          {osStats.isLoading ? (
            <div className="h-48 bg-dark-border/30 rounded-lg animate-pulse" />
          ) : !osStats.data || osStats.data.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-600">暂无数据</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-border">
                  <th className="text-left pb-2 font-medium">操作系统版本</th>
                  <th className="text-right pb-2 font-medium">访客数</th>
                </tr>
              </thead>
              <tbody>
                {osStats.data.map((item: any) => (
                  <tr key={item.os} className="border-b border-dark-border/50 hover:bg-dark-hover">
                    <td className="py-2.5 text-gray-300">{item.os}</td>
                    <td className="py-2.5 text-right text-gold-400 font-medium">
                      {item.visitors.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <BrowserStats data={browsers.data} loading={browsers.isLoading} />
      </div>

      {/* Screen Resolution */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-1">屏幕分辨率</h3>
        <p className="text-xs text-gray-500 mb-4">访客屏幕分辨率分布</p>
        {screenRes.isLoading ? (
          <div className="h-48 bg-dark-border/30 rounded-lg animate-pulse" />
        ) : !screenRes.data || screenRes.data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-600">暂无数据</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-dark-border">
                <th className="text-left pb-2 font-medium">分辨率</th>
                <th className="text-right pb-2 font-medium">访客数</th>
                <th className="text-right pb-2 font-medium">占比</th>
              </tr>
            </thead>
            <tbody>
              {screenRes.data.map((item: any) => (
                <tr key={item.resolution} className="border-b border-dark-border/50 hover:bg-dark-hover">
                  <td className="py-2.5 text-gray-300">{item.resolution}</td>
                  <td className="py-2.5 text-right text-gold-400 font-medium">
                    {item.visitors.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-gray-400">{item.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
