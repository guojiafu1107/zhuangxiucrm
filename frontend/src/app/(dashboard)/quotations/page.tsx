'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { Plus, FileText, X, FileDown } from 'lucide-react'
import { downloadExport } from '@/lib/export-utils'

interface Quotation {
  id: string
  customer_id: string
  total_amount: number
  discount: number
  status: string
  items_count: number
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  草稿: 'secondary',
  已发送: 'default',
  已确认: 'success',
  已签约: 'success',
  作废: 'destructive',
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<string | null>(null)
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [formData, setFormData] = useState({
    total_amount: '',
    discount: '',
    customer_id: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/v1/quotations?page=${page}&page_size=20`)
      setQuotations(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/customers?page_size=100')
      setCustomers(res.data.items.map((c: any) => ({ id: c.id, name: c.name })))
    } catch { /* ignore */ }
  }, [])

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.total_amount) {
      setFormErrors('报价金额不能为空')
      return
    }
    setSubmitting(true)
    setFormErrors(null)
    try {
      const payload: Record<string, any> = { total_amount: parseFloat(formData.total_amount) }
      if (formData.discount) payload.discount = parseFloat(formData.discount)
      if (formData.customer_id) payload.customer_id = formData.customer_id
      await api.post('/api/v1/quotations', payload)
      setShowCreate(false)
      setFormData({ total_amount: '', discount: '', customer_id: '' })
      fetchData()
    } catch (err: any) {
      setFormErrors(err?.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateDialog = () => {
    setFormData({ total_amount: '', discount: '', customer_id: '' })
    setFormErrors(null)
    fetchCustomers()
    setShowCreate(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">报价管理</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 个报价单</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => downloadExport('/api/v1/quotations/export', '报价数据.xlsx')}>
            <FileDown className="h-4 w-4 mr-2" />导出Excel
          </Button>
          <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" />新建报价</Button>
        </div>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">新建报价</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formErrors && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{formErrors}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联客户</label>
                <Select
                  options={[{ value: '', label: '不选择' }, ...customers.map((c) => ({ value: c.id, label: c.name }))]}
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">报价总额（元）<span className="text-red-500">*</span></label>
                <Input
                  type="number"
                  placeholder="报价总额"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">优惠金额（元）</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
                <Button type="submit" disabled={submitting}>{submitting ? '创建中...' : '确认创建'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">暂无报价</div>
        ) : (
          quotations.map((q) => (
            <Card key={q.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary-600" />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(q.total_amount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {q.items_count} 项 · {formatDateTime(q.created_at)}
                    </p>
                  </div>
                </div>
                <Badge variant={(STATUS_COLORS[q.status] as any) || 'secondary'}>
                  {q.status}
                </Badge>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
