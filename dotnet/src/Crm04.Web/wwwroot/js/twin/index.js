/**
 * THE TWIN'S INTEROP SURFACE.
 *
 * Blazor calls init() once and dispose() once, plus a handful of user-action functions. It does
 * NOT participate in the frame path at all: the module opens its own WebSocket to the API and
 * receives ~180-byte target sets ten times a second, so there are ZERO interop calls per frame.
 * See TwinFeed.cs for why.
 *
 * The rules that keep this from leaking WebGL contexts - the single most common way a Blazor +
 * three.js page dies in production - are enforced here:
 *
 *   * init() refuses to build a second scene on a canvas that already has one, because a circuit
 *     reconnect re-runs OnAfterRenderAsync and would otherwise leave two renderers and two rAF
 *     loops fighting over one canvas.
 *   * dispose() tears down every geometry, material, texture and listener, cancels the rAF, and
 *     calls forceContextLoss(). Browsers cap live contexts at about 16; navigating away twenty
 *     times without this kills the page.
 */
import * as THREE from 'three';
import { OrbitControls } from '/js/vendor/OrbitControls.js';

import { deriveScene, deriveLine, rollGapToScene, mmToScene } from './config.js';
import { createMaterials, disposeMaterials } from './materials.js';
import { buildEnvironment, addLights } from './environment.js';
import { TwinEngine } from './engine.js';
import {
  createMillStand,
  createWorkRoll,
  createBackupRoll,
  createStrip,
  createReel,
  createGauge,
  createDeflector,
  createAirKnife,
  createForceArrows,
  createFloor,
  createTensionSystem,
  createCropShear,
  createCoilHandling,
  createPeeler,
  createFlattener,
  createCarryOverTable,
  createSnubber,
  createMillEnclosure,
} from './parts.js';

/** One scene per canvas. The map is what makes a repeated init() a no-op rather than a leak. */
const scenes = new WeakMap();

export async function init(options) {
  const { canvas, overlay, feedUrl, configUrl, dotNetRef } = options;

  if (scenes.has(canvas)) {
    // A circuit reconnect re-ran init. The existing scene is fine; leave it alone.
    return true;
  }

  let cfg;
  try {
    const response = await fetch(configUrl);
    if (!response.ok) throw new Error(`config ${response.status}`);
    cfg = await response.json();
  } catch (error) {
    // Without millConfig there are no dimensions, and a scene of guessed sizes would be worse
    // than no scene. Tell .NET so the page can say so.
    if (dotNetRef) await dotNetRef.invokeMethodAsync('OnTwinError', `Mill configuration unavailable: ${error.message}`);
    return false;
  }

  const twin = build(canvas, overlay, cfg, feedUrl, dotNetRef);
  scenes.set(canvas, twin);
  return true;
}

