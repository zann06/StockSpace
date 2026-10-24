import type { MovementType } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { MOVEMENT_TYPE_LABEL, MOVEMENT_TYPE_TONE } from '@/lib/movement-meta'

export function MovementTypeBadge({ type }: { type: MovementType }) {
  return <Badge tone={MOVEMENT_TYPE_TONE[type]}>{MOVEMENT_TYPE_LABEL[type]}</Badge>
}
