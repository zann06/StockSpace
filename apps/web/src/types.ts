/** Domain types shared by the UI. Phase 1 feeds these from mocks; Phase 3
 * swaps the source for API responses with the same shape (packages/shared). */

export type LocationType = 'RACK' | 'STAGING' | 'PACKING'

/** Occupancy of a storage location, used for 3D + list indicators. */
export type OccupancyStatus = 'EMPTY' | 'OCCUPIED' | 'LOW'

export interface Warehouse {
  id: string
  name: string
  code: string
}

export interface StorageLocation {
  id: string
  warehouseId: string
  code: string
  label: string
  type: LocationType
  zone: string
  /** World coordinates for the 3D scene — persisted layout data, never UI-only. */
  x: number
  z: number
  /** Rotation around the Y axis in radians. */
  rotation: number
  capacity: number | null
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  unit: string
  barcode: string | null
  costPrice: number
  reorderThreshold: number
  description: string
  active: boolean
  /** All-time units moved (demo aggregate used by "Produk Terlaris"). */
  totalMoved: number
}

export interface Balance {
  productId: string
  locationId: string
  /** Shelf level inside a rack (1 = bottom … 3 = top). Absent for areas. */
  level?: 1 | 2 | 3
  quantity: number
}

export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'

/** 3D scene controls */
export type LevelFilter = 'ALL' | 1 | 2 | 3
export type ViewMode = '3d' | '2d'
export interface ZoomCommand {
  direction: 1 | -1
  nonce: number
}

export interface Movement {
  id: string
  productId: string
  type: MovementType
  /** Absolute quantity; ADJUSTMENT carries a signed delta instead. */
  quantity: number
  sourceLocationId: string | null
  destinationLocationId: string | null
  reference: string | null
  note: string | null
  actor: string
  createdAt: string
}
