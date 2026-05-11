'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Plus, FileSignature, X, FileDown } from 'lucide-react'
import { downloadExport } from '@/lib/export-utils'

interface Contract {
  id: string
  contract_no: string
  customer_name: string
  total_amount: number
  signed_at: string
  created_at: string
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<string | null>(null)
  const [quotations, setQuotations] = useState<{ id: string; total_amount: number }[]>([])
  const [formData, setFormData] = useState({
    quotation_id: '',
    contract_no: '',
    customer_name: '',
    signed_at: '',
    total_amount: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/v1/contracts?page=${page}&page_size=20`)
      setContracts(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchQuotations = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/quotations?page_size=100')
      setQuotations(res.data.items.map((q: any) => ({ id: q.id, total_amount: q.total_amount })))
    } catch { /* ignore */ }
  }, [])

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.quotation_id || !formData.contract_no.trim()) {
      setFormErrors('请选择报价单并填写合同编号')
      return
    }
    setSubmitting(true)
    setFormErrors(null)
    try {
      const payload: Record<string, any> = {
        quotation_id: formData.quotation_id,
        contract_no: formData.contract_no.trim(),
      }
      if (formData.customer_name) payload.customer_name = formData.customer_name
      if (formData.signed_at) payload.signed_at = formData.signed_at
      if (formData.total_amount) payload.total_amount = parseFloat(formData.total_amount)
      await api.post('/api/v1/contracts', payload)
      setShowCreate(false)
      setFormData({ quotation_id: '', contract_no: '', customer_name: '', signed_at: '', total_amount: '' })
      fetchData()
    } catch (err: any) {
      setFormErrors(err?.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateDialog = () => {
    setFormData({ quotation_id: '', contract_no: '', customer_name: '', signed_at: '', total_amount: '' })
    setFormErrors(null)
    fetchQuotations()
    setShowCreate(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">合同管理</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 份合同</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => downloadExport('/api/v1/contracts/export', '合同数据.xlsx')}>
            <FileDown className="h-4 w-4 mr-2" />导出Excel
          </Button>
          <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" />新建合同</Button>
        </div>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">新建合同</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formErrors && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{formErrors}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联报价单 <span className="text-red-500">*</span></label>
                <Select
                  options={[
                    { value: '', label: '请选择报价单' },
                    ...quotations.map((q) => ({ value: q.id, label: `报价单 ${formatCurrency(q.total_amount)}` })),
                  ]}
                  value={formData.quotation_id}
                  onChange={(e) => setFormData({ ...formData, quotation_id: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">合同编号 <span className="text-red-500">*</span></label>
                <Input placeholder="如：HT-2026-0001" value={formData.contract_no} onChange={(e) => setFormData({ ...formData, contract_no: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">客户名称</label>
                <Input placeholder="客户名称" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">合同金额（元）</label>
                  <Input type="number" placeholder="合同金额" value={formData.total_amount} onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">签订日期</label>
                  <Input type="date" value={formData.signed_at} onChange={(e) => setFormData({ ...formData, signed_at: e.target.value })} />
                </div>
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
        ) : contracts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">暂无合同</div>
        ) : (
          contracts.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSignature className="h-5 w-5 text-primary-600" />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {c.contract_no} - {c.customer_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(c.total_amount)} · 签订于{' '}
                      {c.signed_at ? formatDate(c.signed_at) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
