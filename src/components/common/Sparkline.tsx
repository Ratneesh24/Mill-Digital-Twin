/**
 * Inline sparkline for the compact KPI modules (§11.3).
 *
 * Hand-drawn SVG rather than a chart library: nine of these repaint twice a
 * second beside the 3D scene, and a full charting component per KPI would cost
 * far more than the pixels are worth.
 */

import { useMemo } from 'react'
import { useTrend } from '../../utils/useTelemetry'
import type { TelemetrySignal } from '../../types/telemetry'

interface Props {
  signal: TelemetrySignal
  color: string
  width?: number
  height?: number
}

export function Sparkline({ signal, color, width = 88, height = 22 }: Props) {
  const points = useTrend(signal, '1m')

  const path = useMemo(() => {
    if (points.length < 2) return null
    let min = Infinity
    let max = -Infinity
    for (const p of points) {
      if (p.value < min) min = p.value
      if (p.value > max) max = p.value
    }
    // A flat signal has no range; centre it rather than dividing by zero.
    const span = max - min
    const pad = span < 1e-9 ? 1 : span * 0.12
    const lo = min - pad
    const hi = max + pad

    const n = points.length
    return points
      .map((p, i) => {
        const x = (i / (n - 1)) * width
        const y = height - ((p.value - lo) / (hi - lo)) * height
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [points, width, height])

  if (!path) {
    return <div style={{ width, height }} className="border-line/60 border-b border-dashed" />
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
