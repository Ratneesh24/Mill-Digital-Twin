# Live data integration

## The path (§14.3)

```
PLC → OPC-UA Server → Industrial Edge Gateway → Backend → WebSocket → Twin UI
```

**The browser never connects directly to a plant PLC.** `communication/opcUaAdapter.ts`
is deliberately *not* a browser OPC-UA client — it holds the address-space mapping
the gateway needs, expressed in the twin's own tag names.

---

## Integration points

There are exactly three, and only the first is needed to go live.

### 1. Implement `DataSource` — or just publish the payload

```ts
interface DataSource {
  connect(): Promise<void>
  disconnect(): Promise<void>
  subscribe(tags: string[], callback: DataCallback): Unsubscribe
  onConnectionChange(listener: ConnectionListener): Unsubscribe
  getConnectionInfo(): ConnectionInfo
}
```

`WebSocketDataSource` already implements this. If the backend publishes the §14.2
payload shape and full-snapshot contract below, point the LIVE URL at it in the
header. This is a **shape illustration only**, not a complete acceptable snapshot;
the timestamp must describe the current source frame:

```json
{
  "timestamp": 1756660000000,
  "tags": {
    "MILL.SPEED.ACTUAL": 175,
    "ROLL.GAP.ACTUAL": 2.000,
    "ROLL.FORCE.ACTUAL": 166,
    "TENSION.ENTRY": 1500,
    "TENSION.EXIT": 6000
  }
}
```

#### Ingress validation

- Frames must be JSON **text**, containing a non-null, non-array object with
  `timestamp` and a non-null, non-array `tags` object. Binary frames are rejected.
- `timestamp` must be a finite JSON number in epoch milliseconds, between local
  receipt time minus 3,600,000 ms and plus 60,000 ms, inclusive. Missing, string,
  null, nonfinite and out-of-window timestamps are rejected, never replaced with
  `Date.now()`.
- Timestamps must strictly increase relative to the last accepted frame. Replay
  and out-of-order frames are rejected, including across automatic or explicit
  reconnects of the same source instance. A newly created source has no previous
  watermark. Rejected frames do not advance it.
- Empty and unknown-only tag maps are rejected. Unknown keys in an otherwise
  complete valid snapshot are ignored and never displayed.
- Any invalid **known** value rejects the entire frame. Numeric definitions
  (a `unit` or `decimals`, including pass counts and POR layers) require finite
  numbers, not numeric strings or booleans. Objects and arrays are never coerced.
- `MILL.DIRECTION` accepts only `FORWARD` or `REVERSE`. `MILL.STATUS` accepts only
  `IDLE`, `READY`, `THREADING`, `ROLLING`, `DECELERATING`, `REVERSING`, `STOPPED`,
  `FAST_STOP`, `WARMUP`, `SKIN_PASS`, `REWIND`, `ROLL_CHANGE`, or `FAULT`.
- Reel roles accept `PAYOFF`, `TENSION`, `IDLE`; brakes accept `APPLIED`,
  `RELEASED`; reel statuses accept `RUNNING`, `STOPPED`, `FAULT`, `UNKNOWN`.
  Auxiliary statuses accept `HEALTHY`, `WARNING`, `FAULT`, `OFF`, `UNKNOWN`,
  `NO_TAG`; control statuses accept `ON`, `OFF`, `FAULT`, `UNKNOWN`, `NO_TAG`.
  Ready/interlock/stop tags require JSON booleans. Coil ID, coil grade and status
  reason require strings. Enum values are case-sensitive.
- `null` is accepted only for tags defined as `UNAVAILABLE`. Such optional values
  retain `null`, `UNAVAILABLE` provenance and `NO_TAG` quality. Supplied non-null
  values still undergo type/enum validation and `makeTag` masks unavailable tags
  to `null`; supplying a value does not promote its availability.
- Rejection reports `ERROR` without emitting a partial frame or reconnecting.
  The next valid snapshot clears the error and restores `CONNECTED`.
- Socket loss reconnects with exponential backoff capped at 15 s by default.
  Repeated `connect()` is idempotent. Disconnect cancels retries, and callbacks
  from retired sockets cannot publish data or change connection state, even after
  reconnect. `CONNECTED` on socket open describes transport, not data freshness.

#### Full snapshots, not deltas

The client does not merge deltas. **Every frame must include finite values for all
numeric inputs read by `numOr` in `communication/dataAdapter.ts`**, plus mill
status/direction and DTR/ETR logical roles. Otherwise adapter defaults could turn
missing readings into apparently valid zeroes or nominal geometry. Required tags:

