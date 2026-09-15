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
 * THE APP IS LIVE-ONLY. There is no operating-mode selector and no simulation
 * control anywhere: the mode is whatever the feed's source declares, never a
 * click. So instead of switching modes, this test asserts the affordances are
 * ABSENT, and it runs against one of three expected feed states:
 *
 *   SMOKE_EXPECT=feed    (default) any feed, including the Development replay.
 *   SMOKE_EXPECT=live    as above, and NO value may be badged SIM — on a real
 *                        plant feed a SIM badge means the data is not live.
 *   SMOKE_EXPECT=nofeed  no plant frame has arrived: every page must show the
 *                        NO FEED state and draw no mill at all.
 *
 * Other points of design:
 *
 *  1. THERE IS NO IN-BROWSER SOLVER and no command strip. Absence is asserted,
 *     not disabled-ness: a filter over buttons that no longer exist returns [],
 *     and `[].every(...)` is true, so a "commands stay disabled" check would pass
 *     forever while testing nothing.
 *
 *  2. THE BROWSER NEVER TALKS TO A GATEWAY. Stubbing `window.WebSocket` would
 *     kill the Blazor circuit itself, since that same WebSocket IS the app.
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

type Expect = 'feed' | 'live' | 'nofeed'
const EXPECT = (process.env.SMOKE_EXPECT ?? 'feed') as Expect
if (!['feed', 'live', 'nofeed'].includes(EXPECT)) {
  throw new Error(`SMOKE_EXPECT must be feed, live or nofeed (got '${EXPECT}')`)
}

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

  if (EXPECT === 'nofeed') {
    // With no feed the header clock never leaves --:--:--, so waiting for it
    // would time out. Wait for the NO FEED state, then give the circuit a moment
    // to wire up: .no-feed is also in the prerendered HTML.
    await page.waitForSelector('.no-feed', { timeout: 30_000 })
    await new Promise((r) => setTimeout(r, 3000))
    return
  }

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

  // Whatever the feed is doing, nothing may offer a way to choose simulated data.
  await assertNoSimulationAffordances(page)

  if (EXPECT === 'nofeed') {
    await runNoFeed(page)
    await finish(browser)
    return
  }

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

  // The feed drives the page; nothing in the browser starts it. The NO FEED
  // curtain lifting is the assertion that frames are actually arriving. (Not
  // ROLLING: a real mill is entitled to be idle when the test runs.)
  await page.waitForFunction(() => !document.querySelector('.no-feed'), { timeout: 30_000 })
  await shot(page, 'twin-02-feed')

  await checkTwinDock(page)

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

  // PROVENANCE ON THE DASHBOARD. With a feed present the workspace must draw,
  // and every value carries the badge its source earned. On a real plant feed
  // TagFactory can never produce SIM, so one SIM badge means the data is not
  // live — a strictly stronger check than the old mode-switch NO TAG delta.
  const dashOk = await page.evaluate(
    () =>
      !!document.querySelector('.kpi-ribbon') &&
      !!document.querySelector('.operating-context') &&
      document.querySelectorAll('.kpi-tile').length > 0,
  )
  if (!dashOk) problems.push('dashboard did not render with a feed present')

  const badges = await page.evaluate(() => {
    const spans = [...document.querySelectorAll('span')].map((s) => (s.textContent ?? '').trim())
    return {
      sim: spans.filter((t) => t === 'SIM').length,
      live: spans.filter((t) => t === 'LIVE').length,
      noTag: spans.filter((t) => t === 'NO TAG').length,
    }
  })
  console.log(`  dashboard badges: ${badges.live} LIVE, ${badges.sim} SIM, ${badges.noTag} NO TAG`)
  if (EXPECT === 'live' && badges.sim > 0) {
    problems.push(`${badges.sim} value(s) badged SIM on a feed expected to be LIVE`)
  }
  await shot(page, 'p1-dashboard-badges')

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

  await finish(browser)
}

async function finish(browser: Browser): Promise<void> {
  await browser.close()

  console.log('')
  if (problems.length === 0) {
    console.log(`SMOKE TEST PASSED (${EXPECT}) — clean console, no page errors`)
    return
  }
  console.log(`SMOKE TEST FAILED (${EXPECT}) — ${problems.length} problem(s):`)
  for (const p of problems) console.log(`  ${p}`)
  process.exit(1)
}

/**
 * The go-live contract: nothing in the workspace may offer a way to choose
 * simulated data. The selector's own ARIA group is checked as well as its
 * labels, so a restyled or relabelled selector still trips this.
 */
