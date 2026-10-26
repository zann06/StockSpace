import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { env } from '@/lib/env'

import { apiFetch } from './client'
import { demoFetch, isDemoMode } from './demo-api'
import { useWorkspace } from './workspace-context'
import type {
  ApiCategory,
  ApiLocationInventory,
  ApiMember,
  ApiMovement,
  ApiNotification,
  ApiProduct,
  ApiWarehouseLayout,
  DashboardSummary,
  MemberRole,
  MovementPayload,
  ProductInput,
  ProductUpdateInput,
  WorkspaceSummary,
} from './types'
import type { Balance, SceneProduct, StorageLocation, Warehouse } from '@/types'

/**
 * TanStack Query layer. All data comes from the REST API — the Phase 1 mocks
 * are retired from the production path (they survive only as test fixtures).
 *
 * Query keys share prefixes so a committed movement can invalidate everything
 * it affects with one call: ['dashboard'], ['layout'], ['products'],
 * ['product'], ['movements'], ['location-inventory'], ['notifications'].
 */

function useWorkspaceId(): string {
  const { workspace } = useWorkspace()
  // Hooks are only rendered once a workspace is resolved (see guards in pages).
  return workspace?.id ?? ''
}

/** Maps the layout API response onto the shapes the 3D scene consumes. */
function adaptLayout(api: ApiWarehouseLayout): {
  warehouse: Warehouse
  locations: StorageLocation[]
  balances: Balance[]
  products: SceneProduct[]
  zones: ApiWarehouseLayout['zones']
} {
  const zoneNames = new Map(api.zones.map((zone) => [zone.id, zone.name]))
  return {
    warehouse: api.warehouse,
    zones: api.zones,
    locations: api.locations.map((location) => ({
      id: location.id,
      warehouseId: api.warehouse.id,
      code: location.code,
      label: location.label,
      type: location.type,
      zone: location.zoneId ? (zoneNames.get(location.zoneId) ?? '—') : '—',
      x: location.x,
      z: location.z,
      rotation: location.rotation,
      capacity: location.capacity,
    })),
    balances: api.balances.map((balance) => ({
      productId: balance.productId,
      locationId: balance.locationId,
      level: Math.min(3, Math.max(1, balance.level)) as 1 | 2 | 3,
      quantity: balance.quantity,
    })),
    products: api.products,
  }
}

export interface WarehouseData {
  warehouse: Warehouse
  zones: ApiWarehouseLayout['zones']
  locations: StorageLocation[]
  balances: Balance[]
  products: SceneProduct[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/** Warehouse list + layout (+ balances + products) in one cached hook. */
export function useWarehouseData(): WarehouseData {
  const workspaceId = useWorkspaceId()
  const warehousesQuery = useQuery({
    queryKey: ['warehouses', workspaceId],
    queryFn: () =>
      apiFetch<{ data: { id: string; name: string; code: string }[] }>('/api/warehouses'),
    enabled: workspaceId !== '',
  })

  const firstWarehouse = warehousesQuery.data?.data[0]
  const layoutQuery = useQuery({
    queryKey: ['layout', workspaceId, firstWarehouse?.id],
    queryFn: () =>
      apiFetch<{ data: ApiWarehouseLayout }>(`/api/warehouses/${firstWarehouse!.id}/layout`),
    enabled: workspaceId !== '' && !!firstWarehouse,
  })

  const adapted = layoutQuery.data ? adaptLayout(layoutQuery.data.data) : null

  return {
    warehouse: adapted?.warehouse ?? { id: '', name: '…', code: '' },
    zones: adapted?.zones ?? [],
    locations: adapted?.locations ?? [],
    balances: adapted?.balances ?? [],
    products: adapted?.products ?? [],
    isLoading:
      warehousesQuery.isLoading ||
      (warehousesQuery.isSuccess && !firstWarehouse ? false : layoutQuery.isLoading),
    error: (warehousesQuery.error as Error | null) ?? (layoutQuery.error as Error | null),
    refetch: () => void layoutQuery.refetch(),
  }
}

export function useDashboardSummary() {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['dashboard', workspaceId],
    queryFn: () => apiFetch<{ data: DashboardSummary }>('/api/dashboard/summary'),
    enabled: workspaceId !== '',
  })
}