- `MILL.SPEED.REF`, `MILL.SPEED.ACTUAL`, `MILL.MASSFLOW.ERROR`.
- `ROLL.GAP.ACTUAL`, `ROLL.FORCE.ACTUAL`, `ROLL.FORCE.REF`.
- `STRIP.WIDTH`, `STRIP.THICKNESS`, `STRIP.THICKNESS.ENTRY`,
  `STRIP.THICKNESS.REF`, `STRIP.THICKNESS.DEVIATION`, `STRIP.REDUCTION`.
- `TENSION.ENTRY`, `TENSION.EXIT`, `TENSION.ENTRY.REF`, `TENSION.EXIT.REF`.
- For **each** of `DTR`, `ETR`, `POR`: `.TENSION`, `.DIAMETER`, `.LENGTH`,
  `.TORQUE`, `.CURRENT`, `.RPM`.
- `COIL.LENGTH`, `COIL.REMAINING_LENGTH`, `COIL.DIAMETER`.
- `PASS.NUMBER`, `PASS.TOTAL`, `PASS.PROGRESS`.
- `DRIVE.TORQUE`, `DRIVE.CURRENT`, `DRIVE.POWER`, `DRIVE.RPM`.
- `WR.TOP.RPM`, `WR.BOTTOM.RPM`, `BUR.TOP.RPM`, `BUR.BOTTOM.RPM`.
- `MILL.STATUS`, `MILL.DIRECTION`, `DTR.ROLE`, `ETR.ROLE`.

This supports the project's **46-tag availability mode**, not a raw historian
column dump or a requirement for exactly 46 keys. The gateway/backend must map
measured/reference inputs and supply the required calculated/estimated outputs
(speed, force, gap, RPM, status, roles, etc.) consistently with the tag definitions.
The ingress client does not calculate those outputs; their existing provenance
remains `CALCULATED` or `ESTIMATED`, never `MEASURED`.

Known unavailable instruments are **not required**: gap reference, OS/DS gap and
force, differential force reference, roll bending/actual diameters, hydraulics,
auxiliary/control/interlock/gauge-ready/brake words and coil grade may be omitted
or sent as `null`. Other optional tags include gauge and reel thickness, POR
layers, reel statuses, coil ID, status reason and entry speed. If present, available
optional tags still require valid non-null values. Optional omissions are not
filled from an earlier frame by this client.

#### Local verification and limits

Run `npx tsx scripts/checkGateway.ts` and `npx tsc -p tsconfig.app.json --noEmit`.
The gateway harness uses Node assert, a fixed clock, controlled timers and a
mocked WebSocket; it makes **no external connection**. It exercises malformed
envelopes, timestamps and boundary values, replay/order, completeness, all numeric
tag types, enums, optional unavailable nulls, recovery, reconnect/backoff and late
callbacks after disconnect/reconnect.

Validation does not establish physical plausibility, cross-tag consistency,
per-instrument freshness, authentication or transport security. Numeric alarm
limits are not ingress rejection limits; genuine alarm/trip readings must reach
the UI. The full-snapshot required list and enum checks must track future adapter
and tag-definition changes. Live timestamp rules are not an arbitrary historical
replay/seek protocol, and replay protection is not persisted across source creation
or page reloads. This text-only protocol carries raw values, not quality/status
metadata envelopes; provenance and tag alarm status are resolved locally.

### 2. Declare the tags in `data/tagDefinitions.ts`

Each tag needs a description, unit, simulation provenance, and — the important
one — its `liveAvailability`: `MEASURED`, `REFERENCE`, `CALCULATED`, `ESTIMATED`
or `UNAVAILABLE`, plus a `liveNote` explaining anything that is not `MEASURED`.

This is the single edit that promotes a tag when OEM raises sampling. No
component reads an availability flag.

### 3. Extend the projection in `communication/dataAdapter.ts` — only for a *new* field

If the new tag maps to an existing `MachineState` field, nothing to do. Only a
genuinely new state field needs a line here.

---

## Gateway configuration

`opcUaAdapter.ts` generates a configuration sketch from the tag definitions
(`gatewayConfigSketch()`):

```yaml
# Industrial Edge Gateway — CRM04 4HI reversing mill digital twin
# Read-only. No write nodes are configured (§14.4).
endpoint: "opc.tcp://<mill-opcua-server>:4840"
security:
  policy: Basic256Sha256
  mode: SignAndEncrypt
  userAuth: certificate      # no anonymous access to a plant server
session:
  publishingIntervalMs: 100
  maxKeepAliveCount: 10
subscriptions:
  monitoredItems:
    - nodeId: "ns=2;s=CRM04.MILL_SPEED_REF"   # MILL.SPEED.REF @ 100 ms
    ...
egress:
  websocket:
    path: "/ws/crm04"
    payload: "{ timestamp, tags: { <TAG.NAME>: value } }"
    publishRateHz: 5
```

