import { apiRequest } from './http'

export type AuthRole = 'ADMIN' | 'USER'

export interface AuthUser {
  id: string
  username: string
  displayName: string
  role: AuthRole
  status: 'active' | 'disabled'
  createdAt?: string
}

export interface LoginResult {
  user: AuthUser
  expiresAt: string
}

export const authApi = {
  login(username: string, password: string) {
    return apiRequest<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },
  logout() {
    return apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' })
  },
  me() {
    return apiRequest<{ user: AuthUser }>('/auth/me')
  },
}

export const roleLabel: Record<AuthRole, string> = {
  ADMIN: '系统管理员',
  USER: '训练指导',
}
