import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(amount)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export const CUSTOMER_STAGES = ['线索', '已联系', '量房', '报预算', '签合同', '在建', '完工'] as const
export const PROJECT_STATUSES = ['待开工', '施工中', '待验收', '完工', '停工'] as const
export const STAGE_STATUSES = ['未开始', '进行中', '已完成', '已验收', '延期'] as const
export const USER_ROLES = ['owner', 'designer', 'pm', 'foreman', 'finance', 'marketing'] as const

export const ROLE_LABELS: Record<string, string> = {
  owner: '老板',
  designer: '设计师',
  pm: '项目经理',
  foreman: '工长',
  finance: '财务',
  marketing: '市场',
}

export const STAGE_LABELS: Record<string, string> = {
  线索: '线索',
  已联系: '已联系',
  量房: '量房',
  报预算: '报预算',
  签合同: '签合同',
  在建: '在建',
  完工: '完工',
}
