'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, HardHat, DollarSign, Target } from 'lucide-react'

// ─── Types ───────────────────────────────────────────
interface KpiData {
  total_customers: number
  monthly_new_customers: number
  total_projects: number
  active_projects: number
  total_contract_amount: number
  monthly_contract_amount: number
  monthly_income: number
  monthly_expense: number
  conversion_rate: number
  funnel: { stage: string; count: number }[]
  project_counts: Record<string, number>
}

interface MonthlyTrend {
  month: string
  label: string
  contract_amount: number
  income: number
  expense: number
}

interface Performer {
  name: string
  contract_count?: number
  total_amount?: number
  project_count?: number
}

interface SourceItem {
  source: string
  count: number
}

// ─── Colors ─────────────────────────────────────────
const FUNNEL_COLORS = ['#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A']
const SOURCE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1']
const STATUS_COLORS: Record<string, string> = {
  待开工: '#F59E0B', 施工中: '#3B82F6', 待验收: '#8B5CF6', 完工: '#10B981', 停工: '#EF4444',
}

// ─── Component ──────────────────────────────────────
export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [trend, setTrend] = useState<MonthlyTrend[]>([])
  const [designers, setDesigners] = useState<Performer[]>([])
  const [pms, setPms] = useState<Performer[]>([])
  const [sources, setSources] = useState<SourceItem[]>([])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [overviewRes, trendRes, perfRes, srcRes] = await Promise.all([
          api.get('/api/v1/reports/overview'),
          api.get('/api/v1/reports/monthly-trend'),
          api.get('/api/v1/reports/performance'),
          api.get('/api/v1/reports/customer-source'),
        ])
        setKpi(overviewRes.data)
        setTrend(trendRes.data)
        setDesigners(perfRes.data?.top_designers || [])
        setPms(perfRes.data?.top_pms || [])
        setSources(srcRes.data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) return <div className="text-center py-20 text-gray-500">加载中...</div>
  if (!kpi) return <div className="text-center py-20 text-red-500">数据加载失败</div>

  const profit = kpi.monthly_income - kpi.monthly_expense
  const grossMargin = kpi.monthly_income > 0
    ? Math.round((profit / kpi.monthly_income) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">经营报表</h1>
        <p className="mt-1 text-sm text-gray-500">
          本月签约 {formatCurrency(kpi.monthly_contract_amount)} · 回款 {formatCurrency(kpi.monthly_income)} · 在建 {kpi.active_projects} 个项目
        </p>
      </div>

      {/* ─── KPI Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="本月签约"
          value={formatCurrency(kpi.monthly_contract_amount)}
          sub={`累计 ${formatCurrency(kpi.total_contract_amount)}`}
          color="blue"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="本月回款"
          value={formatCurrency(kpi.monthly_income)}
          sub={`支出 ${formatCurrency(kpi.monthly_expense)} · 毛利 ${grossMargin}%`}
          color="green"
          subColor={profit >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <KpiCard
          icon={<HardHat className="h-5 w-5" />}
          label="在建项目"
          value={`${kpi.active_projects}`}
          sub={`共 ${kpi.total_projects} 个项目`}
          color="purple"
        />
        <KpiCard
          icon={<Target className="h-5 w-5" />}
          label="签约转化率"
          value={`${kpi.conversion_rate}%`}
          sub={`总客户 ${kpi.total_customers} · 本月新增 ${kpi.monthly_new_customers}`}
          color="orange"
        />
      </div>

      {/* ─── Row 1: Funnel + Project Status ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Funnel */}
        <Card title="销售漏斗" description="客户阶段分布与转化">
          <div className="space-y-3 pt-2">
            {kpi.funnel.map((item, idx) => {
              const maxCount = Math.max(...kpi.funnel.map((s) => s.count), 1)
              const percent = Math.round((item.count / maxCount) * 100)
              return (
                <div key={item.stage}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: FUNNEL_COLORS[idx] }} />
                      <span className="font-medium text-gray-700">{item.stage}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">{item.count}</span>
                      <span className="text-xs text-gray-400 w-10 text-right">
                        {idx > 0 && kpi.funnel[idx - 1].count > 0
                          ? `${Math.round((item.count / kpi.funnel[idx - 1].count) * 100)}%`
                          : `${percent}%`}
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${percent}%`, backgroundColor: FUNNEL_COLORS[idx] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Project Status */}
        <Card title="项目状态" description="各状态项目数量分布">
          <div className="space-y-4 pt-2">
            {Object.entries(kpi.project_counts).map(([status, count]) => {
              const total = Object.values(kpi.project_counts).reduce((a, b) => a + b, 0)
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] || '#9CA3AF' }} />
                      <span className="font-medium text-gray-700">{status}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">{count}</span>
                      <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[status] || '#9CA3AF' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ─── Row 2: Monthly Trend ──────────────────── */}
      <Card title="月度趋势" description="近12个月签约金额与收支对比（元）">
        <div className="pt-2">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={trend} barCategoryGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar name="签约金额" dataKey="contract_amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar name="回款" dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar name="支出" dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ─── Row 3: Performance + Source ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance */}
        <Card title="设计师业绩排行" description="按签约金额排名">
          <div className="pt-2">
            {designers.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">暂无数据</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 font-medium text-gray-500 w-10">#</th>
                    <th className="text-left py-3 font-medium text-gray-500">姓名</th>
                    <th className="text-right py-3 font-medium text-gray-500">签约数</th>
                    <th className="text-right py-3 font-medium text-gray-500">签约金额</th>
                  </tr>
                </thead>
                <tbody>
                  {designers.map((d, i) => (
                    <tr key={d.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                          ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                            i === 1 ? 'bg-gray-100 text-gray-600' :
                            i === 2 ? 'bg-orange-100 text-orange-700' :
                            'text-gray-400'}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-3 font-medium text-gray-900">{d.name}</td>
                      <td className="py-3 text-right text-gray-600">{d.contract_count}</td>
                      <td className="py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(d.total_amount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Customer Source */}
        <Card title="客户来源分析" description="各渠道获客数量">
          <div className="pt-2 flex items-center gap-6">
            {/* Pie chart */}
            {sources.length > 0 ? (
              <>
                <div className="shrink-0">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={sources}
                        dataKey="count"
                        nameKey="source"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                      >
                        {sources.map((_, idx) => (
                          <Cell key={idx} fill={SOURCE_COLORS[idx % SOURCE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {sources.map((s, idx) => {
                    const total = sources.reduce((a, b) => a + b.count, 0)
                    const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
                    return (
                      <div key={s.source} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length] }} />
                        <span className="flex-1 text-gray-600">{s.source}</span>
                        <span className="font-semibold text-gray-900">{s.count}</span>
                        <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="text-center py-8 text-gray-400 text-sm flex-1">暂无数据</p>
            )}
          </div>
        </Card>
      </div>

      {/* ─── Footer: Project Manager Ranking ───────── */}
      {pms.length > 0 && (
        <Card title="项目经理排行" description="按管理项目数量排名">
          <div className="pt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 font-medium text-gray-500 w-10">#</th>
                  <th className="text-left py-3 font-medium text-gray-500">姓名</th>
                  <th className="text-right py-3 font-medium text-gray-500">项目数</th>
                </tr>
              </thead>
              <tbody>
                {pms.map((p, i) => (
                  <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                        ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                          i === 1 ? 'bg-gray-100 text-gray-600' :
                          i === 2 ? 'bg-orange-100 text-orange-700' :
                          'text-gray-400'}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="py-3 text-right font-semibold text-gray-900">{p.project_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── KPI Card Sub-component ─────────────────────────
function KpiCard({
  icon, label, value, sub, color, subColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: 'blue' | 'green' | 'purple' | 'orange'
  subColor?: string
}) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-700' },
    green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-700' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-700' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600', text: 'text-orange-700' },
  }
  const c = colorMap[color]
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${c.text}`}>{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${c.bg} ${c.icon}`}>
          {icon}
        </div>
      </div>
      <p className={`mt-2 text-xs ${subColor || 'text-gray-400'}`}>{sub}</p>
    </Card>
  )
}
