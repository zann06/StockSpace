import { Languages } from 'lucide-react'

import { useI18n, type Lang } from '@/i18n'

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n()
  const options: { value: Lang; label: string }[] = [
    { value: 'id', label: 'ID' },
    { value: 'en', label: 'EN' },
  ]
  return (
    <div
      role="group"
      aria-label={t('Bahasa / Language')}
      className="inline-flex items-center gap-0.5 rounded-control border border-line bg-canvas p-0.5"
    >
      {!compact ? <Languages aria-hidden className="mx-1.5 h-3.5 w-3.5 text-muted" /> : null}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={lang === option.value}
          onClick={() => setLang(option.value)}
          className={`rounded-[10px] px-2 py-1 text-[11px] font-bold transition-colors ${
            lang === option.value
              ? 'bg-surface text-primary shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
