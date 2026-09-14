/**
 * TYPE RAMP GATE
 *
 * The dashboard is read at arm's length from a control desk. Before the type
 * ramp landed there were 134 arbitrary `text-[Npx]` values across 11 distinct
 * sizes, the smallest of them 9px — below the legible threshold at that
 * distance. The ramp replaced all of them with six named steps, floored at
 * 11px.
 *
 * Nothing stops that eroding back except this check: a ramp is only a ramp
 * while it is the *only* way to set a size. Use text-micro / text-meta /
 * text-body / text-value / text-value-lg / text-hero (declared in the @theme
 * block of src/index.css).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'src'

/** Arbitrary Tailwind font sizes: text-[13px], text-[0.8rem], text-[2em]. */
const ARBITRARY_SIZE = /text-\[[\d.]+(?:px|rem|em|pt)\]/g

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.tsx') ? [full] : []
  })
}

const offences: string[] = []

for (const file of walk(ROOT)) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const hit of line.match(ARBITRARY_SIZE) ?? []) {
        offences.push(`  ${file}:${i + 1}  ${hit}`)
      }
    })
}

if (offences.length > 0) {
  console.error(
    `\nArbitrary font sizes found (${offences.length}). Use the type ramp instead:\n` +
      `  text-micro (11px)  text-meta (12px)  text-body (14px)\n` +
      `  text-value (20px)  text-value-lg (28px)  text-hero (44px)\n\n` +
      offences.join('\n') +
      '\n',
  )
  process.exit(1)
}

console.log(`type ramp: clean (${walk(ROOT).length} tsx files, no arbitrary sizes)`)
