export const AdminPermission = {
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  MANAGE_MANAGERS: 'MANAGE_MANAGERS',
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_PROPERTIES: 'MANAGE_PROPERTIES',
  MANAGE_ORDERS: 'MANAGE_ORDERS',
  MANAGE_TASKS: 'MANAGE_TASKS',
  MANAGE_DEPOSITS: 'MANAGE_DEPOSITS',
  MANAGE_WITHDRAWALS: 'MANAGE_WITHDRAWALS',
  VIEW_REVENUE: 'VIEW_REVENUE',
  VIEW_ACTIVITY: 'VIEW_ACTIVITY',
  MANAGE_PLATFORM_SETTINGS: 'MANAGE_PLATFORM_SETTINGS',
  MANAGE_LOGIN_ACCESS: 'MANAGE_LOGIN_ACCESS',
  MANAGE_ADMIN_ACCOUNTS: 'MANAGE_ADMIN_ACCOUNTS',
  MANAGE_ADMIN_PERMISSIONS: 'MANAGE_ADMIN_PERMISSIONS',
  MANAGE_SECURITY: 'MANAGE_SECURITY',
  USE_SYNC: 'USE_SYNC',
  VIEW_AUDIT: 'VIEW_AUDIT',
} as const

export type AdminPermission = typeof AdminPermission[keyof typeof AdminPermission]

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = Object.values(AdminPermission)

export const SUPER_ADMIN_PERMISSIONS: AdminPermission[] = ALL_ADMIN_PERMISSIONS

export const DEFAULT_STAFF_PERMISSIONS: AdminPermission[] = [
  AdminPermission.VIEW_DASHBOARD,
]

export const PERMISSION_GROUPS = {
  'User Management': [
    AdminPermission.MANAGE_USERS,
    AdminPermission.MANAGE_MANAGERS,
  ],
  'Operations': [
    AdminPermission.MANAGE_PROPERTIES,
    AdminPermission.MANAGE_ORDERS,
    AdminPermission.MANAGE_TASKS,
  ],
  'Finance': [
    AdminPermission.MANAGE_DEPOSITS,
    AdminPermission.MANAGE_WITHDRAWALS,
    AdminPermission.VIEW_REVENUE,
  ],
  'Platform': [
    AdminPermission.MANAGE_PLATFORM_SETTINGS,
    AdminPermission.MANAGE_LOGIN_ACCESS,
    AdminPermission.MANAGE_SECURITY,
  ],
  'Admin Management': [
    AdminPermission.MANAGE_ADMIN_ACCOUNTS,
    AdminPermission.MANAGE_ADMIN_PERMISSIONS,
  ],
  'Monitoring': [
    AdminPermission.VIEW_ACTIVITY,
    AdminPermission.VIEW_AUDIT,
    AdminPermission.USE_SYNC,
  ],
} as const

export function hasPermission(adminPermissions: string[], required: AdminPermission): boolean {
  if (!adminPermissions) return false
  return adminPermissions.includes(required)
}

export function hasAllPermissions(adminPermissions: string[], required: AdminPermission[]): boolean {
  return required.every(p => hasPermission(adminPermissions, p))
}

export function hasAnyPermission(adminPermissions: string[], required: AdminPermission[]): boolean {
  return required.some(p => hasPermission(adminPermissions, p))
}

export function isSuperAdmin(adminType: string): boolean {
  return adminType === 'SUPER_ADMIN'
}

export function getEffectivePermissions(adminType: string, permissions: string[]): AdminPermission[] {
  if (isSuperAdmin(adminType)) {
    return SUPER_ADMIN_PERMISSIONS
  }
  return (permissions || []).filter(p => ALL_ADMIN_PERMISSIONS.includes(p as AdminPermission)) as AdminPermission[]
}