function build(canvas, overlay, cfg, feedUrl, dotNetRef) {
  const SCENE = deriveScene(cfg);
  const LINE = deriveLine(cfg);
  const M = createMaterials();
  const ctx = { cfg, SCENE, LINE, M };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  // Cap the pixel ratio: a 4K control-room monitor renders 4x the fragments for no visible
  // benefit, and large drawing buffers are the fastest way to lose a WebGL context on a
  // modest GPU. §15.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  // Light control-room backdrop. The equipment palette (blue housings, steel rolls, #e3ebf2
  // floor) was authored for a bright scene; a dark clear colour would silhouette it.
  scene.background = new THREE.Color('#e9eff5');

  const environment = buildEnvironment(renderer, LINE);
  scene.environment = environment.texture;

  const lights = addLights(scene, LINE, SCENE);

  const camera = new THREE.PerspectiveCamera(cfg.visual.cameraFov, 1, 0.1, 200);
  const views = {
    LINE: { position: cfg.visual.cameraHome, target: cfg.visual.cameraTarget },
    STAND: { position: cfg.visual.cameraStand, target: cfg.visual.cameraStandTarget },
    ENTRY: { position: cfg.visual.cameraEntry, target: cfg.visual.cameraEntryTarget },
  };

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = cfg.visual.cameraMinDistance;
  controls.maxDistance = cfg.visual.cameraMaxDistance;
  // Stop the camera going under the floor, where the scene is a black plane and the operator has
  // no idea which way is up.
  controls.maxPolarAngle = Math.PI * 0.495;

  let currentView = 'LINE';
  let enclosurePart = null;

  /**
   * Apply a camera preset, and for the LINE view make sure the WHOLE LINE IS ACTUALLY IN SHOT.
   *
   * The presets come from millConfig and were framed against the React app's viewport. This
   * viewport is a different shape, and at a 36-degree vertical FOV a narrow window crops the
   * horizontal extent - which silently cut the delivery reel off the left of the picture. Rather
   * than fork the preset, the camera is pushed back along its own view direction until the line
   * fits, so the designed ANGLE is preserved and only the distance adapts.
   */
  const applyView = (key) => {
    const view = views[key] ?? views.LINE;
    currentView = views[key] ? key : 'LINE';

    camera.position.set(view.position.x, view.position.y, view.position.z);
    controls.target.set(view.target.x, view.target.y, view.target.z);

    // The STAND view exists to see the roll stack: the enclosure stays out of the way.
    if (enclosurePart) enclosurePart.setStandView(currentView === 'STAND');

    if (currentView === 'LINE') fitLine();

    controls.update();
  };

  const fitLine = () => {
    // Horizontal half-FOV from the vertical one and the current aspect.
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);

    // Line extent plus a margin for the reels' coil radius at each end, plus a framing
    // margin so the outer reels and floor furniture clear the viewport edges vertically too.
    const halfExtent = (LINE.maxX - LINE.minX) / 2 + SCENE.maxCoilRadius + 0.6;
    const required = (halfExtent / Math.tan(hFov / 2)) * 1.12;

    const offset = camera.position.clone().sub(controls.target);
    const current = offset.length();
    if (current >= required) return;

    camera.position.copy(controls.target).add(offset.multiplyScalar(required / current));
  };

  applyView('LINE');

  // ------------------------------------------------------------------ parts
  const parts = [
    createFloor(ctx),
    createMillStand(ctx),
    createBackupRoll(ctx, 'UPPER'),
    createBackupRoll(ctx, 'LOWER'),
    createWorkRoll(ctx, 'UPPER'),
    createWorkRoll(ctx, 'LOWER'),
    createStrip(ctx),
    createForceArrows(ctx),
    createTensionSystem(ctx),
    createGauge(ctx, LINE.entryGaugeX, 'GAUGE_ENTRY'),
    createGauge(ctx, LINE.deliveryGaugeX, 'GAUGE_EXIT'),
    createDeflector(ctx, LINE.entryDeflectorX, 'DEFLECTOR_ENTRY'),
    createDeflector(ctx, LINE.deliveryDeflectorX, 'DEFLECTOR_EXIT'),
    createAirKnife(ctx, LINE.entryAirKnifeX, 'AIRKNIFE_ENTRY'),
    createAirKnife(ctx, LINE.deliveryAirKnifeX, 'AIRKNIFE_EXIT'),
    createCropShear(ctx),
    createCoilHandling(ctx),
    createPeeler(ctx),
    createFlattener(ctx),
    createCarryOverTable(ctx),
    createSnubber(ctx),
  ];
  enclosurePart = createMillEnclosure(ctx);
  parts.push(enclosurePart);

  const dtr = createReel(ctx, {
    x: LINE.dtrX, mandrelRadius: SCENE.mandrelRadius, faceWidth: SCENE.mandrelFace, name: 'DTR',
  });
  const etr = createReel(ctx, {
    x: LINE.etrX, mandrelRadius: SCENE.mandrelRadius, faceWidth: SCENE.mandrelFace, name: 'ETR',
  });
  const por = createReel(ctx, {
    x: LINE.porX, mandrelRadius: SCENE.porMandrelRadius, faceWidth: SCENE.porMandrelFace, name: 'POR',
  });

  for (const part of parts) scene.add(part.group);
  for (const reel of [dtr, etr, por]) scene.add(reel.group);

  // ------------------------------------------------------- labels (projected)
  // Blazor renders the label DOM; this only positions it. See TwinLabels.razor for why that
  // split matters and why the markup must carry no style attribute.
  const labelAnchors = () => ({
    STAND: new THREE.Vector3(0, SCENE.housingTop + 0.25, 0),
    ENTRY: new THREE.Vector3(LINE.entrySign * 2.2, 0.55, 0),
    EXIT: new THREE.Vector3(-LINE.entrySign * 2.2, 0.55, 0),
    DTR: new THREE.Vector3(LINE.dtrX, SCENE.maxCoilRadius + 0.35, 0),
    ETR: new THREE.Vector3(LINE.etrX, SCENE.maxCoilRadius + 0.35, 0),
    POR: new THREE.Vector3(LINE.porX, SCENE.maxCoilRadius + 0.35, 0),
  });

  const anchors = labelAnchors();
  const projected = new THREE.Vector3();

  const engine = new TwinEngine(cfg.visual.dampingHalfLife);

  const state = {
    labelsVisible: true,
    forceArrowsVisible: true,
    frames: 0,
    fps: 0,
    lastFpsAt: performance.now(),
    disposed: false,
  };

  // ------------------------------------------------------------------- feed
  let socket = null;
  let reconnectTimer = null;
  let reconnectDelay = 500;
  let lastMessageAt = 0;
  let watchdogFired = false;

  const connect = () => {
    if (state.disposed) return;

    socket = new WebSocket(feedUrl);

    socket.onmessage = (event) => {
      try {
        engine.setTargets(JSON.parse(event.data));
        lastMessageAt = performance.now();
        watchdogFired = false;
      } catch {
        // A malformed frame is dropped rather than allowed to poison the target set. The next
        // one is 100 ms away.
      }
    };

    socket.onopen = () => {
      reconnectDelay = 500;
    };

    socket.onclose = () => {
      if (state.disposed) return;
      // Backoff to 5 s. A control-room screen left open against a stopped API should not
      // reconnect twice a second for the rest of the day.
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 5000);
    };

    socket.onerror = () => socket?.close();
  };

  connect();

  // ------------------------------------------------------------- resize
  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width === 0 || height === 0) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Re-fit after an aspect change, so narrowing the window pulls back rather than cropping the
    // reels off the ends of the line.
    if (currentView === 'LINE') {
      fitLine();
      controls.update();
    }
  };

  const resizeObserver = new ResizeObserver(resize);
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
  resize();

  // ------------------------------------------------------------- frame loop
  let raf = 0;
  const frame = (nowMs) => {
    raf = requestAnimationFrame(frame);

    // A backgrounded tab still fires rAF in some browsers, and rendering a scene nobody is
    // looking at is pure heat.
    if (document.hidden) return;

    // Watchdog: the server broadcasts stale targets when the feed dies, but a severed socket
    // (API killed, network cut) delivers nothing at all. Without this the scene would keep
    // integrating the last live targets forever. Ten missed frames at 10 Hz trips it.
    if (!watchdogFired && lastMessageAt !== 0 && nowMs - lastMessageAt > 1000) {
      watchdogFired = true;
      engine.setTargets({ ...engine.targets, animate: false, stale: true });
    }

    const v = engine.advance(nowMs / 1000);

    for (const part of parts) part.update(v);
    dtr.updateReel(v.dtrRadius, v.dtrAngle);
    etr.updateReel(v.etrRadius, v.etrAngle);
    por.updateReel(v.porRadius, v.porAngle);

    if (overlay && state.labelsVisible) projectLabels(v);

    controls.update();
    renderer.render(scene, camera);

    state.frames++;
    if (nowMs - state.lastFpsAt >= 1000) {
      state.fps = Math.round((state.frames * 1000) / (nowMs - state.lastFpsAt));
      state.frames = 0;
      state.lastFpsAt = nowMs;
    }
  };

  /**
   * Project the 3D anchors onto the label DOM Blazor rendered.
   *
   * BLAZOR NEVER WRITES THE POSITION, AND THIS NEVER WRITES THE TEXT. Blazor's diff only patches
   * attributes it rendered, and TwinLabels.razor deliberately renders no style attribute - so the
   * inline transform set here survives every re-render of the value inside the label. That is the
   * whole trick, and adding style="@..." to the markup would silently break it.
   */
  function projectLabels(v) {
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;

    for (const element of overlay.querySelectorAll('[data-anchor]')) {
      const key = element.dataset.anchor;
      let anchor = anchors[key];
      if (!anchor) continue;

      // ENTRY and EXIT swap sides on a reversal, exactly when the strip does. Reading the
      // direction here rather than fixing them to a side is the §1 rule applied to the labels.
      // The DAMPED sign (not the discrete direction) drives the slide, so the chips cross
      // together with the strip instead of teleporting.
      if (key === 'ENTRY' || key === 'EXIT') {
        const s = v.directionSign;
        const side = key === 'ENTRY' ? s : -s;
        projected.set(LINE.entrySign * side * 2.2, 0.55, 0);
        anchor = projected;
      }

      projected.copy(anchor).project(camera);

      // Hide a label that is behind the camera OR outside the viewport. Projection happily
      // returns coordinates for both, and a chip parked at x = -77 is either invisible or, worse,
      // clipped half on-screen next to equipment it does not belong to.
      const behind = projected.z > 1;
      const offscreen = projected.x < -1.02 || projected.x > 1.02 || projected.y < -1.02 || projected.y > 1.02;

      element.style.visibility = behind || offscreen ? 'hidden' : 'visible';
      element.style.transform =
        `translate3d(${(projected.x * 0.5 + 0.5) * width}px, ` +
        `${(-projected.y * 0.5 + 0.5) * height}px, 0) translate(-50%, -50%)`;
    }
  }

  raf = requestAnimationFrame(frame);

  // ------------------------------------------------------- context loss
  // A driver reset on a 24/7 wall display must neither leave a blank rectangle nor spam the
  // operator: stop the loop, wait for the restore event, then resume. If the context never
  // comes back (headless SwiftShader under memory pressure does this), rebuild the whole
  // scene up to three times before reporting UNAVAILABLE.
  let rebuilds = 0;
  let rebuildPending = false;
  const onContextLost = (event) => {
    event.preventDefault();
    if (rebuildPending) return;
    rebuildPending = true;
    cancelAnimationFrame(raf);
    if (dotNetRef) dotNetRef.invokeMethodAsync('OnTwinStalled', 'Graphics context lost — recovering…');
    setTimeout(() => {
      rebuildPending = false;
      if (state.disposed) return;
      try {
        // A fresh drawing buffer is more reliable than nursing a lost one.
        teardown(false, true);
        const fresh = build(canvas, overlay, cfg, feedUrl, dotNetRef);
        scenes.set(canvas, fresh);
        if (dotNetRef) dotNetRef.invokeMethodAsync('OnTwinRecovered');
      } catch (err) {
        rebuilds++;
        if (rebuilds >= 3 && dotNetRef) {
          dotNetRef.invokeMethodAsync('OnTwinError', 'WebGL context lost — the 3D view has stopped.');
        }
      }
    }, 1200);
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', () => {
    if (!state.disposed) raf = requestAnimationFrame(frame);
  });

  // Click-to-inspect: raycast the click against the equipment groups and report the group
  // name to .NET, which shows its tag readouts. A small drag threshold keeps orbiting from
  // selecting equipment on release. Hover uses the same resolver (see below).
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = null;
  const pickables = [...parts.map((p) => p.group), dtr.group, etr.group, por.group];
  // The glass enclosure is context, not equipment: it would swallow every hover behind it.
  // (Still selectable from the inspector dropdown.)
  enclosurePart.group.traverse((o) => { o.raycast = () => {}; });
  const resolvePick = (clientX, clientY) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    if (hits.length === 0) return null;
    let node = hits[0].object;
    while (node && !node.name) node = node.parent;
    return node?.name ? { name: node.name, object: node } : null;
  };
  const onPointerDown = (e) => { downAt = [e.clientX, e.clientY]; };
  const onPointerUp = (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved > 4 || !dotNetRef) return;
    const hit = resolvePick(e.clientX, e.clientY);
    if (hit) dotNetRef.invokeMethodAsync('OnEquipmentSelected', hit.name);
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);

  // Hover highlight: a Box3 outline around the hovered equipment plus a pointer cursor.
  // No material is touched (most are shared), so nothing can leak a highlight tint.
  // Throttled to ~16 Hz and reported to .NET only on change.
  const hoverBox = new THREE.Box3();
  const hoverHelper = new THREE.Box3Helper(hoverBox, 0x005a9c);
  hoverHelper.visible = false;
  scene.add(hoverHelper);
  let lastHover = null;
  let lastMoveAt = 0;
  const onPointerMove = (e) => {
    if (downAt) return;
    const now = performance.now();
    if (now - lastMoveAt < 60) return;
    lastMoveAt = now;
    const hit = resolvePick(e.clientX, e.clientY);
    const name = hit ? hit.name : null;
    if (name === lastHover) return;
    lastHover = name;
    if (hit) {
      hoverBox.setFromObject(hit.object);
      hoverHelper.visible = true;
      canvas.style.cursor = 'pointer';
    } else {
      hoverHelper.visible = false;
      canvas.style.cursor = '';
    }
    if (dotNetRef) dotNetRef.invokeMethodAsync('OnEquipmentHovered', name);
  };
  canvas.addEventListener('pointermove', onPointerMove);

  function teardown(killContext, contextLost) {
    state.disposed = true;

    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointermove', onPointerMove);

    clearTimeout(reconnectTimer);
    if (socket) {
      socket.onclose = null;
      socket.close();
    }

    if (!contextLost) {
      // On a lost context every GL delete is an INVALID_OPERATION warning and the objects
      // are already gone with the context — drop the references and let GC do the rest.
      for (const part of parts) part.dispose();
      for (const reel of [dtr, etr, por]) reel.dispose();
      for (const light of lights) scene.remove(light);

      environment.dispose();
      disposeMaterials(M);
      controls.dispose();
      scene.remove(hoverHelper);
      if (hoverHelper.dispose) hoverHelper.dispose();
      scene.clear();

      renderer.dispose();
    }
    if (killContext) {
      // The decisive line. Without it the context lingers, and browsers allow only ~16.
      renderer.forceContextLoss();
    }
  }

  return {
    applyView,
    controls,
    camera,
    renderer,
    state,
    getStats: () => ({ fps: state.fps, connected: socket?.readyState === WebSocket.OPEN }),
    setForceArrows: (visible) => {
      state.forceArrowsVisible = visible;
      const force = parts.find((p) => p.group.name === 'FORCE');
      if (force) force.group.visible = visible;
    },
    setLabels: (visible) => {
      state.labelsVisible = visible;
      if (!overlay) return;
      for (const element of overlay.querySelectorAll('[data-anchor]')) {
        element.style.visibility = visible ? 'visible' : 'hidden';
      }
    },
    zoomBy(factor) {
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
      const length = THREE.MathUtils.clamp(
        offset.length(), controls.minDistance, controls.maxDistance);
      offset.setLength(length);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    },
    dispose() {
      teardown(true, false);
    },
  };
}

// ------------------------------------------------------------------ exports
// Everything below is called by Blazor on a USER ACTION, never per frame.

export function dispose(canvas) {
  const twin = scenes.get(canvas);
  if (!twin) return;
  twin.dispose();
  scenes.delete(canvas);
}

export function setCameraView(canvas, view) {
  scenes.get(canvas)?.applyView(view);
}

export function zoomTwin(canvas, factor) {
  scenes.get(canvas)?.zoomBy(factor);
}

export function setForceArrowsVisible(canvas, visible) {
  scenes.get(canvas)?.setForceArrows(visible);
}

export function setLabelsVisible(canvas, visible) {
  scenes.get(canvas)?.setLabels(visible);
}

export function getStats(canvas) {
  return scenes.get(canvas)?.getStats() ?? { fps: 0, connected: false };
}

/** Live WebGL contexts on this page. The leak test asserts this stays at 1. */
export function contextCount() {
  return document.querySelectorAll('canvas').length;
}
