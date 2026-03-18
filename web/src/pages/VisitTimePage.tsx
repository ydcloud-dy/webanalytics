import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getHourlyVisitors } from '../lib/api'
import CalendarPicker from '../components/Calendar'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function VisitTimePage() {
  const { siteId } = useParams<{ siteId: string }>()
  const id = Number(siteId)
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))

  const hourly = useQuery({
    queryKey: ['hourly-visitors', id, selectedDate],
    queryFn: () => getHourlyVisitors(id, selectedDate, selectedDate),
  })

  const chartData = (hourly.data || []).map((p: any) => ({
    ...p,
    label: `${p.hour}时`,
  }))

  const totalVisitors = chartData.reduce((s: number, p: any) => s + (p.visitors || 0), 0)
  const peakHour = chartData.reduce(
    (max: any, p: any) => (p.visitors > (max?.visitors || 0) ? p : max),
    chartData[0]
  )

  const today = formatDate(new Date())

  // Navigate to previous/next day
  const changeDate = (delta: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    const newDate = formatDate(d)
    if (newDate <= today) {
      setSelectedDate(newDate)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">访问时间</h2>
          <p className="text-xs text-gray-500 mt-1">按小时统计的访客分布</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDate(-1)}
            className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border text-gray-400 hover:text-white hover:bg-dark-hover text-sm"
          >
            &lt;
          </button>
          <CalendarPicker
            pickedDate={selectedDate}
            onDatePick={(date) => setSelectedDate(date || formatDate(new Date()))}
          />
          <button
            onClick={() => changeDate(1)}
            disabled={selectedDate >= today}
            className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border text-gray-400 hover:text-white hover:bg-dark-hover text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &gt;
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 text-center">
          <p className="text-gray-500 text-xs mb-1">当日总访客</p>
          <p className="text-3xl font-bold text-gold-400">
            {totalVisitors.toLocaleString()}
          </p>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 text-center">
          <p className="text-gray-500 text-xs mb-1">高峰时段</p>
          <p className="text-3xl font-bold text-white">
            {peakHour ? `${peakHour.hour}:00` : '—'}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            {peakHour ? `${peakHour.visitors.toLocaleString()} 访客` : ''}
          </p>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 text-center">
          <p className="text-gray-500 text-xs mb-1">平均每小时</p>
          <p className="text-3xl font-bold text-white">
            {totalVisitors > 0 ? Math.round(totalVisitors / 24).toLocaleString() : '0'}
          </p>
        </div>
      </div>

      {/* Hourly bar chart */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-2">每小时访客数</h3>
        <p className="text-xs text-gray-500 mb-4">{selectedDate} 24小时访客分布</p>
        {hourly.isLoading ? (
          <div className="h-72 bg-dark-border/30 rounded-lg animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#888', fontSize: 11 }}
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
                formatter={(value: number) => [value.toLocaleString(), '访客数']}
              />
              <Bar
                dataKey="visitors"
                fill="#e6b400"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Hourly detail table */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">逐时明细</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-dark-border">
              <th className="text-left pb-2 font-medium">时段</th>
              <th className="text-right pb-2 font-medium">访客数</th>
              <th className="text-right pb-2 font-medium">占比</th>
              <th className="text-left pb-2 font-medium pl-4">分布</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((item: any) => {
              const pct = totalVisitors > 0 ? (item.visitors / totalVisitors) * 100 : 0
              const maxVisitors = peakHour?.visitors || 1
              const barWidth = (item.visitors / maxVisitors) * 100
              return (
                <tr key={item.hour} className="border-b border-dark-border/50 hover:bg-dark-hover">
                  <td className="py-2 text-gray-300">{item.hour}:00 - {item.hour}:59</td>
                  <td className="py-2 text-right text-gold-400 font-medium">
                    {item.visitors.toLocaleString()}
                  </td>
                  <td className="py-2 text-right text-gray-400">{pct.toFixed(1)}%</td>
                  <td className="py-2 pl-4 w-1/3">
                    <div className="w-full bg-dark-border rounded-full h-2">
                      <div
                        className="bg-gold-500/70 h-2 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
