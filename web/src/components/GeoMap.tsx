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

export default function GeoMap({ data, loading }: Props) {
  const { isDark } = useTheme()
  const maxVisitors = data?.reduce((max, d) => Math.max(max, d.visitors), 0) ?? 0

  const defaultFill = isDark ? '#2a2a4a' : '#dde1e7'
  const strokeColor = isDark ? '#4a4a6a' : '#c0c4cc'
  const hoverFill = isDark ? '#ffcd1a' : '#3b82f6'

  const getColor = (countryName: string) => {
    if (!data) return defaultFill
    const match = data.find((d) => d.country.toLowerCase() === countryName.toLowerCase())
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
                  {({ geographies }) =>
                    geographies.map((geo) => (
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