async function assertNoSimulationAffordances(page: Page): Promise<void> {
  const found = await page.evaluate(() => ({
    modeGroup: !!document.querySelector('[role="group"][aria-label="Operating mode"]'),
    modeButtons: [...document.querySelectorAll('button')]
      .map((b) => (b.textContent ?? '').trim())
      .filter((t) => t === 'SIMULATION' || t.startsWith('SIM ·')),
  }))
  if (found.modeGroup) problems.push('the operating-mode selector is present in the header')
  if (found.modeButtons.length > 0) {
    problems.push(`simulation mode buttons present: ${found.modeButtons.join(', ')}`)
  }
}

/**
 * The 3D twin page's dock: the command strip and simulation panel are GONE
 * (absence, not disabled-ness — see the header note), and the feed's vital
 * signs survived the removal. textContent, not innerText, because the labels
 * are uppercased by CSS and innerText would report the transformed text.
 */
async function checkTwinDock(page: Page): Promise<void> {
  const dock = await page.evaluate(() => {
    const text = document.body.textContent ?? ''
    return {
      commands: [...document.querySelectorAll('button')]
        .map((b) => (b.textContent ?? '').trim())
        .filter((t) => ['START', 'STOP', 'FAST STOP', 'RESET'].includes(t)),
      simWording: ['SIMULATION CONTROL', 'SIMULATED STATE ONLY', 'Simulation controls'].filter((w) =>
        text.includes(w),
      ),
      missingFeed: ['Source', 'Publish rate', 'Frame age', 'Frames received'].filter(
        (l) => !text.includes(l),
      ),
    }
  })
  if (dock.commands.length > 0) problems.push(`simulation commands still on the twin page: ${dock.commands.join(', ')}`)
  if (dock.simWording.length > 0) problems.push(`simulation wording still on the twin page: ${dock.simWording.join(', ')}`)
  if (dock.missingFeed.length > 0) problems.push(`FEED block missing on the twin page: ${dock.missingFeed.join(', ')}`)
}

/**
 * No plant frame has arrived. Every page must say so and draw no mill: before
 * the gate existed, placeholder defaults painted an idle mill with pass 0/0 and
 * "All clear — no active alarms", which reads exactly like a real quiet one.
 */
async function runNoFeed(page: Page): Promise<void> {
  if (await page.$('.kpi-ribbon')) problems.push('dashboard drew KPI tiles with no plant feed')
  if (await page.$('.operating-context')) problems.push('dashboard drew the operating context with no plant feed')
  await shot(page, 'nofeed-dashboard')

  for (const [label, path, name] of [
    ['REAL-TIME TRENDS', '/trends', 'nofeed-trends'],
    ['3D DIGITAL TWIN', '/3d-twin', 'nofeed-twin'],
  ] as const) {
    if (!(await navigate(page, label, path, '.no-feed'))) {
      problems.push(`${path} did not show the NO FEED state`)
    }
    await new Promise((r) => setTimeout(r, 1500))
    await shot(page, name)
  }

  // Still on the twin page: no false all-clear, and the feed block is there.
  if (await page.evaluate(() => (document.body.textContent ?? '').includes('All clear'))) {
    problems.push('twin page claims "All clear" with no plant feed')
  }
  await checkTwinDock(page)

  // The status strip and the 3D labels must not describe a mill either. Without
  // a frame the strip used to print "IDLE · FORWARD · ETR → DTR" from defaults,
  // and every label read NO TAG — a claim about a feed that does not exist.
  // Check each LABEL, not the wrapper. This used to read the wrapper's computed
  // visibility and passed while every label stayed on screen: `visibility` can
  // be switched back on by a child, and the projector does exactly that.
  // checkVisibility() resolves inheritance and opacity on the element itself.
  const twin = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.twin-labels *')].filter(
      (el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 0,
    )
    const shown = labels.filter((el) =>
      (el as Element & { checkVisibility(o: object): boolean }).checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      }),
    )
    return {
      pill: (document.querySelector('.twin-viewport .status-pill')?.textContent ?? '').trim(),
      labelCount: labels.length,
      labelsShown: shown.length,
      sample: shown.slice(0, 3).map((el) => (el.textContent ?? '').trim()),
      sourceChip: (document.querySelector('.brand-header')?.textContent ?? '').replace(/\s+/g, ' '),
    }
  })
  console.log(`  twin labels: ${twin.labelsShown} of ${twin.labelCount} visible`)
  if (twin.pill !== 'NO FEED') problems.push(`twin status strip claims "${twin.pill}" with no plant feed`)
  if (twin.labelsShown > 0) {
    problems.push(`${twin.labelsShown} 3D label(s) visible with no plant feed (e.g. ${twin.sample.join(', ')})`)
  }
  if (!twin.sourceChip.includes('SOURCE NO FEED')) {
    problems.push('header source chip does not say NO FEED with no plant feed')
  }
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
