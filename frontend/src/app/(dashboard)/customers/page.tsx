'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CUSTOMER_STAGES, formatDateTime } from '@/lib/utils'
import { Plus, Search, Phone, ChevronRight, X, FileDown } from 'lucide-react'
import { downloadExport } from '@/lib/export-utils'

interface Customer {
  id: string
  name: string
  phone: string
  source: string
  stage: string
  house_address: string
  area: number
  budget_min: number
  budget_max: number
  assigned_to: string
  remark: string
  created_at: string
  updated_at: string
}

interface FormData {
  name: string
  phone: string
  source: string
  stage: string
  house_address: string
  area: string
  house_type: string
  style_preference: string
  budget_min: string
  budget_max: string
  remark: string
}

const emptyForm: FormData = {
  name: '',
  phone: '',
  source: '',
  stage: '线索',
  house_address: '',
  area: '',
  house_type: '',
  style_preference: '',
  budget_min: '',
  budget_max: '',
  remark: '',
}

const STAGE_COLORS: Record<string, string> = {
  线索: 'secondary',
  已联系: 'secondary',
  量房: 'warning',
  报预算: 'warning',
  签合同: 'success',
  在建: 'default',
  完工: 'success',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<string | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (search) params.set('search', search)
      if (stageFilter) params.set('stage', stageFilter)
      const res = await api.get(`/api/v1/customers?${params}`)
      setCustomers(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, search, stageFilter])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchCustomers()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setFormErrors('客户姓名不能为空')
      return
    }
    setSubmitting(true)
    setFormErrors(null)
    try {
      const payload: Record<string, any> = {
        name: formData.name.trim(),
        stage: formData.stage,
      }
      if (formData.phone) payload.phone = formData.phone
      if (formData.source) payload.source = formData.source
      if (formData.house_address) payload.house_address = formData.house_address
      if (formData.area) payload.area = parseFloat(formData.area)
      if (formData.house_type) payload.house_type = formData.house_type
      if (formData.style_preference) payload.style_preference = formData.style_preference
      if (formData.budget_min) payload.budget_min = parseFloat(formData.budget_min)
      if (formData.budget_max) payload.budget_max = parseFloat(formData.budget_max)
      if (formData.remark) payload.remark = formData.remark
      await api.post('/api/v1/customers', payload)
      setShowCreate(false)
      setFormData(emptyForm)
      fetchCustomers()
    } catch (err: any) {
      console.error('创建客户失败:', err)
      // Network error (Failed to fetch)
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setFormErrors('网络连接失败，请确认后端服务是否正在运行 (http://127.0.0.1:8000)')
      } else {
        setFormErrors(err?.message || '创建失败，请稍后重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleFormChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const openCreateDialog = () => {
    setFormData(emptyForm)
    setFormErrors(null)
    setShowCreate(true)
  }

  const stageOptions = CUSTOMER_STAGES.map((s) => ({ value: s, label: s }))
  const sourceOptions = [
    { value: '', label: '来源' },
    { value: '抖音', label: '抖音' },
    { value: '微信', label: '微信' },
    { value: '线下', label: '线下' },
    { value: '转介绍', label: '转介绍' },
    { value: '其他', label: '其他' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客户管理</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 位客户</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => downloadExport('/api/v1/customers/export', '客户数据.xlsx')}>
            <FileDown className="h-4 w-4 mr-2" />
            导出Excel
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            新建客户
          </Button>
        </div>
      </div>

      {/* Create Customer Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">新建客户</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formErrors && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{formErrors}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  客户姓名 <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="请输入客户姓名"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                  <Input
                    placeholder="请输入手机号"
                    value={formData.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
                  <Select
                    options={sourceOptions}
                    value={formData.source}
                    onChange={(e) => handleFormChange('source', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">阶段</label>
                  <Select
                    options={stageOptions}
                    value={formData.stage}
                    onChange={(e) => handleFormChange('stage', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">户型</label>
                  <Input
                    placeholder="如：三室两厅"
                    value={formData.house_type}
                    onChange={(e) => handleFormChange('house_type', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">房屋地址</label>
                <Input
                  placeholder="请输入房屋地址"
                  value={formData.house_address}
                  onChange={(e) => handleFormChange('house_address', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">面积 (㎡)</label>
                  <Input
                    type="number"
                    placeholder="面积"
                    value={formData.area}
                    onChange={(e) => handleFormChange('area', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">风格偏好</label>
                  <Input
                    placeholder="如：现代简约"
                    value={formData.style_preference}
                    onChange={(e) => handleFormChange('style_preference', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">预算下限 (元)</label>
                  <Input
                    type="number"
                    placeholder="预算下限"
                    value={formData.budget_min}
                    onChange={(e) => handleFormChange('budget_min', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">预算上限 (元)</label>
                  <Input
                    type="number"
                    placeholder="预算上限"
                    value={formData.budget_max}
                    onChange={(e) => handleFormChange('budget_max', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[80px]"
                  placeholder="备注信息"
                  value={formData.remark}
                  onChange={(e) => handleFormChange('remark', e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? '创建中...' : '确认创建'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="搜索客户姓名、电话、地址..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              options={[{ value: '', label: '全部阶段' }, ...stageOptions]}
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <Button type="submit" variant="secondary">
            <Search className="h-4 w-4 mr-2" />
            搜索
          </Button>
        </form>
      </Card>

      {/* Customer List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">暂无客户数据</div>
        ) : (
          customers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                    {customer.phone && (
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </span>
                    )}
                    <Badge variant={(STAGE_COLORS[customer.stage] as any) || 'secondary'}>
                      {customer.stage}
                    </Badge>
                    {customer.source && (
                      <span className="text-xs text-gray-400">{customer.source}</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                    {customer.house_address != null && customer.house_address !== '' && <span>{customer.house_address}</span>}
                    {customer.area != null && <span>{customer.area}㎡</span>}
                    {customer.budget_max != null && (
                      <span>预算：{customer.budget_min?.toLocaleString() || 0} - {customer.budget_max.toLocaleString()}元</span>
                    )}
                    <span>更新于 {formatDateTime(customer.updated_at)}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            第 {page} 页，共 {Math.ceil(total / 20)} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(total / 20)}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
