import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface DeviceData {
  device_type: string
  visitors: number
  pct: number
}

interface Props {
  data?: DeviceData[]
  loading: boolean
}

const DEVICE_NAMES: Record<string, string> = {
  desktop: '桌面',
  mobile: '智能手机',
  tablet: '平板电脑',
  bot: '爬虫',
}

const COLORS: Record<string, string> = {
  desktop: '#e6b400',
  mobile: '#10b981',
  tablet: '#3b82f6',
  bot: '#6b7280',
}

export default function DeviceStats({ data, loading }: Props) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <h3 className="font-bold text-white text-lg mb-1">设备类型</h3>
      <p className="text-xs text-gray-500 mb-4">访问设备分布</p>
      {loading ? (
        <div className="h-64 bg-dark-border/30 rounded-lg animate-pulse" />
      ) : !data || data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-600">暂无数据</div>
      ) : (
        <div className="flex items-center gap-6">
          <ResponsiveContainer width="45%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="visitors"
                nameKey="device_type"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.device_type} fill={COLORS[entry.device_type] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--chart-tooltip-bg)',
                  border: '1px solid var(--chart-tooltip-border)',
                  borderRadius: '8px',
                  color: 'var(--chart-tooltip-text)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-3">
            {data.map((item) => (
              <div key={item.device_type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[item.device_type] || '#6b7280' }}
                  />
                  <span className="text-sm text-gray-300">
                    {DEVICE_NAMES[item.device_type] || item.device_type}
                  </span>
                </div>
                <span className="text-sm text-gold-400 font-medium">
                  {item.visitors.toLocaleString()}
                  <span className="text-gray-500 ml-1 text-xs">({item.pct.toFixed(1)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
