interface PageData {
  pathname: string
  pageviews: number
  visitors: number
}

interface Props {
  data?: PageData[]
  loading: boolean
}

export default function TopPages({ data, loading }: Props) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <h3 className="font-bold text-white text-lg mb-1">热门页面</h3>
      <p className="text-xs text-gray-500 mb-4">页面浏览排行</p>
      {loading ? (
        <div className="h-64 bg-dark-border/30 rounded-lg animate-pulse" />
      ) : !data || data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-600">暂无数据</div>
      ) : (
        <div className="overflow-auto max-h-80">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-dark-border">
                <th className="text-left pb-3 font-medium">页面网址</th>
                <th className="text-right pb-3 font-medium">浏览次数</th>
                <th className="text-right pb-3 font-medium">访客数</th>
              </tr>
            </thead>
            <tbody>
              {data.map((page, i) => (
                <tr
                  key={page.pathname}
                  className="border-b border-dark-border/50 hover:bg-dark-hover transition-colors"
                >
                  <td className="py-3 text-gray-300 truncate max-w-[250px]" title={page.pathname}>
                    <span className="text-gray-600 mr-2 text-xs">{i + 1}.</span>
                    {page.pathname}
                  </td>
                  <td className="py-3 text-right text-gold-400 font-medium">
                    {page.pageviews.toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {page.visitors.toLocaleString()}
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
