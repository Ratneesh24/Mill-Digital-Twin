/**
 * LAYOUT PROBE.
 *
 * Neither `tsc` nor `npm run validate` can see any of what this checks: one
 * does not read CSS, the other drives the simulation engine headlessly without
 * a browser. Every failure mode of this UI is silent — no error, no type
 * failure, just a chart that is 0px tall or a caption nobody can read.
 *
 * The load-bearing assertion is `trendBand === title + legend + plot`. It tests
 * the *contract* rather than a number, so it keeps working after a density or
 * viewport change.
 *
 * TARGET: the Blazor workspace on :5240, which is the delivered UI. It needs the
 * API on :5200 behind it — the trend plot draws from that feed, so start both:
 *
 *   dotnet run --project dotnet/src/Crm04.Api    # :5200
 *   dotnet run --project dotnet/src/Crm04.Web    # :5240
 *   npm run check:layout
 *
 * The Blazor port preserved every class name, so these assertions carry over
 * unchanged from the React original with one exception: the trend plot is
 * inline SVG (`.chart-svg`), not recharts.
 */

import { existsSync } from 'node:fs'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const BASE = (process.env.SMOKE_URL ?? 'http://localhost:5240').replace(/\/$/, '')
const OUT_DIR = process.env.SMOKE_OUT ?? '.'

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

/** Viewports that between them exercise every breakpoint in index.css. */
const VIEWPORTS: Array<[number, number]> = [
  [1920, 1080],
  [1600, 900],
  [1366, 768],
  [1280, 800],
  [1024, 768],
  [390, 844],
]

const problems: string[] = []

function check(condition: boolean, message: string): void {
  if (!condition) problems.push(message)
}

async function measureDashboard(page: Page) {
  // NOTE: no named function expressions inside evaluate(). esbuild (via tsx)
  // compiles them with a `__name` helper that does not exist in the page.
  return page.evaluate(() => {
    const active = document.querySelector('.workspace-nav a[aria-current="page"]')
    return {
      context: document.querySelector('.operating-context')?.getBoundingClientRect().height ?? -1,
      tiles: document.querySelectorAll('.kpi-tile').length,
      groups: document.querySelectorAll('.kpi-group').length,
      paramGroups: document.querySelectorAll('.param-group').length,
      systemStatus: !!document.querySelector('.dashboard-main .panel'),
      twinCard: !!document.querySelector('.twin-launch'),
      // The dashboard must NOT contain the 3D canvas or a trend chart. Its mill
      // schematic is SVG and its KPI traces are sparklines — neither is a plot.
      canvas: !!document.querySelector('canvas'),
      chart: !!document.querySelector('.chart-svg'),
      headerRow:
        document.querySelector('.brand-header > div')?.getBoundingClientRect().height ?? -1,
      // The alarm pill is a CONDITIONAL sixth item in the command bar — it is
      // rendered only while the feed carries an active alarm, so the row's
      // content is a function of mill state, not of the viewport.
      alarmPill: !!document.querySelector('.brand-header [role="status"]'),
      navLinks: document.querySelectorAll('.workspace-nav a').length,
      navUnderline: active ? getComputedStyle(active, '::after').content : 'MISSING',
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      // Leaf elements rendering visible text below the 11px legibility floor.
      // Anything parented directly to <body> is excluded: that is where a
      // measurement or portal node lands, and it is never seen.
      tiny: [...document.querySelectorAll('*')].filter(
        (el) =>
          parseFloat(getComputedStyle(el).fontSize) < 11 &&
          (el.textContent ?? '').trim().length > 0 &&
          el.children.length === 0 &&
          el.parentElement !== document.body,
      ).length,
    }
  })
}

async function measureTrends(page: Page) {
  return page.evaluate(() => {
    const activePill = document.querySelector('.segmented > button[aria-pressed="true"]')
    const panels = document.querySelectorAll('.dashboard-trendspage > .panel')
    const plotPanel = panels[panels.length - 1]
    return {
      band: document.querySelector('.dashboard-trendspage')?.getBoundingClientRect().height ?? -1,
      title: plotPanel?.querySelector('.panel-title')?.getBoundingClientRect().height ?? -1,
      legend: document.querySelector('.trend-legend')?.getBoundingClientRect().height ?? -1,
      plot: document.querySelector('.trend-plot')?.getBoundingClientRect().height ?? -1,
      chart: document.querySelector('.chart-svg')?.getBoundingClientRect().height ?? -1,
      browser: panels.length,
      pillFill: activePill ? getComputedStyle(activePill).backgroundColor : 'MISSING',
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      tiny: [...document.querySelectorAll('*')].filter(
        (el) =>
          parseFloat(getComputedStyle(el).fontSize) < 11 &&
          (el.textContent ?? '').trim().length > 0 &&
          el.children.length === 0 &&
          el.parentElement !== document.body,
      ).length,
    }
  })
}