### Node-id convention

`ns=2;s=CRM04.<TAG_NAME with dots as underscores>`

`ns=2` is the ABB MillPilot application namespace on comparable installations —
**confirm with automation before configuring** (§22 item 3).

### Proposed sampling policy

A *request* to automation, not a measurement of what the PLC offers today. The
current extract is 5 s (0.2 Hz).

| Group | Interval | Tags |
|---|---|---|
| Fast process | 100 ms | Roll force, roll gap, strip thickness, X-ray gauges |
| Drive & tension | 200 ms | Mill speed, tensions, drive torque/current/power |
| Mechanical | 500 ms | Reel diameters, lengths, roll speeds |
| Status words | 1000 ms | `*.STATUS`, `*.READY`, `*.BRAKE` |

Deadbands are proposed per unit (0.001 mm, 0.5 µm, 0.5 t, 0.5 kN, 2 A) to keep
bandwidth sane.

---

## Rates the twin already handles

§14.2 asks for 10 / 5 / 2 / 1 Hz and 0.2 Hz for historian replay. The simulation
runs at **10 Hz** and the scene stays continuous because every visual value is
damped with a frame-rate-independent half-life (§10.4) rather than being set
directly. That same damping is what will carry the 0.2 Hz replay case — the
mechanism is already in place and exercised.

The measured feed rate is displayed in the header and on SYSTEM STATUS. It is
measured over a rolling 2 s window, not taken from the source's advertised
nominal rate.

---

## Staleness and connection handling (§14.5)

Handled: PLC disconnected · WebSocket disconnected · stale data · invalid tag ·
bad quality · missing tag · simulation mode.

The watchdog runs **independently of the feed**, so a source that simply stops
sending is detected rather than silently believed. On the stale transition:

1. `communication.stale` is set and the age is published.
2. **Every tag is re-stamped `STALE`** — the banner is not enough; each readout
   has to stop claiming freshness.
3. The 3D twin **freezes**: `twinEngine` stops integrating rotation angles, so
   the mill visibly stops rather than continuing to run on numbers nobody is
   sending.
4. A curtain over the twin states `DATA STALE` / `DATA SOURCE DISCONNECTED`,
   `TWIN FROZEN — NOT SHOWING LIVE MACHINE STATE`, and the last valid timestamp.
5. A `COMMUNICATION_LOST` alarm is raised.

---

## Historian replay (Phase 3) — not built

`HistorianReplayDataSource` is not written. When it is, it should:

- Implement the same `DataSource` interface and emit frames at the record
  cadence, wall-clock scaled (1×, 10×, 60×).
- Take a **user-supplied CSV** from the CRM04 extract. It must ship with no data
  file: shipping synthetic data as "historian replay" would be exactly the kind
  of plausible-looking fabrication the provenance contract exists to prevent.
- Map CSV columns to tag names through a config file, so a different export
  layout is a config change.
- Publish at `mode: 'LIVE'` provenance so the 46-tag degradation applies
  automatically.
- Seek by coil, since the extract is coil-linked.

The interpolation layer is the piece that already exists: at 0.2 Hz the twin's
damping is what makes a 5 s feed render as continuous motion.

---

## Security (§14.4)

- **Read-only monitoring is strictly separated from control.** No write node is
  configured in the gateway sketch.
- **Phase 1 is read-only.** Every UI control modifies simulated state only. In
  LIVE mode the simulation controls disable themselves and the command strip on
  the twin says `LIVE — READ ONLY`; a command sent in LIVE mode is refused and
  logged to the event timeline as rejected, so the UI never implies an action
  reached the mill.
- **Real machine commands are out of scope.** When built they go through an
  authorised `CommandService` — never from the frontend directly.
- The gateway sketch specifies `Basic256Sha256` / `SignAndEncrypt` with
  certificate auth. No anonymous access to a plant server.

---

## Switching sources at runtime

The header mode selector calls `machineStore.connect(mode, url)`, which
disconnects the current source before creating the new one, guarded by a
generation counter so overlapping connects cannot leave two sources publishing
into the same store.

This is §17 test 10: *"Simulation disengages cleanly, live source authoritative,
no conflicting values."* With no gateway present, switching to LIVE shows a
disconnected feed and `NO DATA` — which is the honest outcome, and is itself a
demonstration of §14.5.
