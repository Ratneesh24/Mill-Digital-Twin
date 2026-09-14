/**
 * BROWSER SMOKE TEST.
 *
 * Loads the running Blazor workspace in a real Chromium, drives it through a few
 * interactions, and fails on any console error, page error or failed request.
 * §20.1 asks for "zero runtime errors, clean console" — this is how that is
 * checked rather than assumed.
 *
 *   dotnet run --project dotnet/src/Crm04.Api    # :5200
 *   dotnet run --project dotnet/src/Crm04.Web    # :5240
 *   npm run check:smoke
 *
 * WHAT CHANGED WHEN THIS RETARGETED FROM REACT TO BLAZOR. The class names
 * survived the port, so most of this file did too. Three things did not, and
 * they are architecture, not cosmetics:
 *
 *  1. THERE IS NO IN-BROWSER SOLVER. The React app ran a SimulationEngine in the
 *     tab and START commanded it. The Blazor app's mill motion arrives from the
 *     API's replay feed, so its START/STOP controls are rendered DISABLED with
 *     the reason stated — "a working START button would be a lie". This test now
 *     waits for the feed to reach ROLLING on its own and asserts the commands
 *     stay disabled, which is the real contract.
 *
 *  2. LIVE MODE IS A SERVER-SIDE RE-BADGE. The browser never talks to a gateway;
 *     the API re-badges provenance and pushes a new catalogue. The old negative
 *     path stubbed `window.WebSocket` to simulate an absent gateway — doing that
 *     here would kill the Blazor circuit itself, since that same WebSocket IS
 *     the app. Mode switching is checked through what it actually changes: the
 *     number of readouts degraded to NO TAG.
 *
 *  3. ESCAPE DOES NOT CLOSE THE DIAGNOSTICS DIALOG. DiagnosticsDialog.razor
 *     wires no key handler; it closes on the ✕ or the overlay. That is a real
 *     gap against the React original and is called out in LIMITATIONS — this
 *     test asserts the ✕ path that does work rather than a behaviour that does
 *     not exist.
 */

import { existsSync } from 'node:fs'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const URL = process.env.SMOKE_URL ?? 'http://localhost:5240/'
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

/**
 * Blazor Server sends prerendered HTML first and wires it up when the circuit
 * connects. A click landing in that gap does nothing at all — no error, no
 * effect — so every interaction below must wait for this first.
 */