export interface ProductListParams {
  search?: string
  categoryId?: string
}

export function useProductsList(params: ProductListParams = {}) {
  const workspaceId = useWorkspaceId()
  const search = params.search?.trim() ?? ''
  const query = new URLSearchParams({ perPage: '100' })
  if (search) query.set('search', search)
  if (params.categoryId) query.set('categoryId', params.categoryId)

  return useQuery({
    queryKey: ['products', workspaceId, search, params.categoryId ?? ''],
    queryFn: () =>
      apiFetch<{ data: ApiProduct[]; pagination: { total: number } }>(`/api/products?${query}`),
    enabled: workspaceId !== '',
  })
}

export function useProduct(id: string | undefined) {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['product', workspaceId, id],
    queryFn: () =>
      apiFetch<{
        data: ApiProduct & {
          balances: {
            id: string
            level: number
            quantity: number
            location: { id: string; code: string; label: string; zone: { name: string } | null }
          }[]
          movements: ApiMovement[]
        }
      }>(`/api/products/${id}`),
    enabled: workspaceId !== '' && !!id,
  })
}

export function useCategories() {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['categories', workspaceId],
    queryFn: () => apiFetch<{ data: ApiCategory[] }>('/api/categories'),
    enabled: workspaceId !== '',
  })
}

function invalidateProductData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['products'] })
  void queryClient.invalidateQueries({ queryKey: ['product'] })
  void queryClient.invalidateQueries({ queryKey: ['categories'] })
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  void queryClient.invalidateQueries({ queryKey: ['layout'] })
  void queryClient.invalidateQueries({ queryKey: ['location-inventory'] })
  void queryClient.invalidateQueries({ queryKey: ['report-low-stock'] })
  void queryClient.invalidateQueries({ queryKey: ['report-movements'] })
  void queryClient.invalidateQueries({ queryKey: ['notifications'] })
}

/** Creates a product (ADMIN+); SKU is unique per workspace. */
export function useCreateProduct() {
  const queryClient = useQueryClient()
  const workspaceId = useWorkspaceId()
  return useMutation({
    mutationFn: (input: ProductInput) =>
      apiFetch<{ data: ApiProduct }>('/api/products', {
        method: 'POST',
        body: input,
        workspaceId,
      }),
    onSuccess: () => invalidateProductData(queryClient),
  })
}

/** Updates a product (ADMIN+); SKU is immutable server-side. */
export function useUpdateProduct() {
  const queryClient = useQueryClient()
  const workspaceId = useWorkspaceId()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductUpdateInput }) =>
      apiFetch<{ data: ApiProduct }>(`/api/products/${id}`, {
        method: 'PATCH',
        body: input,
        workspaceId,
      }),
    onSuccess: () => invalidateProductData(queryClient),
  })
}

export function useMembers() {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () => apiFetch<{ data: ApiMember[] }>('/api/members', { workspaceId }),
    enabled: workspaceId !== '',
  })
}

export interface InviteMemberInput {
  email: string
  role: MemberRole
}

/** Invites an existing account; there is no mail provider, so the user must
 * already have signed up with that email. */
