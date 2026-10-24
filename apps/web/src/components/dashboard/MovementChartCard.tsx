import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardHeader } from '@/components/ui/Card'
import { movementSeries } from '@/lib/stats'
import { movements } from '@/mocks/warehouse-data'

interface TooltipPayloadItem {
  dataKey?: string | number
  value?: number | string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-bold text-ink">{label}</p>
      {payload.map((item) => (
        <p key={String(item.dataKey)} className="flex items-center gap-1.5 text-muted">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.dataKey === 'masuk' ? '#6546f5' : '#f0445e' }}
          />
          {item.dataKey === 'masuk' ? 'Masuk' : 'Keluar'}:{' '}
          <span className="font-bold text-ink">{item.value}</span>
        </p>
      ))}
    </div>
  )
}

/** Stock movement trend — in/out counts per day over the last 7 days. */
export function MovementChartCard() {
  const data = movementSeries(movements, new Date(), 7)

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Pergerakan Stok"
        subtitle="7 hari terakhir"
        action={
          <div className="flex items-center gap-3 text-[11px] font-semibold text-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-primary" /> Masuk
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-danger" /> Keluar
            </span>
          </div>
        }
      />
      <div className="h-[230px] w-full flex-1 px-2 pt-4 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="masukFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6546f5" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#6546f5" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="keluarFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f0445e" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#f0445e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e8ebf5" strokeDasharray="4 4" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#7a83a8' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              width={26}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#7a83a8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: '#c9cee6', strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="masuk"
              stroke="#6546f5"
              strokeWidth={2}
              fill="url(#masukFill)"
            />
            <Area
              type="monotone"
              dataKey="keluar"
              stroke="#f0445e"
              strokeWidth={2}
              fill="url(#keluarFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
