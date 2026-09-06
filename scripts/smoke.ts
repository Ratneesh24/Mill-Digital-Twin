/**
 * BROWSER SMOKE TEST.
 *
 * Loads the running dev server in a real Chromium, drives the twin through a
 * few interactions, and fails on any console error, page error or failed
 * request. §20.1 asks for "zero runtime errors, clean console" — this is how
 * that is checked rather than assumed.
 *
 * Run the dev server first, then:  npx tsx scripts/smoke.ts
 */

import { existsSync } from 'node:fs'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const URL = process.env.SMOKE_URL ?? 'http://localhost:5173/'
const OUT_DIR = process.env.SMOKE_OUT ?? '.'

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

function findBrowser(): string {
  const found = CANDIDATES.find((p) => existsSync(p))
  if (!found) throw new Error('No Chrome or Edge installation found')
  return found
}

const problems: string[] = []

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png` as `${string}.png` })
  console.log(`  captured ${name}.png`)
}

async function main(): Promise<void> {
  const executablePath = findBrowser()
  console.log(`Browser: ${executablePath}`)
  console.log(`Target:  ${URL}\n`)

  const browser: Browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      // Software WebGL so the 3D scene renders on a headless CI box too.
      '--enable-unsafe-swiftshader',
      '--window-size=1920,1080',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  })

  const page = await browser.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
    if (msg.type() === 'warning' && !msg.text().includes('THREE.')) {
      console.log(`  warn: ${msg.text().slice(0, 160)}`)
    }
  })
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? 'unknown'
    // The LIVE-mode WebSocket is expected to fail: there is no gateway here.
    if (req.url().startsWith('ws')) return
    problems.push(`requestfailed: ${req.url()} — ${failure}`)
  })

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60_000 })

  // The twin has to actually put a canvas on the screen.
  await page.waitForSelector('canvas', { timeout: 30_000 })
  const canvasSize = await page.$eval('canvas', (el) => ({
    w: (el as HTMLCanvasElement).width,
    h: (el as HTMLCanvasElement).height,
  }))
  console.log(`  canvas ${canvasSize.w}×${canvasSize.h}`)
  if (canvasSize.w < 100 || canvasSize.h < 100) problems.push('canvas did not size')

  // Let the simulation run so the mill is at standstill-ready.
  await new Promise((r) => setTimeout(r, 2500))
  await shot(page, 'twin-01-ready')

  // Start rolling.
  const started = await clickByText(page, 'START')
  if (!started) throw new Error('START control missing or disabled')
  console.log(`  START clicked: ${started}`)
  await new Promise((r) => setTimeout(r, 9000))
  await page.waitForFunction(() => document.body.innerText.includes('ROLLING'), { timeout: 15_000 })
  await shot(page, 'twin-02-rolling')

  const readouts = await page.$$eval('.num', (els) =>
    els.slice(0, 400).map((e) => e.textContent ?? ''),
  )
  console.log(`  ${readouts.length} numeric readouts on screen`)

  // Close view on the roll stack.
  await clickByText(page, 'STAND')
  await new Promise((r) => setTimeout(r, 1500))
  await shot(page, 'twin-02b-stand')
  await clickByText(page, 'LINE')
  await new Promise((r) => setTimeout(r, 800))

  // Walk the tabs — every page must render.
  for (const [tab, name] of [
    ['PASS SCHEDULE', 'twin-03-pass-schedule'],
    ['TAG INVENTORY', 'twin-04-tags'],
    ['PLANT CONFIG', 'twin-05-config'],
    ['VALIDATION', 'twin-06-validation'],
  ] as const) {
    const clicked = await clickByText(page, tab)
    if (!clicked) problems.push(`tab not found: ${tab}`)
    await new Promise((r) => setTimeout(r, 1200))
    await shot(page, name)
  }

  await clickByText(page, 'OVERVIEW')
  await new Promise((r) => setTimeout(r, 800))

  // §7.4 degradation: switching to the 46-tag profile must turn the values the
  // CRM04 extract does not carry into "NO TAG", not into plausible numbers.
  const beforeNoTag = await countNoTag(page)
  await clickByText(page, 'SIM ·')
  await new Promise((r) => setTimeout(r, 3000))
  const afterNoTag = await countNoTag(page)
  console.log(`  NO TAG badges: ${beforeNoTag} in SIMULATION → ${afterNoTag} in SIM·46-TAG`)
  if (afterNoTag <= beforeNoTag) {
    problems.push('SIM·46-TAG did not degrade any readout to NO TAG')
  }
  await shot(page, 'twin-07-46tag')

  await clickByText(page, 'SIMULATION')
  await new Promise((r) => setTimeout(r, 1500))

  // An unavailable gateway must not leave simulation selected or controls armed.
  // Stub the transport so this negative-path check produces no expected console errors.
  await page.evaluate(() => {
    window.WebSocket = class {
      onopen = null
      onmessage = null
      onerror = null
      onclose = null
      close() {}
    } as unknown as typeof WebSocket
  })
  await page.click('button[title="WebSocket feed from the industrial edge gateway. Read-only (§14.4)."]')
  await page.waitForSelector('button[aria-label^="Edit gateway WebSocket URL"]')
  const liveSafe = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')]
    return buttons.some((button) => button.textContent?.trim() === 'LIVE' && button.getAttribute('aria-pressed') === 'true') &&
      buttons.some((button) => button.textContent?.trim() === 'START' && button.disabled) &&
      document.body.innerText.includes('LAST VALID DATA: NEVER')
  })
  if (!liveSafe) problems.push('Unconnected LIVE mode retained simulation controls or data')
  await clickByText(page, 'SIMULATION')

  for (const [width, height] of [[1366, 768], [768, 1024], [390, 844]]) {
    await page.setViewport({ width, height })
    await new Promise((r) => setTimeout(r, 1500))
    const layout = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')!.getBoundingClientRect()
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      }
    })
    if (layout.overflow) problems.push(`Page overflows horizontally at ${width}px`)
    if (layout.canvasWidth < 100 || layout.canvasHeight < 100) problems.push(`Twin collapsed at ${width}px`)
    const clippedControls = await page.evaluate(() => {
      const bounds = document.querySelector('.twin-viewport')!.getBoundingClientRect()
      return [...document.querySelectorAll('.twin-viewport button')].some((button) => {
        const rect = button.getBoundingClientRect()
        return rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom
      })
    })
    if (clippedControls) problems.push(`Twin controls clipped at ${width}px`)
    await shot(page, `twin-responsive-${width}`)
    await clickByText(page, 'PASS SCHEDULE')
    await new Promise((r) => setTimeout(r, 500))
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) {
      problems.push(`Pass schedule overflows horizontally at ${width}px`)
    }
    await clickByText(page, 'OVERVIEW')
  }

  await browser.close()

  console.log('')
  if (problems.length === 0) {
    console.log('SMOKE TEST PASSED — clean console, no page errors')
    return
  }
  console.log(`SMOKE TEST FAILED — ${problems.length} problem(s):`)
  for (const p of problems) console.log(`  ${p}`)
  process.exit(1)
}

/** How many readouts on screen are showing "NO TAG". */
async function countNoTag(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Array.from(document.querySelectorAll('span')).filter(
        (s) => (s.textContent ?? '').trim() === 'NO TAG',
      ).length,
  )
}

/** Click the first element whose trimmed text matches exactly. */
async function clickByText(page: Page, text: string): Promise<boolean> {
  return page.evaluate((target) => {
    const nodes = Array.from(document.querySelectorAll('button'))
    const match = nodes.find((n) => (n.textContent ?? '').trim().startsWith(target))
    if (!match || match.disabled) return false
    match.click()
    return true
  }, text)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
