import { useEffect, useMemo, useRef, useState } from 'react'

import { useI18n } from '@/i18n'

/**
 * Animated onboarding tour (PRD UX rules): a spotlight highlights real UI
 * elements step by step, with an intro card. Runs once per browser (stored in
 * localStorage) and can be replayed from Settings.
 */

const STORAGE_KEY = 'stockspace.tourDone'

interface TourStep {
  /** CSS selector of the spotlighted element; null = centered card. */
  selector: string | null
  titleKey: string
  bodyKey: string
}

const STEPS: TourStep[] = [
  {
    selector: null,
    titleKey: 'Selamat datang di StockSpace',
    bodyKey:
      'Kelola inventaris Anda dan jelajahi gudang dalam 3D. Tur singkat ini memperkenalkan fitur utamanya — cukup satu menit.',
  },
  {
    selector: 'nav[aria-label] ul, nav[aria-label]',
    titleKey: 'Akses cepat',
    bodyKey:
      'Semua modul ada di sidebar: dashboard, gudang 3D, inventaris, transaksi, laporan, dan pengaturan.',
  },
  {
    selector: '[data-tour="warehouse-card"]',
    titleKey: 'Gudang 3D interaktif',
    bodyKey:
      'Klik rak untuk melihat barang dan riwayatnya. Kamera bisa diputar, di-zoom, dan di-reset; filter L1–L3 menyaring tingkat rak.',
  },
  {
    selector: '[data-tour="stock-in-cta"]',
    titleKey: 'Catat pergerakan stok',
    bodyKey:
      'Formulir barang masuk/keluar/transfer/penyesuaian menulis langsung ke database — stok tidak pernah bisa minus.',
  },
  {
    selector: 'header [aria-label]',
    titleKey: 'Pantau & ekspor',
    bodyKey:
      'Dashboard dan laporan dihitung dari data tersimpan, lengkap dengan ekspor CSV dan notifikasi stok menipis.',
  },
]

export function markTourDone() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // storage unavailable
  }
}

export function isTourDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

/** Triggers a fresh tour even after completion (Settings replay). */
export function restartTour() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent('stockspace:restart-tour'))
}

export function AppTour() {
  const { t } = useI18n()
  const [open, setOpen] = useState(() => !isTourDone())
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const onRestart = () => {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener('stockspace:restart-tour', onRestart)
    return () => window.removeEventListener('stockspace:restart-tour', onRestart)
  }, [])

  const current = STEPS[step] ?? STEPS[0]!
  const isLast = step === STEPS.length - 1
  const centered = current.selector === null

  const finish = () => {
    markTourDone()
    setOpen(false)
  }
  const next = () => (isLast ? finish() : setStep((value) => value + 1))

  useEffect(() => {
    if (!open) return
    const update = () => {
      if (centered) {
        setRect(null)
        return
      }
      const element = document.querySelector(current.selector ?? '')
      if (!element) {
        setRect(null)
        return
      }
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setRect(element.getBoundingClientRect())
    }
    update()
    const interval = window.setInterval(update, 400)
    return () => window.clearInterval(interval)
  }, [open, step, centered, current.selector])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
      if (event.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const cardStyle = useMemo<React.CSSProperties>(() => {
    if (!rect) return {}
    const margin = 12
    const cardWidth = 340
    let left = rect.left + rect.width + margin
    if (left + cardWidth > window.innerWidth - margin) left = rect.left - cardWidth - margin
    if (left < margin) left = Math.max(margin, rect.left)
    const top = Math.min(Math.max(margin, rect.top), Math.max(margin, window.innerHeight - 220))
    return { position: 'fixed', left, top, width: cardWidth }
  }, [rect])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label={t('Selamat datang di StockSpace')}
    >
      {/* Spotlight mask */}
      {rect ? (
        <div
          aria-hidden
          className="absolute rounded-card border-2 border-primary bg-ink/45 shadow-[0_0_0_9999px_rgba(21,27,74,0.45)] transition-all duration-300"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-ink/45 transition-opacity duration-300" />
      )}

      {/* Card */}
      <div
        style={
          rect
            ? cardStyle
            : {
                position: 'fixed',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 380,
              }
        }
        className="rounded-card border border-line bg-surface p-5 shadow-xl transition-all duration-300"
        ref={() => {
          cancelAnimationFrame(rafRef.current)
        }}
      >
        <p className="text-[11px] font-bold tracking-wide text-primary uppercase">
          {step === 0 ? t('Mulai Tur') : `${step + 1} / ${STEPS.length}`}
        </p>
        <h2 className="mt-1 text-base font-extrabold text-ink">{t(current.titleKey)}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t(current.bodyKey)}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5" aria-hidden>
            {STEPS.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === step ? 'w-5 bg-primary' : 'w-1.5 bg-line'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={finish}
              className="rounded-control px-3 py-1.5 text-xs font-bold text-muted hover:bg-canvas hover:text-ink"
            >
              {t('Lewati')}
            </button>
            <button
              type="button"
              onClick={next}
              autoFocus
              className="rounded-control bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary-hover"
            >
              {isLast ? t('Selesai') : t('Lanjut')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
