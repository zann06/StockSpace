import type { MovementType } from '@/types'

/** Shared movement-type metadata (kept out of component files so fast refresh
 * works cleanly). */
export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  IN: 'Masuk',
  OUT: 'Keluar',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Sesuaikan',
}

export const MOVEMENT_TYPE_TONE: Record<
  MovementType,
  'success' | 'danger' | 'primary' | 'warning'
> = {
  IN: 'success',
  OUT: 'danger',
  TRANSFER: 'primary',
  ADJUSTMENT: 'warning',
}
