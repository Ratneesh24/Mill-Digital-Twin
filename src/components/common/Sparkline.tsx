/**
 * Inline sparkline for the compact KPI modules (§11.3).
 *
 * Hand-drawn SVG rather than a chart library: nine of these repaint twice a
 * second beside the 3D scene, and a full charting component per KPI would cost
 * far more than the pixels are worth.
 */

import { useId, useMemo } from 'react'
import { useTrend } from '../../utils/useTelemetry'
import type { TelemetrySignal } from '../../types/telemetry'

interface Props {
  signal: TelemetrySignal
  color: string
  width?: number
  height?: number
  /**
   * Stretch to the container's width instead of sitting at a fixed size. The
   * hero KPI cards are fluid, and a fixed-width trace floating in a much wider
   * card reads as an accident. `width` still sets the viewBox, so it controls
   * the horizontal resolution of the path, not the rendered size.
   */
  fluid?: boolean
}

export function Sparkline({ signal, color, width = 88, height = 22, fluid = false }: Props) {
  const points = useTrend(signal, '1m')
  const gradientId = useId()

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
    return (
      <div
        style={{ width: fluid ? '100%' : width, height }}
        className="border-line/60 border-b border-dashed"
      />
    )
  }

  return (
    <svg
      width={fluid ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // `none` lets the trace stretch horizontally to fill the card. The stroke
      // stays 1.25px because of vectorEffect, so it never distorts.
      preserveAspectRatio={fluid ? 'none' : undefined}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={`${path} L${width.toFixed(1)},${height} L0,${height} Z`} fill={`url(#${gradientId})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={fluid ? 1.75 : 1.25}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
