import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSites, getSiteMembers, addSiteMember, removeSiteMember, getUsers, batchAddMembers, batchRemoveMembers } from '../lib/api'

interface Site {
  id: number
  domain: string
  name: string
}

interface Member {
  user_id: number
  email: string
  role: string
}

interface User {
  id: number
  email: string
  role: string
}

export default function AdminSiteMembersPage() {
  const { siteId } = useParams<{ siteId: string }>()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single')
  const [selectedSite, setSelectedSite] = useState<number>(siteId ? parseInt(siteId) : 0)
  const [showAdd, setShowAdd] = useState(false)
  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState('viewer')

  // Batch tab state
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<number>>(new Set())
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set())
  const [batchRole, setBatchRole] = useState('viewer')
  const [batchMessage, setBatchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: getSites,
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: getUsers,
  })

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['site-members', selectedSite],
    queryFn: () => getSiteMembers(selectedSite),
    enabled: selectedSite > 0,
  })

  const addMutation = useMutation({
    mutationFn: () => addSiteMember(selectedSite, { user_id: parseInt(newUserId), role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-members', selectedSite] })
      setShowAdd(false)
      setNewUserId('')
      setNewRole('viewer')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: number) => removeSiteMember(selectedSite, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['site-members', selectedSite] }),
  })

  const batchAddMutation = useMutation({
    mutationFn: () =>
      batchAddMembers({
        site_ids: Array.from(selectedSiteIds),
        user_ids: Array.from(selectedUserIds),
        role: batchRole,
      }),
    onSuccess: (data: { added: number; skipped: number }) => {
      setBatchMessage({ type: 'success', text: `成功添加 ${data.added} 条，跳过 ${data.skipped} 条` })
      queryClient.invalidateQueries({ queryKey: ['site-members'] })
    },
    onError: () => {
      setBatchMessage({ type: 'error', text: '批量添加失败，请重试' })
    },
  })

  const batchRemoveMutation = useMutation({
    mutationFn: () =>
      batchRemoveMembers({
        site_ids: Array.from(selectedSiteIds),
        user_ids: Array.from(selectedUserIds),
      }),
    onSuccess: (data: { removed: number }) => {
      setBatchMessage({ type: 'success', text: `成功移除 ${data.removed} 条` })
      queryClient.invalidateQueries({ queryKey: ['site-members'] })
    },
    onError: () => {
      setBatchMessage({ type: 'error', text: '批量移除失败，请重试' })
    },
  })

  const nonAdminUsers = users.filter((u) => u.role !== 'admin')

  const toggleSiteId = (id: number) => {
    setSelectedSiteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleUserId = (id: number) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllSites = () => {
    if (selectedSiteIds.size === sites.length) {
      setSelectedSiteIds(new Set())
    } else {
      setSelectedSiteIds(new Set(sites.map((s) => s.id)))
    }
  }

  const toggleAllUsers = () => {
    if (selectedUserIds.size === nonAdminUsers.length) {
      setSelectedUserIds(new Set())
    } else {
      setSelectedUserIds(new Set(nonAdminUsers.map((u) => u.id)))
    }
  }

  const canBatchOperate = selectedSiteIds.size > 0 && selectedUserIds.size > 0

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">站点成员管理</h2>
          <p className="text-xs text-gray-500 mt-1">管理站点的访问权限</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-dark-card border border-dark-border rounded-lg p-1 w-fit">
        <button
          onClick={() => { setActiveTab('single'); setBatchMessage(null) }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'single'
              ? 'bg-gold-500 text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          站点成员管理
        </button>
        <button
          onClick={() => { setActiveTab('batch'); setBatchMessage(null) }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'batch'
              ? 'bg-gold-500 text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          批量授权
        </button>
      </div>

      {activeTab === 'single' && (
        <>
          {/* Site selector */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">选择站点</label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(parseInt(e.target.value))}
              className="px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none min-w-[300px]"
            >
              <option value={0}>-- 请选择站点 --</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.domain})
                </option>
              ))}
            </select>
          </div>

          {selectedSite > 0 && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-gray-300">成员列表</h3>
                <button
                  onClick={() => setShowAdd(true)}
                  className="bg-gold-500 text-black px-4 py-2 rounded-lg hover:bg-gold-400 text-sm font-bold transition-colors"
                >
                  + 添加成员
                </button>
              </div>

              {showAdd && (
                <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6">
                  <h3 className="font-bold text-white mb-4">添加成员</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <select
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      className="px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
                    >
                      <option value="">-- 选择用户 --</option>
                      {users
                        .filter((u) => !members.some((m) => m.user_id === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.email}
                          </option>
                        ))}
                    </select>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
                    >
                      <option value="viewer">查看者 (viewer)</option>
                      <option value="owner">管理者 (owner)</option>
                    </select>
                  </div>
                  {addMutation.isError && (
                    <p className="text-red-400 text-sm mb-3">添加失败，该用户可能已是成员</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => addMutation.mutate()}
                      disabled={!newUserId}
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
              ) : members.length === 0 ? (
                <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center">
                  <p className="text-gray-400">该站点暂无成员</p>
                </div>
              ) : (
                <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-dark-border">
                        <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">用户ID</th>
                        <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">邮箱</th>
                        <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">站点角色</th>
                        <th className="text-right px-6 py-3 text-xs text-gray-500 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.user_id} className="border-b border-dark-border last:border-0 hover:bg-dark-hover">
                          <td className="px-6 py-4 text-sm text-gray-400">{m.user_id}</td>
                          <td className="px-6 py-4 text-sm text-white">{m.email}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                m.role === 'owner'
                                  ? 'bg-gold-500/20 text-gold-400'
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}
                            >
                              {m.role === 'owner' ? '管理者' : '查看者'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                if (confirm(`确定移除成员 ${m.email} 吗？`))
                                  removeMutation.mutate(m.user_id)
                              }}
                              className="text-gray-600 hover:text-red-400 text-sm transition-colors"
                            >
                              移除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'batch' && (
        <>
          {/* Batch message */}
          {batchMessage && (
            <div
              className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                batchMessage.type === 'success'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {batchMessage.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Site selection */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-300">选择站点</h3>
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sites.length > 0 && selectedSiteIds.size === sites.length}
                    onChange={toggleAllSites}
                    className="rounded border-dark-border bg-dark-input text-gold-500 focus:ring-gold-500/50"
                  />
                  全选/取消全选
                </label>
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {sites.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-hover cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSiteIds.has(s.id)}
                      onChange={() => toggleSiteId(s.id)}
                      className="rounded border-dark-border bg-dark-input text-gold-500 focus:ring-gold-500/50"
                    />
                    <span className="text-sm text-white">
                      {s.name} <span className="text-gray-500">({s.domain})</span>
                    </span>
                  </label>
                ))}
                {sites.length === 0 && (
                  <p className="text-gray-500 text-sm px-3 py-2">暂无站点</p>
                )}
              </div>
            </div>

            {/* User selection */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-300">选择用户</h3>
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nonAdminUsers.length > 0 && selectedUserIds.size === nonAdminUsers.length}
                    onChange={toggleAllUsers}
                    className="rounded border-dark-border bg-dark-input text-gold-500 focus:ring-gold-500/50"
                  />
                  全选/取消全选
                </label>
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {nonAdminUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-hover cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(u.id)}
                      onChange={() => toggleUserId(u.id)}
                      className="rounded border-dark-border bg-dark-input text-gold-500 focus:ring-gold-500/50"
                    />
                    <span className="text-sm text-white">{u.email}</span>
                  </label>
                ))}
                {nonAdminUsers.length === 0 && (
                  <p className="text-gray-500 text-sm px-3 py-2">暂无非管理员用户</p>
                )}
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">角色:</label>
                <select
                  value={batchRole}
                  onChange={(e) => setBatchRole(e.target.value)}
                  className="px-3 py-1.5 bg-dark-input border border-dark-border rounded-lg text-white text-sm focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
                >
                  <option value="viewer">查看者</option>
                  <option value="owner">管理者</option>
                </select>
              </div>
              <span className="text-xs text-gray-500">
                已选 {selectedSiteIds.size} 个站点，{selectedUserIds.size} 个用户
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => batchAddMutation.mutate()}
                disabled={!canBatchOperate || batchAddMutation.isPending}
                className="bg-gold-500 text-black px-4 py-2 rounded-lg hover:bg-gold-400 disabled:opacity-50 text-sm font-bold transition-colors"
              >
                {batchAddMutation.isPending ? '处理中...' : '批量添加'}
              </button>
              <button
                onClick={() => {
                  if (confirm(`确定批量移除 ${selectedSiteIds.size} 个站点中的 ${selectedUserIds.size} 个用户吗？`))
                    batchRemoveMutation.mutate()
                }}
                disabled={!canBatchOperate || batchRemoveMutation.isPending}
                className="px-4 py-2 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-50 text-sm font-bold transition-colors"
              >
                {batchRemoveMutation.isPending ? '处理中...' : '批量移除'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
