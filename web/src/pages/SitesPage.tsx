import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSites, createSite, deleteSite } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface Site {
  id: number
  domain: string
  name: string
  tracking_id: string
  timezone: string
  created_at: string
}

export default function SitesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [showAdd, setShowAdd] = useState(false)
  const [domain, setDomain] = useState('')
  const [name, setName] = useState('')

  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: getSites,
  })

  const addMutation = useMutation({
    mutationFn: () => createSite({ domain, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setShowAdd(false)
      setDomain('')
      setName('')
    },
  })

  const delMutation = useMutation({
    mutationFn: (id: number) => deleteSite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sites'] }),
  })

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-sidebar border-b border-dark-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center text-black font-bold text-sm">
              WA
            </div>
            <h1 className="text-xl font-bold text-gold-400">Web Analytics</h1>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('token')
              navigate('/login')
            }}
            className="text-gray-500 hover:text-red-400 text-sm transition-colors"
          >
            退出登录
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">站点管理</h2>
            <p className="text-xs text-gray-500 mt-1">
              {isAdmin ? '管理您的网站和追踪代码' : '查看已分配的站点'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-gold-500 text-black px-4 py-2 rounded-lg hover:bg-gold-400 text-sm font-bold transition-colors"
            >
              + 添加站点
            </button>
          )}
        </div>

        {showAdd && (
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6">
            <h3 className="font-bold text-white mb-4">添加新站点</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                placeholder="域名 (例如: example.com)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
              />
              <input
                placeholder="站点名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => addMutation.mutate()}
                disabled={!domain || !name}
                className="bg-gold-500 text-black px-4 py-2 rounded-lg hover:bg-gold-400 disabled:opacity-50 text-sm font-bold"
              >
                添加
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-lg border border-dark-border text-gray-400 hover:text-white text-sm"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-gray-500">加载中...</p>
        ) : sites.length === 0 ? (
          <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-400 mb-2">暂无站点</p>
            <p className="text-gray-600 text-sm">点击"添加站点"开始追踪您的网站数据</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sites.map((site) => (
              <div
                key={site.id}
                className="bg-dark-card border border-dark-border rounded-xl p-6 flex justify-between items-center hover:border-gold-500/30 transition-all cursor-pointer group"
                onClick={() => navigate(`/dashboard/${site.id}`)}
              >
                <div>
                  <h3 className="font-bold text-white text-lg group-hover:text-gold-400 transition-colors">
                    {site.name}
                  </h3>
                  <p className="text-gray-500 text-sm">{site.domain}</p>
                  <p className="text-gray-600 text-xs mt-1">
                    追踪ID: <code className="text-gold-400/70">{site.tracking_id}</code>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('确定删除这个站点吗？')) delMutation.mutate(site.id)
                      }}
                      className="text-gray-600 hover:text-red-400 text-sm transition-colors"
                    >
                      删除
                    </button>
                  )}
                  <span className="text-gold-500 group-hover:translate-x-1 transition-transform">
                    &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {sites.length > 0 && (
          <div className="mt-8 bg-dark-card border border-dark-border rounded-xl p-6">
            <h3 className="font-bold text-white mb-2">集成指南</h3>
            <p className="text-sm text-gray-500 mb-3">
              将以下代码添加到您网站的 {'<head>'} 标签中：
            </p>
            <pre className="bg-dark-sidebar border border-dark-border text-gold-400 p-4 rounded-lg text-sm overflow-x-auto">
{`<script defer
  data-site-id="${sites[0]?.tracking_id}"
  src="${window.location.origin}/sdk/tracker.js">
</script>`}
            </pre>
          </div>
        )}
      </main>
    </div>
  )
}