export function useInviteMember() {
  const queryClient = useQueryClient()
  const workspaceId = useWorkspaceId()
  return useMutation({
    mutationFn: (input: InviteMemberInput) =>
      apiFetch<{ data: ApiMember }>('/api/members', {
        method: 'POST',
        body: input,
        workspaceId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()
  const workspaceId = useWorkspaceId()
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: MemberRole }) =>
      apiFetch<{ data: ApiMember }>(`/api/members/${memberId}`, {
        method: 'PATCH',
        body: { role },
        workspaceId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] })
      // The signed-in user's own role is read from /api/workspaces.
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  const workspaceId = useWorkspaceId()
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<{ data: { id: string } }>(`/api/members/${memberId}`, {
        method: 'DELETE',
        workspaceId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

export interface MovementListParams {
  type?: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'
  productId?: string
  locationId?: string
  perPage?: number
}

export function useMovements(params: MovementListParams = {}) {
  const workspaceId = useWorkspaceId()
  const query = new URLSearchParams({ perPage: String(params.perPage ?? 60) })
  if (params.type) query.set('type', params.type)
  if (params.productId) query.set('productId', params.productId)
  if (params.locationId) query.set('locationId', params.locationId)

  return useQuery({
    queryKey: [
      'movements',
      workspaceId,
      params.type ?? '',
      params.productId ?? '',
      params.locationId ?? '',
      params.perPage ?? 60,
    ],
    queryFn: () =>
      apiFetch<{ data: ApiMovement[]; pagination: { total: number } }>(
        `/api/stock-movements?${query}`
      ),
    enabled: workspaceId !== '',
  })
}

export function useLocationInventory(locationId: string | null) {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['location-inventory', workspaceId, locationId],
    queryFn: () =>
      apiFetch<{ data: ApiLocationInventory }>(`/api/storage-locations/${locationId}/inventory`),
    enabled: workspaceId !== '' && !!locationId,
  })
}

export function useNotifications() {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['notifications', workspaceId],
    queryFn: () => apiFetch<{ data: ApiNotification[]; unread: number }>('/api/notifications'),
    enabled: workspaceId !== '',
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ data: ApiNotification }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export type MovementKind = 'stock-in' | 'stock-out' | 'transfer' | 'adjustment'

/** Records a stock movement and refreshes every affected view. */
export function useCreateMovement(kind: MovementKind) {
  const queryClient = useQueryClient()
  const workspaceId = useWorkspaceId()

  return useMutation({
    mutationFn: (payload: MovementPayload) =>
      apiFetch<{ data: { id: string; reference: string | null } }>(`/api/stock-movements/${kind}`, {
        method: 'POST',
        body: payload,
        workspaceId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['layout'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['product'] })
      void queryClient.invalidateQueries({ queryKey: ['movements'] })
      void queryClient.invalidateQueries({ queryKey: ['location-inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export interface MovementReportParams {
  from?: string
  to?: string
  type?: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'
  productId?: string
  page?: number
  perPage?: number
}

export function useMovementReport(params: MovementReportParams) {
  const workspaceId = useWorkspaceId()
  const page = params.page ?? 1
  const perPage = params.perPage ?? 50
  const query = new URLSearchParams({ page: String(page), perPage: String(perPage) })
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.type) query.set('type', params.type)
  if (params.productId) query.set('productId', params.productId)

  return useQuery({
    queryKey: [
      'report-movements',
      workspaceId,
      params.from ?? '',
      params.to ?? '',
      params.type ?? '',
      params.productId ?? '',
      page,
      perPage,
    ],
    queryFn: () =>
      apiFetch<{
        data: (ApiMovement & {
          sourceLocation: { code: string } | null
          destinationLocation: { code: string } | null
        })[]
        pagination: { page: number; perPage: number; total: number }
      }>(`/api/reports/movements?${query}`),
    enabled: workspaceId !== '',
  })
}

export function useLowStockReport() {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['report-low-stock', workspaceId],
    queryFn: () =>
      apiFetch<{
        data: {
          id: string
          sku: string
          name: string
          category: string | null
          quantity: number
          reorderThreshold: number
          shortfall: number
          stockValue: number
        }[]
      }>('/api/reports/low-stock'),
    enabled: workspaceId !== '',
  })
}

/** Downloads a CSV report (cookie-authenticated blob download). */
export async function downloadReportCsv(
  report: 'low-stock' | 'movements',
  params: MovementReportParams = {}
): Promise<void> {
  const query = new URLSearchParams({ report })
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.type) query.set('type', params.type)
  if (params.productId) query.set('productId', params.productId)

  const response = isDemoMode()
    ? await demoFetch(`/api/reports/export.csv?${query}`)
    : await fetch(`${env.VITE_API_URL}/api/reports/export.csv?${query}`, {
        credentials: 'include',
      })
  if (!response.ok) {
    let message = `Ekspor gagal (${response.status}).`
    try {
      const payload = (await response.json()) as { error?: { message?: string } }
      message = payload.error?.message ?? message
    } catch {
      // ignore non-JSON errors
    }
    throw new Error(message)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `stockspace-${report}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export type { WorkspaceSummary }
