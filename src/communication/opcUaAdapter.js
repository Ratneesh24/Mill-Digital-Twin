/**
 * OPC-UA INTEGRATION PLAN — §14.3, §20.7.
 *
 * This file is deliberately NOT a browser OPC-UA client. A browser cannot and
 * must not speak OPC-UA to a plant server: §14.3 fixes the path as
 *
 *   PLC -> OPC-UA Server -> Industrial Edge Gateway -> Backend -> WebSocket -> Twin UI
 *
 * What lives here is the ADDRESS-SPACE MAPPING the edge gateway needs, expressed
 * in the twin's own tag names, plus the node-id convention. When the gateway is
 * built, this table is the contract it implements; the twin then receives the
 * result over `WebSocketDataSource` and nothing in the UI changes.
 */
import { tagDefinitions } from '../data/tagDefinitions';
/**
 * Namespace convention proposed for the CRM04 mill server.
 * ns=2 is the ABB MillPilot application namespace on comparable installations;
 * CONFIRM with automation before the gateway is configured (§22 item 3).
 */
const NAMESPACE = 2;
/**
 * Sampling policy.
 *
 * §14.2 asks the twin to work at 10 / 5 / 2 / 1 Hz and at 0.2 Hz for historian
 * replay. Fast process values are proposed at 100 ms; slower mechanical and
 * status values at 500 ms / 1 s. This is a REQUEST to automation, not a
 * measurement of what the PLC currently offers — today's extract is 5 s (0.2 Hz).
 */
function samplingFor(tagName) {
    if (tagName.startsWith('ROLL.FORCE') ||
        tagName.startsWith('ROLL.GAP') ||
        tagName.startsWith('STRIP.THICKNESS') ||
        tagName.startsWith('GAUGE.')) {
        return 100;
    }
    if (tagName.startsWith('MILL.SPEED') ||
        tagName.startsWith('TENSION.') ||
        tagName.startsWith('DRIVE.')) {
        return 200;
    }
    if (tagName.endsWith('.STATUS') || tagName.endsWith('.READY') || tagName.endsWith('.BRAKE')) {
        return 1000;
    }
    return 500;
}
function deadbandFor(unit) {
    switch (unit) {
        case 'mm':
            return 0.001;
        case 'µm':
            return 0.5;
        case 't':
            return 0.5;
        case 'kN':
            return 0.5;
        case 'm/min':
            return 0.5;
        case 'A':
            return 2;
        case 'kW':
            return 2;
        case 'rpm':
            return 0.5;
        default:
            return 0;
    }
}
/** The full proposed address-space mapping, derived from the tag definitions. */
export const opcUaMapping = tagDefinitions.map((def) => ({
    tagName: def.tagName,
    nodeId: `ns=${NAMESPACE};s=CRM04.${def.tagName.replace(/\./g, '_')}`,
    samplingIntervalMs: samplingFor(def.tagName),
    deadband: deadbandFor(def.unit),
    availability: def.liveAvailability,
    note: def.liveNote,
}));
/**
 * Tags to raise with OEM first (§22 item 3). These are the ones whose absence
 * costs the twin the most: without them force, position and roll speed are all
 * model output rather than measurement.
 */
export const OEM_PRIORITY_TAGS = [
    'ROLL.FORCE.ACTUAL',
    'ROLL.GAP.ACTUAL',
    'ROLL.GAP.OS',
    'ROLL.GAP.DS',
    'WR.TOP.BENDING',
    'WR.BOTTOM.BENDING',
    'WR.TOP.RPM',
];
/** Gateway configuration sketch, emitted for the handover pack (§20.7). */
export function gatewayConfigSketch() {
    const subscriptions = opcUaMapping
        .filter((m) => m.availability === 'MEASURED' || m.availability === 'REFERENCE')
        .map((m) => `    - nodeId: "${m.nodeId}"   # ${m.tagName} @ ${m.samplingIntervalMs} ms`)
        .join('\n');
    return [
        '# Industrial Edge Gateway — CRM04 4HI reversing mill digital twin',
        '# Read-only. No write nodes are configured (§14.4).',
        'endpoint: "opc.tcp://<mill-opcua-server>:4840"',
        'security:',
        '  policy: Basic256Sha256',
        '  mode: SignAndEncrypt',
        '  userAuth: certificate      # no anonymous access to a plant server',
        'session:',
        '  publishingIntervalMs: 100',
        '  maxKeepAliveCount: 10',
        'subscriptions:',
        '  monitoredItems:',
        subscriptions,
        'egress:',
        '  websocket:',
        '    path: "/ws/crm04"',
        '    payload: "{ timestamp, tags: { <TAG.NAME>: value } }"   # §14.2',
        '    publishRateHz: 5',
    ].join('\n');
}
