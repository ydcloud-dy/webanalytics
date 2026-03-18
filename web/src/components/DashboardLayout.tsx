import { useState, useEffect } from 'react'
import { Outlet, NavLink, useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'

export interface DateRangeContext {
  rangeDays: number
  setRangeDays: (days: number) => void
  pickedDate: string | null
  setPickedDate: (date: string | null) => void
}

export function useDateRange() {
  return useOutletContext<DateRangeContext>()
}

interface NavItem {
  label: string
  path: string
  icon: string
}

interface NavGroup {
  title: string
  icon: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: '访客分析',
    icon: '👥',
    items: [
      { label: '概览', path: '', icon: '📊' },
      { label: '实时访问', path: '/realtime', icon: '⚡' },
      { label: '地理位置', path: '/geo', icon: '🌍' },
      { label: '设备与软件', path: '/devices', icon: '💻' },
      { label: '访问时间', path: '/visit-time', icon: '🕐' },
      { label: 'IP 排行', path: '/ip-ranking', icon: '🔢' },
    ],
  },
  {
    title: '行为分析',
    icon: '🎯',
    items: [
      { label: '页面', path: '/pages', icon: '📄' },
      { label: '性能', path: '/performance', icon: '⚡' },
      { label: '忠诚度', path: '/loyalty', icon: '💎' },
      { label: '错误追踪', path: '/errors', icon: '🐛' },
      { label: '用户路径', path: '/user-path', icon: '🛤' },
    ],
  },
]

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const d = time
  return (
    <div className="text-right">
      <div className="text-sm text-gray-400">
        {d.getFullYear()}年{d.getMonth() + 1}月{d.getDate()}日 星期{weekdays[d.getDay()]}
      </div>
      <div className="text-2xl font-bold text-gold-400 tabular-nums">
        {d.toLocaleTimeString('zh-CN', { hour12: false })}
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 rounded-full bg-dark-border transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500/50"
      title={isDark ? '切换到浅色主题' : '切换到深色主题'}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-gold-500 flex items-center justify-center text-xs transition-transform ${
          isDark ? 'translate-x-7' : 'translate-x-0'
        }`}
      >
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  )
}

export default function DashboardLayout() {
  const { siteId } = useParams<{ siteId: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const basePath = `/dashboard/${siteId}`
  const [rangeDays, setRangeDays] = useState(7)
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '访客分析': true,
    '行为分析': true,
    '系统管理': true,
  })

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-dark-bg">
      {/* Sidebar */}
      <aside className="w-56 bg-dark-sidebar border-r border-dark-border flex flex-col fixed h-full z-20">
        {/* Logo */}
        <div className="p-4 border-b border-dark-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center text-black font-bold text-sm">
              WA
            </div>
            <span className="text-gold-400 font-bold text-lg">Web Analytics</span>
          </div>
        </div>

        {/* Site selector */}
        <div className="p-3 border-b border-dark-border">
          <button
            onClick={() => navigate('/sites')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-hover text-sm text-gray-300 hover:text-gold-400 transition-colors"
          >
            <span>🌐</span>
            <span className="truncate">站点管理</span>
            <span className="ml-auto text-xs text-gray-500">&rarr;</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-1">
              <button
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                <span>{group.icon}</span>
                <span className="font-medium">{group.title}</span>
                <span className="ml-auto text-xs">
                  {expandedGroups[group.title] ? '▼' : '▶'}
                </span>
              </button>
              {expandedGroups[group.title] && (
                <div className="ml-4">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={basePath + item.path}
                      end={item.path === ''}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2 text-sm rounded-l-lg transition-colors ${
                          isActive
                            ? 'bg-gold-500/10 text-gold-400 border-r-2 border-gold-500'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-dark-hover'
                        }`
                      }
                    >
                      <span className="text-xs">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isAdmin && (
            <div className="mb-1">
              <button
                onClick={() => toggleGroup('系统管理')}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                <span>&#9881;</span>
                <span className="font-medium">系统管理</span>
                <span className="ml-auto text-xs">
                  {expandedGroups['系统管理'] ? '▼' : '▶'}
                </span>
              </button>
              {expandedGroups['系统管理'] && (
                <div className="ml-4">
                  <NavLink
                    to={basePath + '/admin/users'}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 text-sm rounded-l-lg transition-colors ${
                        isActive
                          ? 'bg-gold-500/10 text-gold-400 border-r-2 border-gold-500'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-dark-hover'
                      }`
                    }
                  >
                    <span className="text-xs">&#128101;</span>
                    <span>用户管理</span>
                  </NavLink>
                  <NavLink
                    to={basePath + '/admin/members'}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 text-sm rounded-l-lg transition-colors ${
                        isActive
                          ? 'bg-gold-500/10 text-gold-400 border-r-2 border-gold-500'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-dark-hover'
                      }`
                    }
                  >
                    <span className="text-xs">&#128279;</span>
                    <span>成员管理</span>
                  </NavLink>
                  <NavLink
                    to={basePath + '/admin/system'}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 text-sm rounded-l-lg transition-colors ${
                        isActive
                          ? 'bg-gold-500/10 text-gold-400 border-r-2 border-gold-500'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-dark-hover'
                      }`
                    }
                  >
                    <span className="text-xs">&#128200;</span>
                    <span>系统监控</span>
                  </NavLink>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-dark-border space-y-2">
          <div className="flex items-center justify-between px-3">
            <span className="text-xs text-gray-500">主题</span>
            <ThemeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-dark-hover transition-colors"
          >
            <span>🚪</span>
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-56">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-dark-bg/80 backdrop-blur-sm border-b border-dark-border px-6 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">数据分析平台</h1>
            <p className="text-xs text-gray-500">实时监控网站访问数据，智能分析用户行为</p>
          </div>
          <Clock />
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet context={{ rangeDays, setRangeDays, pickedDate, setPickedDate }} />
        </main>
      </div>
    </div>
  )
}
