/**
 * HINT — the explanatory tooltip used across the workspace.
 *
 * Replaces bare `title=` attributes, which are unreachable by keyboard and
 * invisible on touch. Radix renders through a portal, which matters here for a
 * concrete reason: `.panel { overflow: hidden }` clips anything a panel tries
 * to float over its own edge, so an in-tree tooltip inside a panel is simply
 * not visible.
 *
 * `asChild` merges the trigger props onto the child element rather than adding
 * a wrapper, so `aria-pressed`, `aria-current` and the 44px hit targets on the
 * controls this wraps all survive untouched.
 */

import type { ReactElement, ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'

export function Hint({
  label,
  children,
  side = 'top',
}: {
  /** The explanation. Omit to render the child unwrapped. */
  label?: ReactNode
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  if (!label) return children

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className="border-line bg-base-900 text-text-dim text-meta z-50 max-w-[280px] rounded-[10px] border px-2.5 py-2 leading-relaxed shadow-[var(--shadow-pop)]"
        >
          {label}
          <Tooltip.Arrow className="fill-[var(--color-line)]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
