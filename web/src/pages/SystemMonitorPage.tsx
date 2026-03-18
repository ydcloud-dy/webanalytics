import { useState, useEffect, useRef, useCallback } from 'react'
import { getSystemStats } from '../lib/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

interface RuntimeStats {
  goroutines: number
  heap_alloc: number
  heap_sys: number
  gc_pause_ns: number
  num_gc: number
  heap_objects: number
}

interface BufferMetrics {
  current_size: number
  max_size: number
  total_flushed: number
  total_errors: number
  last_flush_duration_ms: number
}

interface SystemStats {
  runtime: RuntimeStats
  buffer: BufferMetrics
  uptime: string
  uptime_sec: number
}

interface TrendPoint {
  time: string
  goroutines: number
  heapMB: number
  bufferSize: number
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatNs(ns: number) {
  if (ns < 1000) return ns + ' ns'
  if (ns < 1000000) return (ns / 1000).toFixed(1) + ' us'
  return (ns / 1000000).toFixed(2) + ' ms'
}

export default function SystemMonitorPage() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const trendRef = useRef<TrendPoint[]>([])

  const fetchStats = useCallback(() => {
    getSystemStats().then((data: SystemStats) => {
      setStats(data)
      const now = new Date()
      const point: TrendPoint = {
        time: now.toLocaleTimeString('zh-CN', { hour12: false }),
        goroutines: data.runtime.goroutines,
        heapMB: Math.round(data.runtime.heap_alloc / (1024 * 1024) * 100) / 100,
        bufferSize: data.buffer.current_size,
      }
      const updated = [...trendRef.current, point].slice(-60)
      trendRef.current = updated
      setTrend(updated)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetchStats()
    const timer = setInterval(fetchStats, 5000)
    return () => clearInterval(timer)
  }, [fetchStats])

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        加载系统指标中...
      </div>
    )
  }

  const bufferPct = stats.buffer.max_size > 0
    ? (stats.buffer.current_size / stats.buffer.max_size) * 100
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">系统监控</h2>
        <div className="text-sm text-gray-400">自动刷新：每 5 秒</div>
      </div>

      {/* 运行时间 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="text-xs text-gray-500 mb-1">运行时间</div>
        <div className="text-2xl font-bold text-gold-400">{stats.uptime}</div>
      </div>

      {/* Go 运行时指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Goroutines" value={stats.runtime.goroutines.toLocaleString()} color="text-green-400" />
        <StatCard label="堆内存使用" value={formatBytes(stats.runtime.heap_alloc)} color="text-blue-400" />
        <StatCard label="堆内存系统" value={formatBytes(stats.runtime.heap_sys)} color="text-purple-400" />
        <StatCard label="GC 暂停" value={formatNs(stats.runtime.gc_pause_ns)} color="text-yellow-400" />
      </div>

      {/* 事件缓冲区 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">事件缓冲区</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-500">当前 / 最大容量</div>
            <div className="text-lg font-bold text-white">
              {stats.buffer.current_size} / {stats.buffer.max_size}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">已刷新总量</div>
            <div className="text-lg font-bold text-green-400">{stats.buffer.total_flushed.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">刷新错误次数</div>
            <div className="text-lg font-bold text-red-400">{stats.buffer.total_errors}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">上次刷新耗时</div>
            <div className="text-lg font-bold text-blue-400">{stats.buffer.last_flush_duration_ms.toFixed(2)} ms</div>
          </div>
        </div>
        {/* 进度条 */}
        <div className="w-full bg-dark-border rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${bufferPct > 80 ? 'bg-red-500' : bufferPct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(bufferPct, 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">缓冲区使用率 {bufferPct.toFixed(1)}%</div>
      </div>

      {/* 趋势图 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="font-bold text-white text-lg mb-4">实时趋势（最近 60 个采样点）</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-gray-500 mb-2">Goroutines</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" stroke="#888" tick={{ fontSize: 10 }} />
                <YAxis stroke="#888" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                <Line type="monotone" dataKey="goroutines" stroke="#4ade80" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-2">堆内存 (MB)</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" stroke="#888" tick={{ fontSize: 10 }} />
                <YAxis stroke="#888" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                <Line type="monotone" dataKey="heapMB" stroke="#60a5fa" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-2">缓冲区大小</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" stroke="#888" tick={{ fontSize: 10 }} />
                <YAxis stroke="#888" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                <Line type="monotone" dataKey="bufferSize" stroke="#a78bfa" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  )
}
