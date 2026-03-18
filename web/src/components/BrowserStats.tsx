interface BrowserData {
  browser: string
  visitors: number
  pct: number
}

interface Props {
  data?: BrowserData[]
  loading: boolean
}

export default function BrowserStats({ data, loading }: Props) {
  const maxVisitors = data?.reduce((max, d) => Math.max(max, d.visitors), 0) ?? 0

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <h3 className="font-bold text-white text-lg mb-1">浏览器</h3>
      <p className="text-xs text-gray-500 mb-4">浏览器使用分布</p>
      {loading ? (
        <div className="h-64 bg-dark-border/30 rounded-lg animate-pulse" />
      ) : !data || data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-600">暂无数据</div>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.browser}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-300">{item.browser}</span>
                <span className="text-gold-400 font-medium">
                  {item.visitors.toLocaleString()}
                  <span className="text-gray-500 ml-1 text-xs">({item.pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="w-full bg-dark-border rounded-full h-2">
                <div
                  className="bg-gold-500 h-2 rounded-full transition-all"
                  style={{ width: `${maxVisitors > 0 ? (item.visitors / maxVisitors) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
