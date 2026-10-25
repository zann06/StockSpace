import { useSearchParams } from 'react-router-dom'

import { useWarehouseData } from '@/api/hooks'
import { DemoBadge } from '@/components/common/DemoBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { LocationDetailPanel } from '@/components/warehouse/LocationDetailPanel'
import { WarehouseView } from '@/components/warehouse/WarehouseView'
import { Card } from '@/components/ui/Card'
import { useI18n } from '@/i18n'

/** Full-page 3D warehouse. The selected location is derived from the `?loc=`
 * URL parameter (deep-linkable from global search and the detail panel). */
export function WarehousePage() {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const { locations } = useWarehouseData()
  const code = searchParams.get('loc')
  const selectedLocationId = code
    ? (locations.find((location) => location.code.toLowerCase() === code.toLowerCase())?.id ?? null)
    : null

  const handleSelect = (id: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (id) {
      const location = locations.find((candidate) => candidate.id === id)
      if (location) next.set('loc', location.code)
    } else {
      next.delete('loc')
    }
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('Warehouse 3D')}
        subtitle={t('Jelajahi rak dan area gudang — klik objek untuk melihat detail inventaris.')}
        meta={<DemoBadge />}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex h-[70vh] min-h-[480px] flex-col p-2">
          <WarehouseView
            selectedLocationId={selectedLocationId}
            onSelect={handleSelect}
            className="flex-1"
          />
        </Card>
        <LocationDetailPanel
          locationId={selectedLocationId}
          onClose={() => handleSelect(null)}
          className="max-h-[70vh] overflow-hidden"
        />
      </div>
    </div>
  )
}
