import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password })

export const register = (email: string, password: string) =>
  api.post('/auth/register', { email, password })

// Sites
export const getSites = () => api.get('/sites').then((r) => r.data)
export const createSite = (data: { domain: string; name: string; timezone?: string }) =>
  api.post('/sites', data).then((r) => r.data)
export const deleteSite = (id: number) => api.delete(`/sites/${id}`)

// Dashboard
export const getOverview = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/overview`, { params: { from, to } }).then((r) => r.data)

export const getTimeseries = (siteId: number, from: string, to: string, interval?: string) =>
  api.get(`/dashboard/${siteId}/timeseries`, { params: { from, to, interval } }).then((r) => r.data)

export const getChannels = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/channels`, { params: { from, to } }).then((r) => r.data)

export const getBrowsers = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/browsers`, { params: { from, to } }).then((r) => r.data)

export const getDevices = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/devices`, { params: { from, to } }).then((r) => r.data)

export const getGeo = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/geo`, { params: { from, to } }).then((r) => r.data)

export const getGeoRegions = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/geo/regions`, { params: { from, to } }).then((r) => r.data)

export const getPages = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/pages`, { params: { from, to } }).then((r) => r.data)

export const getReferrers = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/referrers`, { params: { from, to } }).then((r) => r.data)

export const getRealtime = (siteId: number) =>
  api.get(`/dashboard/${siteId}/realtime`).then((r) => r.data)

export const getRealtimeOverview = (siteId: number) =>
  api.get(`/dashboard/${siteId}/realtime-overview`).then((r) => r.data)

export const getRecentVisits = (siteId: number) =>
  api.get(`/dashboard/${siteId}/recent-visits`).then((r) => r.data)

export const getRealtimeStats = (siteId: number) =>
  api.get(`/dashboard/${siteId}/realtime-stats`).then((r) => r.data)

export const getQPSTrend = (siteId: number) =>
  api.get(`/dashboard/${siteId}/qps-trend`).then((r) => r.data)

export const getScreenResolutions = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/screen-resolutions`, { params: { from, to } }).then((r) => r.data)

export const getHourlyVisitors = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/hourly-visitors`, { params: { from, to } }).then((r) => r.data)

export const getPagesExt = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/pages-ext`, { params: { from, to } }).then((r) => r.data)

// Performance
export const getPerformanceOverview = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/performance-overview`, { params: { from, to } }).then((r) => r.data)

export const getPerformanceTimeseries = (siteId: number, from: string, to: string, interval?: string) =>
  api.get(`/dashboard/${siteId}/performance-timeseries`, { params: { from, to, interval } }).then((r) => r.data)

export const getPagePerformance = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/page-performance`, { params: { from, to } }).then((r) => r.data)

// Loyalty
export const getLoyalty = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/loyalty`, { params: { from, to } }).then((r) => r.data)

// Errors
export const getErrorOverview = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/error-overview`, { params: { from, to } }).then((r) => r.data)

export const getErrorTimeseries = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/error-timeseries`, { params: { from, to } }).then((r) => r.data)

export const getErrorGroups = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/error-groups`, { params: { from, to } }).then((r) => r.data)

export const getErrorPages = (siteId: number, from: string, to: string) =>
  api.get(`/dashboard/${siteId}/error-pages`, { params: { from, to } }).then((r) => r.data)

// System
export const getSystemStats = () =>
  api.get('/system/stats').then((r) => r.data)

// Auth - current user
export const getMe = () => api.get('/auth/me').then((r) => r.data)

// Admin - User management
export const getUsers = () => api.get('/admin/users').then((r) => r.data)
export const createUser = (data: { email: string; password: string; role: string }) =>
  api.post('/admin/users', data).then((r) => r.data)
export const updateUser = (id: number, data: { email: string; role: string }) =>
  api.put(`/admin/users/${id}`, data)
export const deleteUser = (id: number) => api.delete(`/admin/users/${id}`)
export const resetPassword = (id: number, password: string) =>
  api.put(`/admin/users/${id}/password`, { password })

// Admin - Site member management
export const getSiteMembers = (siteId: number) =>
  api.get(`/admin/sites/${siteId}/members`).then((r) => r.data)
export const addSiteMember = (siteId: number, data: { user_id: number; role: string }) =>
  api.post(`/admin/sites/${siteId}/members`, data).then((r) => r.data)
export const removeSiteMember = (siteId: number, userId: number) =>
  api.delete(`/admin/sites/${siteId}/members/${userId}`)

// Admin - Batch member management
export const batchAddMembers = (data: { site_ids: number[]; user_ids: number[]; role: string }) =>
  api.post('/admin/batch-members', data).then((r) => r.data)
export const batchRemoveMembers = (data: { site_ids: number[]; user_ids: number[] }) =>
  api.post('/admin/batch-members/remove', data).then((r) => r.data)
