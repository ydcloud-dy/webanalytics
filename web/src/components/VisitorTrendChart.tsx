import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface DataPoint {
  time: string
  pageviews: number
  visitors: number
  sessions: number
}

interface Props {
  data?: DataPoint[]
  loading: boolean
}

export default function VisitorTrendChart({ data, loading }: Props) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-lg">访客趋势图</h3>
          <p className="text-xs text-gray-500 mt-1">实时监控访问数据变化</p>
        </div>
      </div>
      {loading ? (
        <div className="h-72 bg-dark-border/30 rounded-lg animate-pulse" />
      ) : !data || data.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-gray-600">暂无数据</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: 'var(--chart-text)' }}
              tickFormatter={(v) => {
                if (v.length > 10) return v.slice(11, 16)
                return v.slice(5)
              }}
              axisLine={{ stroke: 'var(--chart-grid)' }}
            />
            <YAxis tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={{ stroke: 'var(--chart-grid)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--chart-tooltip-bg)',
                border: '1px solid var(--chart-tooltip-border)',
                borderRadius: '8px',
                color: 'var(--chart-tooltip-text)',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="visitors"
              stroke="var(--chart-line-1)"
              strokeWidth={2}
              dot={{ fill: 'var(--chart-line-1)', r: 3 }}
              name="访客数"
            />
            <Line
              type="monotone"
              dataKey="pageviews"
              stroke="var(--chart-line-2)"
              strokeWidth={2}
              dot={{ fill: 'var(--chart-line-2)', r: 3 }}
              name="浏览量"
            />
            <Line
              type="monotone"
              dataKey="sessions"
              stroke="var(--chart-line-3)"
              strokeWidth={2}
              dot={{ fill: 'var(--chart-line-3)', r: 3 }}
              name="会话数"
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
