// @ts-expect-error react-simple-maps has no type declarations
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { useTheme } from '../contexts/ThemeContext'

interface GeoData {
  country: string
  visitors: number
  pageviews: number
}

interface Props {
  data?: GeoData[]
  loading: boolean
}

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// 中文国名 -> 英文国名映射（GeoJSON 使用英文名）
const zhToEn: Record<string, string> = {
  '中国': 'China', '美国': 'United States of America', '日本': 'Japan',
  '韩国': 'South Korea', '英国': 'United Kingdom', '法国': 'France',
  '德国': 'Germany', '俄罗斯': 'Russia', '加拿大': 'Canada',
  '澳大利亚': 'Australia', '巴西': 'Brazil', '印度': 'India',
  '意大利': 'Italy', '西班牙': 'Spain', '墨西哥': 'Mexico',
  '印度尼西亚': 'Indonesia', '土耳其': 'Turkey', '沙特阿拉伯': 'Saudi Arabia',
  '荷兰': 'Netherlands', '瑞士': 'Switzerland', '瑞典': 'Sweden',
  '波兰': 'Poland', '比利时': 'Belgium', '挪威': 'Norway',
  '奥地利': 'Austria', '以色列': 'Israel', '新加坡': 'Singapore',
  '马来西亚': 'Malaysia', '泰国': 'Thailand', '越南': 'Vietnam',
  '菲律宾': 'Philippines', '阿根廷': 'Argentina', '智利': 'Chile',
  '哥伦比亚': 'Colombia', '南非': 'South Africa', '埃及': 'Egypt',
  '尼日利亚': 'Nigeria', '肯尼亚': 'Kenya', '新西兰': 'New Zealand',
  '爱尔兰': 'Ireland', '丹麦': 'Denmark', '芬兰': 'Finland',
  '葡萄牙': 'Portugal', '希腊': 'Greece', '捷克': 'Czechia',
  '罗马尼亚': 'Romania', '匈牙利': 'Hungary', '乌克兰': 'Ukraine',
  '巴基斯坦': 'Pakistan', '孟加拉国': 'Bangladesh', '伊朗': 'Iran',
  '伊拉克': 'Iraq', '阿联酋': 'United Arab Emirates', '卡塔尔': 'Qatar',
  '秘鲁': 'Peru', '委内瑞拉': 'Venezuela', '古巴': 'Cuba',
  '中国台湾': 'Taiwan', '中国香港': 'Hong Kong',
}

// 构建反向映射: 英文名(小写) -> 所有可能的中文名
const enToZhMap = new Map<string, string>()
for (const [zh, en] of Object.entries(zhToEn)) {
  enToZhMap.set(en.toLowerCase(), zh)
}

export default function GeoMap({ data, loading }: Props) {
  const { isDark } = useTheme()
  const maxVisitors = data?.reduce((max, d) => Math.max(max, d.visitors), 0) ?? 0

  const defaultFill = isDark ? '#2a2a4a' : '#dde1e7'
  const strokeColor = isDark ? '#4a4a6a' : '#c0c4cc'
  const hoverFill = isDark ? '#ffcd1a' : '#3b82f6'

  const getColor = (geoName: string) => {
    if (!data) return defaultFill
    const geoLower = geoName.toLowerCase()
    // 尝试匹配：1) 直接匹配英文名 2) 通过映射找中文名匹配
    const zhName = enToZhMap.get(geoLower)
    const match = data.find((d) => {
      const dLower = d.country.toLowerCase()
      return dLower === geoLower || (zhName && dLower === zhName) || zhToEn[d.country]?.toLowerCase() === geoLower
    })
    if (!match || maxVisitors === 0) return defaultFill
    const intensity = Math.max(0.3, match.visitors / maxVisitors)
    if (isDark) {
      const r = Math.round(230 + (255 - 230) * intensity)
      const g = Math.round(120 + (200 - 120) * intensity)
      return `rgb(${r}, ${g}, 0)`
    } else {
      const r = Math.round(191 + (37 - 191) * intensity)
      const g = Math.round(219 + (99 - 219) * intensity)
      const b = Math.round(254 + (235 - 254) * intensity)
      return `rgb(${r}, ${g}, ${b})`
    }
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-lg">访客地图</h3>
          <p className="text-xs text-gray-500 mt-1">
            {data ? `${data.reduce((s, d) => s + d.visitors, 0).toLocaleString()} 个独立访客` : ''}
          </p>
        </div>
      </div>
      {loading ? (
        <div className="h-72 bg-dark-border/30 rounded-lg animate-pulse" />
      ) : (
        <>
          <div className="h-64">
            <ComposableMap
              projectionConfig={{ scale: 140 }}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup>
                <Geographies geography={GEO_URL}>
                  {({ geographies }: { geographies: any[] }) =>
                    geographies.map((geo: any) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getColor(geo.properties.name)}
                        stroke={strokeColor}
                        strokeWidth={0.5}
                        style={{
                          hover: { fill: hoverFill, outline: 'none' },
                          pressed: { outline: 'none' },
                          default: { outline: 'none' },
                        }}
                      />
                    ))
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          </div>
          {data && data.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.slice(0, 8).map((d) => (
                <span
                  key={d.country}
                  className="text-xs bg-gold-500/10 text-gold-400 px-2 py-1 rounded border border-gold-500/20"
                >
                  {d.country}: {d.visitors.toLocaleString()}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
