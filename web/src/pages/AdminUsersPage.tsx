import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, deleteUser, updateUser, resetPassword } from '../lib/api'

interface User {
  id: number
  email: string
  role: string
  created_at: string
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState('')

  // Reset password state
  const [resetId, setResetId] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: getUsers,
  })

  const createMutation = useMutation({
    mutationFn: () => createUser({ email, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowCreate(false)
      setEmail('')
      setPassword('')
      setRole('user')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const updateMutation = useMutation({
    mutationFn: () => updateUser(editingId!, { email: editEmail, role: editRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditingId(null)
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => resetPassword(resetId!, newPassword),
    onSuccess: () => {
      setResetId(null)
      setNewPassword('')
    },
  })

  const startEdit = (u: User) => {
    setEditingId(u.id)
    setEditEmail(u.email)
    setEditRole(u.role)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">用户管理</h2>
          <p className="text-xs text-gray-500 mt-1">创建、编辑、删除用户，重置密码</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-gold-500 text-black px-4 py-2 rounded-lg hover:bg-gold-400 text-sm font-bold transition-colors"
        >
          + 创建用户
        </button>
      </div>

      {/* Create user form */}
      {showCreate && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6">
          <h3 className="font-bold text-white mb-4">创建新用户</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <input
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
            />
            <input
              type="password"
              placeholder="密码 (至少8位)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          {createMutation.isError && (
            <p className="text-red-400 text-sm mb-3">创建失败，请检查邮箱是否已存在</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!email || !password || password.length < 8}
              className="bg-gold-500 text-black px-4 py-2 rounded-lg hover:bg-gold-400 disabled:opacity-50 text-sm font-bold"
            >
              创建
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border border-dark-border text-gray-400 hover:text-white text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Reset password dialog */}
      {resetId !== null && (
        <div className="bg-dark-card border border-gold-500/30 rounded-xl p-6 mb-6">
          <h3 className="font-bold text-white mb-4">
            重置密码 — {users.find((u) => u.id === resetId)?.email}
          </h3>
          <div className="flex gap-4 mb-4">
            <input
              type="password"
              placeholder="新密码 (至少8位)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
            />
          </div>
          {resetMutation.isError && (
            <p className="text-red-400 text-sm mb-3">重置失败，请检查密码是否符合要求</p>
          )}
          {resetMutation.isSuccess && (
            <p className="text-green-400 text-sm mb-3">密码已重置</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => resetMutation.mutate()}
              disabled={!newPassword || newPassword.length < 8}
              className="bg-gold-500 text-black px-4 py-2 rounded-lg hover:bg-gold-400 disabled:opacity-50 text-sm font-bold"
            >
              确认重置
            </button>
            <button
              onClick={() => { setResetId(null); setNewPassword('') }}
              className="px-4 py-2 rounded-lg border border-dark-border text-gray-400 hover:text-white text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* User table */}
      {isLoading ? (
        <p className="text-gray-500">加载中...</p>
      ) : (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">ID</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">邮箱</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">角色</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">创建时间</th>
                <th className="text-right px-6 py-3 text-xs text-gray-500 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-dark-border last:border-0 hover:bg-dark-hover">
                  <td className="px-6 py-4 text-sm text-gray-400">{u.id}</td>
                  <td className="px-6 py-4 text-sm">
                    {editingId === u.id ? (
                      <input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="px-2 py-1 bg-dark-input border border-dark-border rounded text-white text-sm w-full"
                      />
                    ) : (
                      <span className="text-white">{u.email}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === u.id ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="bg-dark-input border border-dark-border rounded px-2 py-1 text-sm text-white"
                      >
                        <option value="user">普通用户</option>
                        <option value="admin">管理员</option>
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          u.role === 'admin'
                            ? 'bg-gold-500/20 text-gold-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {u.role === 'admin' ? '管理员' : '普通用户'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {u.created_at ? new Date(u.created_at).toLocaleString('zh-CN') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {editingId === u.id ? (
                      <div className="flex justify-end gap-2">
                        {updateMutation.isError && (
                          <span className="text-red-400 text-xs leading-7">邮箱冲突</span>
                        )}
                        <button
                          onClick={() => updateMutation.mutate()}
                          disabled={!editEmail}
                          className="text-gold-400 hover:text-gold-300 text-sm disabled:opacity-50"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-gray-500 hover:text-gray-300 text-sm"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => startEdit(u)}
                          className="text-gray-500 hover:text-gold-400 text-sm transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => { setResetId(u.id); setNewPassword('') }}
                          className="text-gray-500 hover:text-blue-400 text-sm transition-colors"
                        >
                          重置密码
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`确定删除用户 ${u.email} 吗？`)) deleteMutation.mutate(u.id)
                          }}
                          className="text-gray-500 hover:text-red-400 text-sm transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    )}
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
