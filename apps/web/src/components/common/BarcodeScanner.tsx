import { useEffect, useRef, useState } from 'react'
import { ScanLine, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { useI18n } from '@/i18n'

interface DetectedBarcode {
  rawValue: string
}

/**
 * Camera barcode scanning via the native BarcodeDetector API (Chrome/Android;
 * Safari/Firefox fall back to manual entry). Calls `onDetect` with the decoded
 * value and closes itself.
 */
export function BarcodeScanner({
  onDetect,
  onClose,
}: {
  onDetect: (value: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [detected, setDetected] = useState<string | null>(null)

  // Render-time capability check — avoids setState inside the camera effect.
  const Detector = (
    window as unknown as {
      BarcodeDetector?: new (options?: { formats: string[] }) => {
        detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
      }
    }
  ).BarcodeDetector
  const unsupported = !Detector || !navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    if (unsupported) return

    let cancelled = false
    let stream: MediaStream | null = null
    const detector = new Detector({
      formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code'],
    })

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = mediaStream
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          void videoRef.current.play()
        }
        const tick = async () => {
          if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              setDetected(codes[0].rawValue)
              onDetect(codes[0].rawValue)
              return // stop scanning after first hit
            }
          } catch {
            // transient decode failures are normal between frames
          }
          if (!cancelled) window.setTimeout(() => void tick(), 350)
        }
        void tick()
      })
      .catch(() => {
        if (!cancelled) setError(t('Akses kamera ditolak — masukkan SKU secara manual.'))
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onDetect, t])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('Pindai Barcode')}
    >
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <ScanLine aria-hidden className="h-4 w-4 text-primary" />
            {t('Pindai Barcode')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Batal')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-control bg-warning-soft px-3 py-2 text-xs font-semibold text-warning-fg"
          >
            {error}
          </p>
        ) : (
          <div className="relative mt-4 overflow-hidden rounded-control bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
            {detected ? (
              <p className="absolute inset-x-0 bottom-0 bg-success/90 px-3 py-2 text-center text-xs font-bold text-white">
                {detected}
              </p>
            ) : null}
          </div>
        )}

        <p className="mt-3 text-xs leading-relaxed text-muted">
          {t('Arahkan kamera ke barcode produk. Hasil pindaian otomatis mengisi kolom produk.')}
        </p>

        <Button variant="secondary" className="mt-3 w-full" onClick={onClose}>
          {t('Tutup')}
        </Button>
      </div>
    </div>
  )
}
