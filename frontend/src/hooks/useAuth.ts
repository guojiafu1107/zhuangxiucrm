import { create } from 'zustand'
import { api } from '@/lib/api-client'

interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  is_active: boolean
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchUser: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const res = await api.post('/api/v1/auth/login', { email, password })
    if (!res.data || !res.data.access_token) {
      throw new Error('登录响应数据异常')
    }
    localStorage.setItem('access_token', res.data.access_token)
    localStorage.setItem('refresh_token', res.data.refresh_token)
    // Fetch user info
    const userRes = await api.get('/api/v1/auth/me')
    set({ user: userRes.data, isAuthenticated: true, isLoading: false })
  },

  logout: async () => {
    try {
      await api.post('/api/v1/auth/logout')
    } catch {
      // ignore
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false, isLoading: false })
  },

  fetchUser: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }
    try {
      const res = await api.get('/api/v1/auth/me')
      set({ user: res.data, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
