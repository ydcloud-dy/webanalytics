interface ReferrerData {
  referrer: string
  visitors: number
  pageviews: number
}

interface Props {
  data?: ReferrerData[]
  loading: boolean
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}

export default function TopReferrers({ data, loading }: Props) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <h3 className="font-bold text-white text-lg mb-1">来源站点</h3>
      <p className="text-xs text-gray-500 mb-4">外部流量来源</p>
      {loading ? (
        <div className="h-64 bg-dark-border/30 rounded-lg animate-pulse" />
      ) : !data || data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-600">暂无数据</div>
      ) : (
        <div className="overflow-auto max-h-80">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-dark-border">
                <th className="text-left pb-3 font-medium">来源</th>
                <th className="text-right pb-3 font-medium">访客数</th>
                <th className="text-right pb-3 font-medium">浏览量</th>
              </tr>
            </thead>
            <tbody>
              {data.map((ref, i) => (
                <tr
                  key={ref.referrer}
                  className="border-b border-dark-border/50 hover:bg-dark-hover transition-colors"
                >
                  <td className="py-3 text-gray-300 truncate max-w-[200px]" title={ref.referrer}>
                    <span className="text-gray-600 mr-2 text-xs">{i + 1}.</span>
                    {shortenUrl(ref.referrer)}
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
        </div>
      )}
    </div>
  )
}