async function main(): Promise<void> {
  const executablePath = CANDIDATES.find((p) => existsSync(p))
  if (!executablePath) throw new Error('No Chrome or Edge installation found')

  console.log(`Browser: ${executablePath}`)
  console.log(`Target:  ${BASE}\n`)

  const browser: Browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
    defaultViewport: { width: 1920, height: 1080 },
  })

  const page = await browser.newPage()

  for (const [width, height] of VIEWPORTS) {
    await page.setViewport({ width, height })
    const at = `@${width}×${height}`
    const stacked = width < 1280

    // ── DASHBOARD ──────────────────────────────────────────────────────────
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 60_000 })
    await page.waitForSelector('.kpi-ribbon', { timeout: 30_000 })
    await new Promise((r) => setTimeout(r, 1200))
    const d = await measureDashboard(page)

    // Structural: the spec forbids both of these on the dashboard.
    check(!d.canvas, `${at} dashboard renders a 3D canvas — it belongs on /3d-twin only`)
    check(!d.chart, `${at} dashboard renders a trend chart — trends belong on /trends`)

    check(d.navLinks === 3, `${at} nav has ${d.navLinks} links, want exactly 3`)
    check(d.context > 40, `${at} operating context missing or collapsed: ${d.context}px`)
    check(d.groups === 6, `${at} KPI ribbon has ${d.groups} groups, want 6`)
    check(d.tiles >= 18, `${at} only ${d.tiles} KPI tiles rendered`)
    check(d.paramGroups === 8, `${at} ${d.paramGroups} parameter groups, want 8`)
    check(d.systemStatus, `${at} system status panel missing`)
    // The 3D twin lives on /3d-twin via the top nav — no launch card on the
    // dashboard since the visual-executive refresh (hero schematic instead).
    check(
      d.navUnderline !== 'MISSING' && d.navUnderline !== 'none',
      `${at} nav underline gone — aria-current styling broken`,
    )
    check(!d.overflow, `${at} dashboard overflows horizontally`)
    check(d.tiny === 0, `${at} dashboard: ${d.tiny} text elements below 11px`)
    if (!stacked) {
      // One row of controls is ~62px; a wrap roughly doubles it.
      //
      // THE ALARM PILL IS WHY THIS IS NOT A SINGLE NUMBER. Below about 1500px
      // the pill is what tips the bar onto a second row — measured 62px with no
      // pill and 106px with one at the SAME 1280px width. That is `flex-wrap`
      // degrading as designed, not a regression, and the mill alarms whenever
      // the replay feed says so. Asserting a flat 90px here made the check pass
      // or fail on whether the mill happened to be alarming as the page loaded.
      //
      // So: no pill means the bar must still be one row, which keeps the real
      // regression guard; a pill buys the second row and nothing more.
      const limit = d.alarmPill ? 130 : 90
      check(
        d.headerRow > 0 && d.headerRow < limit,
        `${at} command bar too tall: ${d.headerRow}px (limit ${limit}, ` +
          `alarm pill ${d.alarmPill ? 'present' : 'absent'})`,
      )
    }
    await page.screenshot({ path: `${OUT_DIR}/layout-dash-${width}.png` as `${string}.png` })

    // ── TRENDS ─────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/trends`, { waitUntil: 'networkidle2', timeout: 60_000 })
    // The plot only exists once the feed has delivered two points; until then the
    // panel shows "Collecting data…". Waiting on the SVG waits out that state.
    await page.waitForSelector('.chart-svg', { timeout: 30_000 })
    await new Promise((r) => setTimeout(r, 1200))
    const t = await measureTrends(page)

    // The one that matters: the plot must never collapse to nothing.
    check(t.chart > 200, `${at} trend chart collapsed or too short: ${t.chart}px`)
    check(t.browser >= 2, `${at} trends page is missing the parameter browser`)
    check(
      t.pillFill !== 'MISSING' && t.pillFill !== 'rgba(0, 0, 0, 0)',
      `${at} active .segmented pill lost its fill — aria-pressed styling broken`,
    )
    check(!t.overflow, `${at} trends overflows horizontally`)
    check(t.tiny === 0, `${at} trends: ${t.tiny} text elements below 11px`)

    // The height contract, where the band is bounded (≥1024px — below that the
    // page stacks and the band is the sum of rail + plot instead).
    if (width >= 1024) {
      check(
        Math.abs(t.band - (t.title + t.legend + t.plot)) < 2,
        `${at} trend band (${Math.round(t.band)}) != title+legend+plot ` +
          `(${Math.round(t.title)}+${Math.round(t.legend)}+${Math.round(t.plot)})`,
      )
      check(Math.abs(t.title - 46) < 1.5, `${at} panel-title drifted: ${t.title}px (want 46)`)
    }
    await page.screenshot({ path: `${OUT_DIR}/layout-trends-${width}.png` as `${string}.png` })

    console.log(
      `  ${at.padEnd(14)} tiles ${String(d.tiles).padStart(2)}  ` +
        `params ${d.paramGroups}  chart ${String(Math.round(t.chart)).padStart(4)}px  ` +
        `band ${String(Math.round(t.band)).padStart(4)}px  tiny ${d.tiny + t.tiny}  ` +
        `bar ${String(Math.round(d.headerRow)).padStart(3)}px${d.alarmPill ? ' (alarm)' : ''}`,
    )
  }

  await browser.close()

  if (problems.length > 0) {
    console.error(`\n${problems.length} layout problem(s):`)
    for (const p of problems) console.error(`  ✗ ${p}`)
    process.exit(1)
  }
  console.log('\nLayout OK across all viewports.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
