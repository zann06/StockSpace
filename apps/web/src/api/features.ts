/** Hooks for the post-MVP features: suppliers, stock opname, restock, import. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from './client'
import { useWorkspace } from './workspace-context'
import type { Product } from '@/types'

export interface ApiSupplier {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  _count?: { products: number }
}

export interface ApiStocktake {
  id: string
  warehouseId: string
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED'
  note: string | null
  createdAt: string
  completedAt: string | null
  warehouse: { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
  _count?: { lines: number }
}

export interface ApiStocktakeLine {
  id: string
  productId: string
  locationId: string
  level: number
  expectedQty: number
  countedQty: number | null
  product: { id: string; sku: string; name: string; unit: string }
  location: { id: string; code: string; label: string }
}

export interface ApiStocktakeDetail extends ApiStocktake {
  lines: ApiStocktakeLine[]
}

export interface ApiRestockItem {
  id: string
  sku: string
  name: string
  unit: string
  quantity: number
  reorderThreshold: number
  shortfall: number
  estimatedCost: number
  supplier: {
    id: string
    name: string
    contactName: string | null
    email: string | null
    phone: string | null
  } | null
}

function useWorkspaceId(): string {
  const { workspace } = useWorkspace()
  return workspace?.id ?? ''
}

// ---------- suppliers ----------

export function useSuppliers() {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['suppliers', workspaceId],
    queryFn: () => apiFetch<{ data: ApiSupplier[] }>('/api/suppliers'),
    enabled: workspaceId !== '',
  })
}

export interface SupplierPayload {
  name: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
}

export function useCreateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SupplierPayload) =>
      apiFetch<{ data: ApiSupplier }>('/api/suppliers', { method: 'POST', body: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ data: { id: string } }>(`/api/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })
}

// ---------- stocktakes ----------

export function useStocktakes() {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['stocktakes', workspaceId],
    queryFn: () => apiFetch<{ data: ApiStocktake[] }>('/api/stocktakes'),
    enabled: workspaceId !== '',
  })
}

export function useStocktake(id: string | undefined) {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['stocktake', workspaceId, id],
    queryFn: () => apiFetch<{ data: ApiStocktakeDetail }>(`/api/stocktakes/${id}`),
    enabled: workspaceId !== '' && !!id,
  })
}

export function useCreateStocktake() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { warehouseId: string; note?: string | null }) =>
      apiFetch<{ data: ApiStocktake }>('/api/stocktakes', { method: 'POST', body: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stocktakes'] })
    },
  })
}

export function useUpdateStocktakeLine(stocktakeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { lineId: string; countedQty: number | null }) =>
      apiFetch<{ data: ApiStocktakeLine }>(
        `/api/stocktakes/${stocktakeId}/lines/${payload.lineId}`,
        { method: 'PATCH', body: { countedQty: payload.countedQty } }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stocktake'] })
    },
  })
}

export function useCommitStocktake() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{
        data: {
          stocktake: ApiStocktake
          adjustments: number
          countedLines: number
          skippedLines: number
        }
      }>(`/api/stocktakes/${id}/commit`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries()
    },
  })
}

export function useCancelStocktake() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ data: ApiStocktake }>(`/api/stocktakes/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries()
    },
  })
}

// ---------- restock ----------

export function useRestockReport() {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: ['restock', workspaceId],
    queryFn: () =>
      apiFetch<{ data: ApiRestockItem[]; totalEstimatedCost: number }>('/api/reports/restock'),
    enabled: workspaceId !== '',
  })
}

// ---------- product import ----------

export interface ImportRow {
  sku: string
  name: string
  category?: string | null
  unit?: string | null
  barcode?: string | null
  costPrice?: number | null
  reorderThreshold?: number | null
  description?: string | null
}

export function useImportProducts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rows: ImportRow[]) =>
      apiFetch<{
        data: { created: string[]; updated: string[]; errors: { row: number; message: string }[] }
      }>('/api/products/import', { method: 'POST', body: { rows } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** Assign a supplier to a product (PATCH /api/products/:id). */
export function useSetProductSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { productId: string; supplierId: string | null }) =>
      apiFetch<{ data: Product }>(`/api/products/${payload.productId}`, {
        method: 'PATCH',
        body: { supplierId: payload.supplierId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['product'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })
}
