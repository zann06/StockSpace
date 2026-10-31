/** API response types (Phase 3). Shapes mirror the Fastify routes exactly. */

export type MemberRole = 'OWNER' | 'ADMIN' | 'STAFF' | 'VIEWER'

export interface WorkspaceSummary {
  id: string
  name: string
  currency: string
  timezone: string
  /** Role of the signed-in user in this workspace (from /api/workspaces). */
  role?: MemberRole
}

export interface ApiMember {
  id: string
  userId: string
  name: string
  email: string
  role: MemberRole
  createdAt: string
}

export interface DashboardLowStockItem {
  id: string
  name: string
  quantity: number
  reorderThreshold: number
}

export interface DashboardTopMovedItem {
  id: string
  name: string
  moved: number
}

export interface DashboardSummary {
  totalUnits: number
  inventoryValue: number
  lowStockCount: number
  lowStock: DashboardLowStockItem[]
  movementsToday: number
  topMoved: DashboardTopMovedItem[]
  movementSeries: { date: string; masuk: number; keluar: number }[]
}

export interface ApiProduct {
  id: string
  sku: string
  name: string
  category: { id: string; name: string } | null
  unit: string
  barcode: string | null
  costPrice: number
  reorderThreshold: number
  description: string | null
  active: boolean
  totalQuantity: number
  createdAt: string
  updatedAt: string
}

export interface ApiCategory {
  id: string
  name: string
  _count: { products: number }
}

/** Payload accepted by POST /api/products (SKU is immutable after creation). */
export interface ProductInput {
  sku: string
  name: string
  categoryId?: string | null
  unit: string
  barcode?: string | null
  costPrice: number
  reorderThreshold: number
  description?: string | null
  active: boolean
}

export type ProductUpdateInput = Partial<Omit<ProductInput, 'sku'>>

export interface ApiWarehouseRef {
  id: string
  name: string
  code: string
}

export interface ApiLayoutLocation {
  id: string
  zoneId: string | null
  type: 'RACK' | 'STAGING' | 'PACKING'
  code: string
  label: string
  x: number
  z: number
  rotation: number
  capacity: number | null
  levels: number
}

export interface ApiLayoutBalance {
  productId: string
  locationId: string
  level: number
  quantity: number
}

export interface ApiLayoutProduct {
  id: string
  sku: string
  name: string
  unit: string
  reorderThreshold: number
}

export interface ApiWarehouseLayout {
  warehouse: ApiWarehouseRef
  zones: { id: string; name: string; code: string }[]
  locations: ApiLayoutLocation[]
  balances: ApiLayoutBalance[]
  products: ApiLayoutProduct[]
}

export interface ApiLocationInventory {
  location: {
    id: string
    code: string
    label: string
    type: 'RACK' | 'STAGING' | 'PACKING'
    zone: { name: string } | null
    capacity: number | null
    levels: number
    warehouse: { id: string; name: string }
  }
  balances: {
    id: string
    level: number
    quantity: number
    updatedAt: string
    product: {
      id: string
      sku: string
      name: string
      unit: string
      reorderThreshold: number
      active: boolean
      category: { name: string } | null
    }
  }[]
  totalQuantity: number
}

export interface ApiMovement {
  id: string
  productId: string
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'
  quantity: number
  sourceLocationId: string | null
  destinationLocationId: string | null
  sourceLevel: number | null
  destinationLevel: number | null
  reference: string | null
  note: string | null
  actorId: string
  createdAt: string
  product: { id: string; name: string; sku: string; unit: string }
  actor: { id: string; name: string }
  sourceLocation: { id: string; code: string; label: string } | null
  destinationLocation: { id: string; code: string; label: string } | null
}

export interface ApiNotification {
  id: string
  workspaceId: string
  userId: string | null
  type: 'LOW_STOCK' | 'INFO'
  title: string
  body: string | null
  readAt: string | null
  createdAt: string
}

export interface MovementPayload {
  productId: string
  quantity: number
  sourceLocationId?: string | null
  destinationLocationId?: string | null
  sourceLevel?: number | null
  destinationLevel?: number | null
  reference?: string | null
  note?: string | null
  /** Stock-in only: supplier of the received goods. */
  supplierId?: string | null
}
