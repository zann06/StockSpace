import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { List, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'

import type { LevelFilter, ViewMode } from '@/types'
import { useWarehouseData } from '@/api/hooks'
import { useWorkspace } from '@/api/workspace-provider'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { LocationList } from '@/components/warehouse/LocationList'
import { SceneErrorBoundary } from '@/components/warehouse/SceneErrorBoundary'
import { WarehouseScene } from '@/components/warehouse/WarehouseScene'
import { usePrefersReducedMotion } from '@/lib/hooks'
import { isWebGLAvailable } from '@/lib/webgl'

export interface WarehouseViewProps {
  selectedLocationId: string | null
  onSelect: (id: string | null) => void
  className?: string
  /** Extra toolbar content (e.g. warehouse name), rendered on the left. */
  toolbarStart?: ReactNode
}

/**
 * The interactive warehouse: toolbar (view mode, level filter, camera controls,
 * fullscreen, location list) + 3D canvas fed by the layout API, with an
 * accessible list fallback when WebGL is unavailable.
 */
export function WarehouseView({
  selectedLocationId,
  onSelect,
  className = '',
  toolbarStart,
}: WarehouseViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('ALL')
  const [viewMode, setViewMode] = useState<ViewMode>('3d')
  const [showList, setShowList] = useState(false)
  const [zoomCommand, setZoomCommand] = useState<{ direction: 1 | -1; nonce: number } | null>(null)
  const [resetNonce, setResetNonce] = useState(0)
  const [sceneReady, setSceneReady] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const webglAvailable = useMemo(() => isWebGLAvailable(), [])
  const { workspace: currentWorkspace } = useWorkspace()
  const { warehouse, locations, balances, products, isLoading, error, refetch } = useWarehouseData()

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = async () => {
    const element = containerRef.current
    if (!element) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await element.requestFullscreen()
    } catch {
      console.warn('Mode layar penuh tidak tersedia di browser ini.')
    }
  }

  const zoom = (direction: 1 | -1) =>
    setZoomCommand((previous) => ({ direction, nonce: (previous?.nonce ?? 0) + 1 }))

  if (error) {
    return (
      <div
        className={`flex h-full flex-col items-center justify-center gap-3 rounded-[14px] bg-canvas p-6 text-center ${className}`}
      >
        <p className="text-sm font-bold text-ink">Gagal memuat data gudang</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted">{error.message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-control bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover"
        >
          Coba lagi
        </button>
      </div>
    )
  }

  const fallbackList = (
    <LocationList
      locations={locations}
      balances={balances}
      products={products}
      selectedLocationId={selectedLocationId}
      onSelect={onSelect}
      variant="full"
      showUnavailableNotice={!webglAvailable}
    />
  )

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-[14px] bg-canvas ${className}`}
    >
      {/* Toolbar */}
      <div className="z-20 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        {toolbarStart ?? (
          <span className="mr-1 hidden text-xs font-bold text-ink sm:inline">
            {warehouse.name || currentWorkspace?.name || 'Gudang'}
            <span className="ml-1.5 font-medium text-muted">
              · {viewMode === '3d' ? 'Tampilan 3D' : 'Tampilan 2D'}
            </span>
          </span>
        )}
        <SegmentedControl
          aria-label="Mode tampilan warehouse"
          value={viewMode}
          onChange={(value) => setViewMode(value)}
          options={[
            { value: '3d' as ViewMode, label: '3D', 'aria-label': 'Tampilan 3D' },
            { value: '2d' as ViewMode, label: '2D', 'aria-label': 'Tampilan 2D dari atas' },
          ]}
        />
        <SegmentedControl
          aria-label="Filter tingkat rak"
          value={levelFilter}
          onChange={(value) => setLevelFilter(value)}
          options={[
            { value: 'ALL' as LevelFilter, label: 'Semua' },
            { value: 1 as LevelFilter, label: 'L1', 'aria-label': 'Level 1' },
            { value: 2 as LevelFilter, label: 'L2', 'aria-label': 'Level 2' },
            { value: 3 as LevelFilter, label: 'L3', 'aria-label': 'Level 3' },
          ]}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <IconButton
            icon={ZoomOut}
            aria-label="Perkecil"
            title="Perkecil"
            onClick={() => zoom(-1)}
            disabled={!webglAvailable || isLoading}
          />
          <IconButton
            icon={ZoomIn}
            aria-label="Perbesar"
            title="Perbesar"
            onClick={() => zoom(1)}
            disabled={!webglAvailable || isLoading}
          />
          <IconButton
            icon={RotateCcw}
            aria-label="Reset kamera"
            title="Reset kamera ke posisi awal"
            onClick={() => setResetNonce((nonce) => nonce + 1)}
            disabled={!webglAvailable || isLoading}
          />
          <IconButton
            icon={isFullscreen ? Minimize2 : Maximize2}
            aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}
            title={isFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}
            onClick={toggleFullscreen}
          />
          <IconButton
            icon={List}
            aria-label="Daftar lokasi"
            title="Tampilkan daftar lokasi (alternatif tanpa 3D)"
            active={showList}
            aria-pressed={showList}
            onClick={() => setShowList((value) => !value)}
          />
        </div>
      </div>

      {/* Scene / fallback */}
      <div className="relative min-h-0 flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm font-semibold text-muted">Memuat data gudang…</p>
          </div>
        ) : webglAvailable ? (
          <SceneErrorBoundary fallback={fallbackList}>
            <div className="h-full w-full" aria-hidden={showList}>
              <WarehouseScene
                locations={locations}
                balances={balances}
                products={products}
                selectedLocationId={selectedLocationId}
                onSelect={onSelect}
                levelFilter={levelFilter}
                viewMode={viewMode}
                zoomCommand={zoomCommand}
                resetNonce={resetNonce}
                reducedMotion={reducedMotion}
                onReady={() => setSceneReady(true)}
              />
            </div>
            {!sceneReady ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/85">
                <p className="text-sm font-semibold text-muted">Memuat scene 3D…</p>
              </div>
            ) : null}
          </SceneErrorBoundary>
        ) : (
          fallbackList
        )}

        {webglAvailable && !isLoading && showList ? (
          <LocationList
            locations={locations}
            balances={balances}
            products={products}
            selectedLocationId={selectedLocationId}
            onSelect={onSelect}
            variant="overlay"
            onClose={() => setShowList(false)}
          />
        ) : null}

        {webglAvailable && !isLoading ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-full border border-line bg-surface/90 px-3.5 py-1.5 text-[11px] font-semibold shadow-sm">
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className="h-2 w-2 rounded-full bg-success" /> Terisi
            </span>
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className="h-2 w-2 rounded-full bg-danger" /> Menipis
            </span>
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[#98a1c0]" /> Kosong
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
