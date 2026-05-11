'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Building2 } from 'lucide-react'

export default function RegisterPage() {
  const [form, setForm] = useState({
    company_name: '',
    name: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/api/v1/auth/register', form, { skipAuth: true })
      router.push('/login?registered=1')
    } catch (err: any) {
      setError(err.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">注册企业账号</h1>
          <p className="mt-1 text-sm text-gray-500">创建您的装修企业 CRM</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
          <Input
            label="企业名称"
            placeholder="请输入企业名称"
            value={form.company_name}
            onChange={(e) => updateField('company_name', e.target.value)}
            required
          />
          <Input
            label="您的姓名"
            placeholder="请输入姓名"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            required
          />
          <Input
            label="邮箱"
            type="email"
            placeholder="请输入邮箱"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            required
          />
          <Input
            label="密码"
            type="password"
            placeholder="至少6位密码"
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            minLength={6}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <a href="/login" className="text-sm text-primary-600 hover:underline">
            已有账号？立即登录
          </a>
        </div>
      </Card>
    </div>
  )
}
