import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = isRegister ? register : login
      const res = await fn(email, password)
      localStorage.setItem('token', res.data.token)
      refresh()
      navigate('/sites')
    } catch (err: any) {
      setError(err.response?.data || '发生错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="max-w-md w-full bg-dark-card border border-dark-border rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gold-500 rounded-xl flex items-center justify-center text-black font-bold text-xl mx-auto mb-3">
            WA
          </div>
          <h1 className="text-2xl font-bold text-white">Web Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isRegister ? '创建新账户' : '登录到分析平台'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2.5 bg-dark-input border border-dark-border rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-colors"
              placeholder="至少8个字符"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold-500 text-black py-2.5 px-4 rounded-lg hover:bg-gold-400 disabled:opacity-50 font-bold transition-colors"
          >
            {loading ? '请稍候...' : isRegister ? '注册' : '登录'}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-gray-500">
          {isRegister ? '已有账户？' : '还没有账户？'}{' '}
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-gold-400 hover:text-gold-300 font-medium"
          >
            {isRegister ? '去登录' : '注册'}
          </button>
        </p>
      </div>
    </div>
  )
}
