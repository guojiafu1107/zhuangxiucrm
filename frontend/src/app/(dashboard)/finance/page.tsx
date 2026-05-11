'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, DollarSign, X, FileDown } from 'lucide-react'
import { downloadExport } from '@/lib/export-utils'

interface Transaction {
  id: string
  project_id: string | null
  category: string
  type: string
  amount: number
  payment_method: string | null
  paid_at: string | null
  remark: string | null
  created_at: string | null
}

const CATEGORY_OPTIONS = [
  { value: '', label: '全部类别' },
  { value: '收入', label: '收入' },
  { value: '支出', label: '支出' },
]

const CATEGORY_COLORS: Record<string, string> = {
  收入: 'success',
  支出: 'destructive',
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    category: '收入',
    type: '',
    amount: '',
    payment_method: '',
    paid_at: '',
    remark: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await api.get(`/api/v1/transactions?${params}`)
      setTransactions(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, categoryFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.type.trim() || !formData.amount) {
      setFormErrors('交易类型和金额不能为空')
      return
    }
    setSubmitting(true)
    setFormErrors(null)
    try {
      const payload: Record<string, any> = {
        category: formData.category,
        type: formData.type.trim(),
        amount: parseFloat(formData.amount),
      }
      if (formData.payment_method) payload.payment_method = formData.payment_method
      if (formData.paid_at) payload.paid_at = formData.paid_at
      if (formData.remark) payload.remark = formData.remark
      await api.post('/api/v1/transactions', payload)
      setShowCreate(false)
      setFormData({ category: '收入', type: '', amount: '', payment_method: '', paid_at: '', remark: '' })
      fetchData()
    } catch (err: any) {
      setFormErrors(err?.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">财务管理</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 条交易记录</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => downloadExport('/api/v1/transactions/export', '财务数据.xlsx')}>
            <FileDown className="h-4 w-4 mr-2" />导出Excel
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />新建交易
          </Button>
        </div>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">新建交易</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formErrors && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{formErrors}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类别 <span className="text-red-500">*</span></label>
                <Select
                  options={[
                    { value: '收入', label: '收入' },
                    { value: '支出', label: '支出' },
                  ]}
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">交易类型 <span className="text-red-500">*</span></label>
                <Input
                  placeholder="如：首付款、材料款"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">金额（元）<span className="text-red-500">*</span></label>
                <Input
                  type="number"
                  placeholder="输入金额"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">支付方式</label>
                  <Input
                    placeholder="微信、银行转账"
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">交易日期</label>
                  <Input
                    type="date"
                    value={formData.paid_at}
                    onChange={(e) => setFormData({ ...formData, paid_at: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[60px]"
                  placeholder="备注信息"
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? '创建中...' : '确认创建'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter */}
      <Card>
        <div className="w-40">
          <Select
            options={CATEGORY_OPTIONS}
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
          />
        </div>
      </Card>

      {/* Transaction List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">暂无交易记录</div>
        ) : (
          transactions.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign className={`h-5 w-5 ${t.category === '收入' ? 'text-green-600' : 'text-red-600'}`} />
                  <div>
                    <p className="font-semibold text-gray-900">{t.type}</p>
                    <p className="text-sm text-gray-500">
                      {t.payment_method && `${t.payment_method} · `}
                      {t.paid_at ? formatDate(t.paid_at) : '-'}
                      {t.remark && ` · ${t.remark}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${t.category === '收入' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.category === '收入' ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                  <Badge variant={(CATEGORY_COLORS[t.category] as any) || 'secondary'}>
                    {t.category}
                  </Badge>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            第 {page} 页，共 {Math.ceil(total / 20)} 页
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>下一页</Button>
          </div>
        </div>
      )}
    </div>
  )
}
