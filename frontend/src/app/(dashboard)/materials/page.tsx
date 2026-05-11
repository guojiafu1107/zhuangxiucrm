'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Plus, Package, X, FileDown } from 'lucide-react'
import { downloadExport } from '@/lib/export-utils'

interface Material {
  id: string
  name: string
  category: string | null
  unit: string | null
  default_price: number | null
  supplier: string | null
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: '',
    default_price: '',
    supplier: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/v1/materials?page=${page}&page_size=20`)
      setMaterials(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setFormErrors('材料名称不能为空')
      return
    }
    setSubmitting(true)
    setFormErrors(null)
    try {
      const payload: Record<string, any> = { name: formData.name.trim() }
      if (formData.category) payload.category = formData.category
      if (formData.unit) payload.unit = formData.unit
      if (formData.default_price) payload.default_price = parseFloat(formData.default_price)
      if (formData.supplier) payload.supplier = formData.supplier
      await api.post('/api/v1/materials', payload)
      setShowCreate(false)
      setFormData({ name: '', category: '', unit: '', default_price: '', supplier: '' })
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
          <h1 className="text-2xl font-bold text-gray-900">材料库</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 种材料</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => downloadExport('/api/v1/materials/export', '材料数据.xlsx')}>
            <FileDown className="h-4 w-4 mr-2" />导出Excel
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />添加材料
          </Button>
        </div>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">添加材料</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formErrors && (<div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{formErrors}</div>)}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">材料名称 <span className="text-red-500">*</span></label>
                <Input placeholder="材料名称" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                  <Input placeholder="如：瓷砖、水电" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">单位</label>
                  <Input placeholder="如：平方米、米" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">默认单价（元）</label>
                  <Input type="number" placeholder="单价" value={formData.default_price} onChange={(e) => setFormData({ ...formData, default_price: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">供应商</label>
                  <Input placeholder="供应商名称" value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
                <Button type="submit" disabled={submitting}>{submitting ? '添加中...' : '确认添加'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Material List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">加载中...</div>
        ) : materials.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">暂无材料</div>
        ) : (
          materials.map((m) => (
            <Card key={m.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-primary-600 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{m.name}</h3>
                  <div className="mt-1 text-sm text-gray-500 space-y-0.5">
                    {m.category && <p>分类：{m.category}</p>}
                    {m.unit && <p>单位：{m.unit}</p>}
                    {m.default_price != null && <p>参考价：{formatCurrency(m.default_price)}</p>}
                    {m.supplier && <p>供应商：{m.supplier}</p>}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">第 {page} 页，共 {Math.ceil(total / 20)} 页</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>下一页</Button>
          </div>
        </div>
      )}
    </div>
  )
}
