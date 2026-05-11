'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, FolderKanban, DollarSign, TrendingUp } from 'lucide-react'

interface DashboardData {
  sales_funnel: { stage: string; count: number }[]
  profit: { total_contract_amount: number; project_counts: Record<string, number> }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [funnelRes, profitRes] = await Promise.all([
          api.get('/api/v1/reports/sales-funnel'),
          api.get('/api/v1/reports/profit'),
        ])
        setData({
          sales_funnel: funnelRes.data,
          profit: profitRes.data,
        })
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  const statsCards = [
    {
      title: '总客户数',
      value: data?.sales_funnel.reduce((sum, s) => sum + s.count, 0) || 0,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: '在建项目',
      value: data?.profit.project_counts['施工中'] || 0,
      icon: FolderKanban,
      color: 'text-green-600 bg-green-50',
    },
    {
      title: '合同总额',
      value: `¥${(data?.profit.total_contract_amount || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      title: '完工项目',
      value: data?.profit.project_counts['完工'] || 0,
      icon: TrendingUp,
      color: 'text-orange-600 bg-orange-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">数据看板</h1>
        <p className="mt-1 text-sm text-gray-500">企业运营概览</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Sales Funnel */}
      <Card title="销售漏斗" description="各阶段客户数量分布">
        <div className="space-y-3">
          {data?.sales_funnel.map((item) => {
            const maxCount = Math.max(...data.sales_funnel.map((s) => s.count), 1)
            const percentage = (item.count / maxCount) * 100
            return (
              <div key={item.stage} className="flex items-center gap-4">
                <span className="w-20 text-sm text-gray-600">{item.stage}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-16 text-right text-sm font-medium text-gray-900">
                  {item.count}
                </span>
                <Badge variant="secondary">
                  {maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0}%
                </Badge>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Project Status */}
      <Card title="项目状态分布" description="各状态项目数量">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {data?.profit.project_counts &&
            Object.entries(data.profit.project_counts).map(([status, count]) => (
              <div key={status} className="text-center p-4 rounded-lg bg-gray-50">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-500 mt-1">{status}</p>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )
}