async function waitInteractive(page: Page): Promise<void> {
  await page.waitForFunction(() => 'Blazor' in window, { timeout: 30_000 })
  // A live clock proves the circuit is not merely open but delivering frames.
  await page.waitForFunction(
    () => !document.body.innerText.includes('--:--:--'),
    { timeout: 30_000 },
  )
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
    // Two WebSockets are load-bearing here — the Blazor circuit and the twin's
    // own feed to the API. Both are torn down by navigation and disposal, which
    // surfaces as a "failed" request that means nothing. A twin feed that truly
    // cannot open renders `.twin-error`, which is asserted directly below.
    if (req.url().startsWith('ws')) return
    problems.push(`requestfailed: ${req.url()} — ${failure}`)
  })

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60_000 })

  // The app opens on /dashboard, which deliberately renders no <canvas> — the
  // 3D twin lives on its own route. Everything below drives the twin, so go
  // there first.
  await page.waitForSelector('.workspace-nav', { timeout: 30_000 })
  await waitInteractive(page)
  if (!(await clickByText(page, '3D DIGITAL TWIN'))) throw new Error('3D twin nav link not found')

  // The twin has to actually put a canvas on the screen. The scene module sizes
  // it from a resize observer after init, so let it settle before measuring or
  // the size assertion reads an unsized element.
  await page.waitForSelector('.twin-viewport canvas', { timeout: 30_000 })
  await new Promise((r) => setTimeout(r, 2500))
  const canvasSize = await page.$eval('canvas', (el) => ({
    w: (el as HTMLCanvasElement).width,
    h: (el as HTMLCanvasElement).height,
  }))
  console.log(`  canvas ${canvasSize.w}×${canvasSize.h}`)
  if (canvasSize.w < 100 || canvasSize.h < 100) problems.push('canvas did not size')

  // A scene that failed to start says so in the DOM rather than throwing.
  const twinError = await page.$eval('.twin-viewport', (el) => {
    const e = el.querySelector('.twin-error')
    return e ? (e.textContent ?? '').trim().slice(0, 200) : null
  })
  if (twinError) problems.push(`3D view unavailable: ${twinError}`)

  await shot(page, 'twin-01-ready')

  // The replay feed drives the mill; nothing in the browser starts it. Reaching
  // ROLLING unaided is the assertion that the feed is actually flowing.
  await page.waitForFunction(() => document.body.innerText.includes('ROLLING'), { timeout: 30_000 })
  await shot(page, 'twin-02-rolling')

  // ...and the command strip must stay disabled while that is true. An enabled
  // START on a replay feed would be the exact lie the port set out to avoid.
  const commandsInert = await page.evaluate(() =>
    [...document.querySelectorAll('.twin-viewport button')]
      .filter((b) => ['START', 'STOP', 'FAST STOP', 'RESET'].includes((b.textContent ?? '').trim()))
      .every((b) => (b as HTMLButtonElement).disabled),
  )
  if (!commandsInert) problems.push('Replay feed left a simulation command enabled')

  const readouts = await page.$$eval('.num', (els) =>
    els.slice(0, 400).map((e) => e.textContent ?? ''),
  )
  console.log(`  ${readouts.length} numeric readouts on screen`)

  // THE EQUIPMENT INSPECTOR IS A CIRCUIT-KILLER IF IT REGRESSES. Selecting a
  // part renders ValueReadouts for its tags, and that render path once threw on
  // every attempt (`key=` on a component instead of `@key`), tearing down the
  // circuit. A dead circuit does not look broken — the DOM is intact and clicks
  // simply stop doing anything — so exercise it here and then prove the app is
  // still alive, rather than trusting that the page still looks right.
  const inspected = await page.evaluate(() => {
    const select = document.querySelector('.twin-viewport select') as HTMLSelectElement | null
    if (!select || select.options.length < 2) return false
    select.value = select.options[1].value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })
  if (!inspected) problems.push('equipment inspector not found on the twin page')
  await new Promise((r) => setTimeout(r, 2500))
  if (!(await circuitAlive(page))) {
    problems.push('Blazor circuit died after selecting equipment in the inspector')
  }

  // Close view on the roll stack. The camera presets are a `.segmented` group,
  // whose active button must carry aria-pressed="true" — the stylesheet keys the
  // fill on that exact value, so a bool-shaped attribute would silently unstyle it.
  await clickByText(page, 'STAND')
  await new Promise((r) => setTimeout(r, 1500))
  const viewPressed = await page.evaluate(() => {
    const b = document.querySelector('.twin-viewport .segmented > button[aria-pressed="true"]')
    return b ? (b.textContent ?? '').trim() : null
  })
  if (viewPressed !== 'STAND') {
    problems.push(`camera preset did not register as pressed (got ${viewPressed ?? 'none'})`)
  }
  await shot(page, 'twin-02b-stand')
  await clickByText(page, 'LINE')
  await new Promise((r) => setTimeout(r, 800))

  // Walk the three pages — every one must render, and we must actually ARRIVE.
  for (const [label, path, marker, name] of [
    ['REAL-TIME TRENDS', '/trends', '.dashboard-trendspage', 'p2-trends'],
    ['DASHBOARD', '/dashboard', '.kpi-ribbon', 'p1-dashboard'],
  ] as const) {
    if (!(await navigate(page, label, path, marker))) {
      problems.push(`navigating to ${label} did not arrive at ${path}`)
    }
    await shot(page, name)
  }

  // The diagnostics dialog is where Tag Inventory, Plant Config and Validation
  // moved to when the workspace collapsed to three pages. Each must still open
  // AND render content — an empty tab body is the failure worth catching.
  if (!(await clickByText(page, 'MODEL / DATA'))) {
    problems.push('MODEL / DATA STATUS chip not found')
  }
  await page.waitForSelector('.diagnostics-panel', { timeout: 15_000 })
  await new Promise((r) => setTimeout(r, 800))

  // A MODAL THAT EXISTS IS NOT A MODAL THAT WORKS, and this test used to check
  // only that it existed. `position: fixed` does not resolve against the viewport
  // when an ancestor carries a transform, filter, backdrop-filter, perspective,
  // will-change or contain — that ancestor becomes the containing block. The chip
  // opening this dialog sits inside `.brand-header`, which has
  // `backdrop-filter: blur(8px)`, and the panel duly centred itself on the 128px
  // header: hanging off the top of the screen with an overlay that dimmed only
  // the header strip. Existence assertions sailed straight past it, so measure
  // where the thing actually landed.
  const modal = await page.evaluate(() => {
    const panel = document.querySelector('.diagnostics-panel')
    const overlay = document.querySelector('.diagnostics-overlay')
    if (!panel || !overlay) return null
    const p = panel.getBoundingClientRect()
    const o = overlay.getBoundingClientRect()
    return {
      onScreen:
        p.top >= -1 && p.left >= -1 &&
        p.bottom <= window.innerHeight + 1 && p.right <= window.innerWidth + 1,
      panelTop: Math.round(p.top),
      panelHeight: Math.round(p.height),
      overlayCovers:
        o.width >= window.innerWidth - 1 && o.height >= window.innerHeight - 1,
      overlayHeight: Math.round(o.height),
      viewportHeight: window.innerHeight,
    }
  })
  if (!modal) {
    problems.push('diagnostics overlay or panel missing')
  } else {
    if (!modal.overlayCovers) {
      problems.push(
        `diagnostics overlay covers ${modal.overlayHeight}px of a ` +
          `${modal.viewportHeight}px viewport — a transform/filter ancestor is ` +
          'capturing position:fixed',
      )
    }
    if (!modal.onScreen) {
      problems.push(
        `diagnostics panel is off-screen (top ${modal.panelTop}px, ` +
          `height ${modal.panelHeight}px)`,
      )
    }
  }

  for (const [section, name] of [
    ['Feed', 'diag-01-feed'],
    ['Tags', 'diag-02-tags'],
    ['Plant', 'diag-03-config'],
    ['Events', 'diag-04-events'],
    ['Checks', 'diag-05-validation'],
  ] as const) {
    const clicked = await page.evaluate((tab) => {
      const b = [...document.querySelectorAll('.diagnostics-panel [role="tab"]')].find(
        (x) => (x.textContent ?? '').trim() === tab,
      ) as HTMLButtonElement | undefined
      if (!b) return false
      b.click()
      return true
    }, section)
    if (!clicked) problems.push(`diagnostics section not found: ${section}`)
    await new Promise((r) => setTimeout(r, 1200))
    const bodyLength = await page.$eval(
      '.diagnostics-body',
      (el) => (el.textContent ?? '').trim().length,
    )
    if (bodyLength < 100) problems.push(`diagnostics section ${section} rendered ${bodyLength} chars`)
    await shot(page, name)
  }

  // Closes on the ✕, not on Escape — see the note at the top of this file.
  const closed = await page.evaluate(() => {
    const b = document.querySelector(
      '.diagnostics-panel button[aria-label="Close diagnostics"]',
    ) as HTMLButtonElement | null
    if (!b) return false
    b.click()
    return true
  })
  if (!closed) problems.push('diagnostics close control not found')
  await new Promise((r) => setTimeout(r, 900))
  if (await page.$('.diagnostics-panel')) {
    problems.push('diagnostics dialog did not close')
  }

  // §7.4 degradation: switching to the 46-tag profile must turn the values the
  // CRM04 extract does not carry into "NO TAG", not into plausible numbers.
  //
  // THE OPERATING MODE IS SERVER-SIDE GLOBAL STATE, not a browser preference —
  // the API re-badges the feed and pushes a new catalogue, and that outlives the
  // browser, the page and this whole test run. So the starting mode has to be
  // ESTABLISHED, never assumed. Assuming it is how this check quietly became a
  // no-op: a previous run exited in SIM·46-TAG, so "switch to 46-tag" changed
  // nothing and the comparison read 46 → 46 and still called itself a pass.
  if (!(await setMode(page, 'SIMULATION'))) {
    problems.push('could not put the feed into SIMULATION mode to measure from')
  }
  const beforeNoTag = await countNoTag(page)

  if (!(await setMode(page, 'SIM ·'))) problems.push('could not switch to SIM · 46-TAG')
  // The re-badged catalogue lands a frame or two after the mode flag itself.
  await page.waitForFunction(
    (before: number) =>
      [...document.querySelectorAll('span')].filter((s) => (s.textContent ?? '').trim() === 'NO TAG')
        .length > before,
    { timeout: 20_000 },
    beforeNoTag,
  ).catch(() => {})
  const afterNoTag = await countNoTag(page)
  console.log(`  NO TAG badges: ${beforeNoTag} in SIMULATION → ${afterNoTag} in SIM·46-TAG`)
  if (afterNoTag <= beforeNoTag) {
    problems.push(
      `SIM·46-TAG did not degrade any readout to NO TAG (${beforeNoTag} → ${afterNoTag})`,
    )
  }
  await shot(page, 'twin-07-46tag')

  // LIVE is read-only with respect to the machine and, on this stack, is the
  // same feed re-badged. It must switch cleanly and leave the workspace
  // rendering — any breakage shows up in the console listener above.
  if (!(await setMode(page, 'LIVE'))) problems.push('could not switch to LIVE')
  const liveOk = await page.evaluate(
    () =>
      !!document.querySelector('.kpi-ribbon') &&
      !!document.querySelector('.operating-context') &&
      document.querySelectorAll('.kpi-tile').length > 0,
  )
  if (!liveOk) problems.push('LIVE mode left the dashboard unrendered')

  // Leave the feed as we found it. This is not tidiness: skip it and the NEXT
  // run starts in the wrong mode and its degradation check silently passes on a
  // comparison that never happened.
  if (!(await setMode(page, 'SIMULATION'))) {
    problems.push('failed to restore SIMULATION mode for the next run')
  }

  for (const [width, height] of [[1366, 768], [768, 1024], [390, 844]]) {
    await page.setViewport({ width, height })
    // The canvas and `.twin-viewport` assertions below only exist on the 3D
    // page, and the tour above left us elsewhere. Go back before measuring.
    await clickByText(page, '3D DIGITAL TWIN')
    await page.waitForSelector('.twin-viewport canvas', { timeout: 30_000 })
    await new Promise((r) => setTimeout(r, 2500))
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
        return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1
      })
    })
    if (clippedControls) problems.push(`Twin controls clipped at ${width}px`)
    await shot(page, `twin-responsive-${width}`)

    // The dashboard is the densest page; if anything overflows at a narrow
    // viewport it will be this one.
    await clickByText(page, 'DASHBOARD')
    await new Promise((r) => setTimeout(r, 1200))
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) {
      problems.push(`Dashboard overflows horizontally at ${width}px`)
    }
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

