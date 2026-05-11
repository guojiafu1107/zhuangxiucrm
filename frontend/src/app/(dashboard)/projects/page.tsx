'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import { Plus, FolderKanban, X, FileDown } from 'lucide-react'
import { downloadExport } from '@/lib/export-utils'

interface Project {
  id: string
  name: string
  status: string
  progress_percent: number
  start_date: string
  expected_end_date: string
  members: { user_id: string; role: string }[]
  stage_count: number
  completed_stages: number
}

interface CustomerOption {
  id: string
  name: string
}

const STATUS_COLORS: Record<string, string> = {
  待开工: 'secondary',
  施工中: 'default',
  待验收: 'warning',
  完工: 'success',
  停工: 'destructive',
}

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: '待开工', label: '待开工' },
  { value: '施工中', label: '施工中' },
  { value: '待验收', label: '待验收' },
  { value: '完工', label: '完工' },
  { value: '停工', label: '停工' },
]

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [teamUsers, setTeamUsers] = useState<{ id: string; name: string; role: string }[]>([])
  const [stageWorkers, setStageWorkers] = useState<{ name: string; worker_name: string }[]>([])
  const [formData, setFormData] = useState({
    customer_id: '',
    name: '',
    address: '',
    start_date: '',
    expected_end_date: '',
    designer_name: '',
    pm_name: '',
  })

  const DEFAULT_STAGES = [
    '开工', '拆墙', '砌墙', '水电定位', '开槽', '水电管线布局',
    '泥瓦工程', '木工吊顶', '全屋定制', '墙面工程', '开关面板灯具安装',
    '开荒保洁', '家具家电',
  ]

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (statusFilter) params.set('status', statusFilter)
      const res = await api.get(`/api/v1/projects?${params}`)
      setProjects(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/customers?page_size=100')
      setCustomers(res.data.items.map((c: any) => ({ id: c.id, name: c.name })))
    } catch { /* ignore */ }
  }, [])

  const fetchTeamUsers = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/admin/users')
      setTeamUsers(res.data.map((u: any) => ({ id: u.id, name: u.name, role: u.role })))
    } catch { /* ignore */ }
  }, [])

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customer_id || !formData.name.trim()) {
      setFormErrors('请选择客户并填写项目名称')
      return
    }
    setSubmitting(true)
    setFormErrors(null)
    try {
      const payload: Record<string, any> = {
        customer_id: formData.customer_id,
        name: formData.name.trim(),
        stages: stageWorkers,
      }
      if (formData.address) payload.address = formData.address
      if (formData.start_date) payload.start_date = formData.start_date
      if (formData.expected_end_date) payload.expected_end_date = formData.expected_end_date
      if (formData.designer_name) payload.designer_name = formData.designer_name
      if (formData.pm_name) payload.pm_name = formData.pm_name
      await api.post('/api/v1/projects', payload)
      setShowCreate(false)
      setFormData({ customer_id: '', name: '', address: '', start_date: '', expected_end_date: '', designer_name: '', pm_name: '' })
      setStageWorkers([])
      fetchProjects()
    } catch (err: any) {
      setFormErrors(err?.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateDialog = () => {
    setFormData({ customer_id: '', name: '', address: '', start_date: '', expected_end_date: '', designer_name: '', pm_name: '' })
    setStageWorkers(DEFAULT_STAGES.map((name) => ({ name, worker_name: '' })))
    setFormErrors(null)
    fetchCustomers()
    fetchTeamUsers()
    setShowCreate(true)
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      设计师: '设计师',
      项目经理: '项目经理',
      工长: '工长',
      监理: '监理',
    }
    return labels[role] || role
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">项目管理</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 个项目</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => downloadExport('/api/v1/projects/export', '项目数据.xlsx')}>
            <FileDown className="h-4 w-4 mr-2" />导出Excel
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />新建项目
          </Button>
        </div>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">新建项目</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formErrors && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{formErrors}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联客户 <span className="text-red-500">*</span></label>
                <Select
                  options={[{ value: '', label: '请选择客户' }, ...customers.map((c) => ({ value: c.id, label: c.name }))]}
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">项目名称 <span className="text-red-500">*</span></label>
                <Input
                  placeholder="如：翡翠城3栋2单元801"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">项目地址</label>
                <Input
                  placeholder="项目地址"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">设计师</label>
                  <Input
                    placeholder="输入设计师姓名"
                    value={formData.designer_name}
                    onChange={(e) => setFormData({ ...formData, designer_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">项目经理</label>
                  <Input
                    placeholder="输入项目经理姓名"
                    value={formData.pm_name}
                    onChange={(e) => setFormData({ ...formData, pm_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">计划开工</label>
                  <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">预计完工</label>
                  <Input type="date" value={formData.expected_end_date} onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })} />
                </div>
              </div>

              {/* Construction Stages & Workers */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">施工阶段与工人分配</h3>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {stageWorkers.map((sw, idx) => (
                    <div key={sw.name} className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-28 shrink-0">{sw.name}</span>
                      <Input
                        placeholder="工人姓名（可选）"
                        value={sw.worker_name}
                        onChange={(e) => {
                          const updated = [...stageWorkers]
                          updated[idx] = { ...updated[idx], worker_name: e.target.value }
                          setStageWorkers(updated)
                        }}
                      />
                    </div>
                  ))}
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

      <div className="flex gap-4">
        <div className="w-40">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">加载中...</div>
        ) : projects.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">暂无项目数据</div>
        ) : (
          projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5 text-primary-600" />
                  <h3 className="font-semibold text-gray-900">{project.name}</h3>
                </div>
                <Badge variant={(STATUS_COLORS[project.status] as any) || 'secondary'}>
                  {project.status}
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-500">进度</span>
                  <span className="font-medium">{project.progress_percent}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${project.progress_percent}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1 text-sm text-gray-500">
                {project.start_date && (
                  <p>开始：{formatDate(project.start_date)}</p>
                )}
                {project.expected_end_date && (
                  <p>预计完工：{formatDate(project.expected_end_date)}</p>
                )}
                <p>
                  阶段：{project.completed_stages}/{project.stage_count}
                </p>
                {(project.members || []).length > 0 && (
                  <p>
                    成员：
                    {(project.members || [])
                      .map((m) => getRoleLabel(m.role))
                      .join('、')}
                  </p>
                )}
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
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              上一页
            </Button>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
