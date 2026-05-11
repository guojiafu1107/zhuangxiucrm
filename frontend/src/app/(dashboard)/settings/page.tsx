'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_LABELS } from '@/lib/utils'

interface Tenant {
  name: string
  domain: string
  logo_url: string
}

interface Member {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
}

export default function SettingsPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tenantRes, membersRes] = await Promise.all([
          api.get('/api/v1/admin/tenant'),
          api.get('/api/v1/admin/users'),
        ])
        setTenant(tenantRes.data)
        setMembers(membersRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="text-center py-12 text-gray-500">加载中...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
        <p className="mt-1 text-sm text-gray-500">企业管理与配置</p>
      </div>

      <Card title="企业信息">
        <div className="space-y-4">
          <Input label="企业名称" value={tenant?.name || ''} disabled />
          <Input label="域名" value={tenant?.domain || '-'} disabled />
          {isOwner && <Button onClick={() => alert('企业信息编辑功能开发中')}>保存修改</Button>}
        </div>
      </Card>

      <Card title="团队成员" description={`共 ${members.length} 名成员`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">姓名</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">邮箱</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">角色</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">状态</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium text-gray-900">{member.name}</td>
                  <td className="py-3 px-4 text-gray-500">{member.email}</td>
                  <td className="py-3 px-4">{ROLE_LABELS[member.role] || member.role}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        member.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {member.is_active ? '正常' : '已禁用'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isOwner && (
          <div className="mt-4">
            <Button variant="outline" onClick={() => alert('邀请成员功能开发中')}>邀请成员</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
