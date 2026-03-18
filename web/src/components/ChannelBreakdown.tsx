import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface ChannelData {
  channel: string
  pageviews: number
  visitors: number
  pct: number
}

interface Props {
  data?: ChannelData[]
  loading: boolean
}

const COLORS = ['#e6b400', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#6b7280']

const CHANNEL_NAMES: Record<string, string> = {
  direct: '直接链接',
  search: '搜索引擎',
  social: '社交网络',
  referral: '外部网站',
  internal: '站内跳转',
  '': '未知',
}

export default function ChannelBreakdown({ data, loading }: Props) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <h3 className="font-bold text-white text-lg mb-1">渠道类型</h3>
      <p className="text-xs text-gray-500 mb-4">流量来源分布</p>
      {loading ? (
        <div className="h-64 bg-dark-border/30 rounded-lg animate-pulse" />
      ) : !data || data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-600">暂无数据</div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-4">
            <ResponsiveContainer width="40%" height={180}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="pageviews"
                  nameKey="channel"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={45}
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
            <div className="flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs">
                    <th className="text-left pb-2 font-medium">渠道类型</th>
                    <th className="text-right pb-2 font-medium">访问</th>
                    <th className="text-right pb-2 font-medium">访客数</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, i) => (
                    <tr key={item.channel} className="border-t border-dark-border">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-gray-300">
                            {CHANNEL_NAMES[item.channel] || item.channel}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-gray-400">
                        {item.pageviews.toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-gray-400">
                        {item.visitors.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