/**
 * Click a nav link and verify the app ACTUALLY ARRIVED.
 *
 * Clicking is not evidence of navigating. When the Blazor circuit dies the DOM
 * stays exactly as it was — links present, enabled, clickable — and every click
 * silently does nothing. This walk used to assert only that the link was found
 * and clicked, so a circuit killed on the 3D page left the test measuring the
 * twin over and over while reporting a clean pass.
 */
async function navigate(page: Page, label: string, path: string, marker: string): Promise<boolean> {
  if (!(await clickByText(page, label))) return false
  try {
    await page.waitForFunction(
      (want: string) => window.location.pathname === want,
      { timeout: 15_000 },
      path,
    )
    await page.waitForSelector(marker, { timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

/**
 * Is the circuit still up? Blazor reveals `#blazor-error-ui` (display:none by
 * default) when it tears one down, which is the one visible trace an otherwise
 * invisible failure leaves behind.
 */
async function circuitAlive(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const err = document.querySelector('#blazor-error-ui')
    if (!err) return true
    return getComputedStyle(err).display === 'none'
  })
}

/**
 * Put the feed into an operating mode and wait until the UI confirms it.
 *
 * Clicking once is not enough, for three compounding reasons: `SetModeAsync` is
 * a server round-trip, the mode buttons disable themselves while it is in
 * flight, and the new mode only reaches this browser on a later telemetry
 * frame. A click that lands on a momentarily-disabled button is dropped in
 * silence. So: click, wait for aria-pressed="true" on the target, and retry.
 *
 * Scoped to the operating-mode group deliberately — "LIVE" also names a
 * provenance badge and the trends pause control.
 */
async function setMode(page: Page, label: string): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt++) {
    for (let i = 0; i < 10; i++) {
      const state = await page.evaluate((want) => {
        const group = document.querySelector('[role="group"][aria-label="Operating mode"]')
        if (!group) return 'NO GROUP'
        const buttons = [...group.querySelectorAll('button')]
        for (const b of buttons) {
          if ((b.textContent ?? '').trim().startsWith(want)) {
            if (b.getAttribute('aria-pressed') === 'true') return 'PRESSED'
            return b.disabled ? 'BUSY' : 'READY'
          }
        }
        return 'NOT FOUND'
      }, label)
      if (state === 'PRESSED') return true
      if (state === 'NO GROUP' || state === 'NOT FOUND') return false
      if (state === 'READY') break
      await new Promise((r) => setTimeout(r, 500))
    }

    await page.evaluate((want) => {
      const group = document.querySelector('[role="group"][aria-label="Operating mode"]')
      if (!group) return
      const buttons = [...group.querySelectorAll('button')]
      for (const b of buttons) {
        if ((b.textContent ?? '').trim().startsWith(want) && !b.disabled) {
          b.click()
          return
        }
      }
    }, label)

    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const ok = await page.evaluate((want) => {
        const group = document.querySelector('[role="group"][aria-label="Operating mode"]')
        if (!group) return false
        const buttons = [...group.querySelectorAll('button')]
        for (const b of buttons) {
          if ((b.textContent ?? '').trim().startsWith(want)) {
            return b.getAttribute('aria-pressed') === 'true'
          }
        }
        return false
      }, label)
      if (ok) return true
    }
  }
  return false
}

/**
 * Click the first enabled control whose text starts with `target`.
 * Anchors as well as buttons: the page nav is Blazor NavLinks.
 */
async function clickByText(page: Page, text: string): Promise<boolean> {
  return page.evaluate((target) => {
    const nodes = Array.from(document.querySelectorAll('button, a'))
    const match = nodes.find((n) => (n.textContent ?? '').trim().startsWith(target))
    if (!match) return false
    if (match instanceof HTMLButtonElement && match.disabled) return false
    ;(match as HTMLElement).click()
    return true
  }, text)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
