# CRM04 Digital Twin — IT integration guide

**Audience:** plant IT, the Oracle DBA and whoever owns KEPServerEX.
**Goal:** connect the twin to real CRM04 plant data through Kepware and the company Oracle database.

The delivered UI is the .NET / Blazor app under `dotnet/`. The React app under `src/` is a frozen
reference — ignore it for integration.

---

## 1. How data flows

```
 PLC / ABB MillPilot
        │
        ▼
 KEPServerEX  (OPC UA server, opc.tcp://<kepware-host>:49320)
        │   OPC UA subscription, read-only
        ▼
 Crm04.Feeder  (Windows service)  ── the ONLY process that writes to Oracle
        │   10 frames/second
        ▼
 Company Oracle  →  CRM04 schema  (FRAME, TAG_SAMPLE, CURRENT_TAG, TREND_SAMPLE, …)
        │
        ▼
 Crm04.Api  (http://<api-host>:5200)  ── reads Oracle, pushes over SignalR/WebSocket
        │
        ▼
 Crm04.Web  (http://<web-host>:5240)  ── Blazor dashboard
        │
        ▼
 Operator browsers   (also open a WebSocket DIRECTLY to Crm04.Api for the 3D twin)
```

The browser never talks to Kepware or Oracle. The Web app never talks to Oracle. Only the Feeder
talks to Kepware, and only the Feeder writes to Oracle.

---

## 2. Checklist — what changes, where, who

| # | Task | Where | Owner |
|---|---|---|---|
| 1 | Create the `CRM04` Oracle schema user and grant privileges | Oracle | DBA |
| 2 | Set the Oracle connection string for **Feeder and API** | Environment variable `ConnectionStrings__Crm04` | IT |
| 3 | Create the tables | `dotnet run --project src/Crm04.Feeder -- --apply-ddl` | IT / DBA |
| 4 | Configure the Kepware OPC UA endpoint, user and certificate trust | KEPServerEX OPC UA Configuration Manager | Kepware owner |
| 5 | Confirm the 28 `REVIEW` rows in the tag mapping | `dotnet/config/tag_mapping.csv` | Automation |
| 6 | **Write the OPC UA connection code** (the only code change) | `dotnet/src/Crm04.Feeder/Sources/OpcUaFrameSource.cs` → `ConnectAsync` | Developer |
| 7 | Add Kepware settings | `dotnet/src/Crm04.Feeder/appsettings.json` → `OpcUa` section | Developer |
| 8 | Point Web at the API, and allow Web in the API's CORS list | `Crm04.Web/appsettings.json`, `Crm04.Api/appsettings.json` | IT |
| 9 | Run all three in **Production** as services | Server | IT |
| 10 | Verify end to end | §9 | IT + automation |

Nothing else in the codebase needs to change.

---

## 3. Oracle database (DBA)

### 3.1 Create the schema user

The twin keeps **its own schema**. It does not read or modify existing plant tables.

```sql
CREATE USER CRM04 IDENTIFIED BY "<strong-password>"
  DEFAULT TABLESPACE <app_tablespace>
  QUOTA UNLIMITED ON <app_tablespace>;

GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE VIEW TO CRM04;
```

Those four are exactly what the Feeder's `--check-db` verifies.

### 3.2 Things the DBA must know

- **Partitioning.** `db/ddl/01_tables.sql` uses `INTERVAL` partitioning on `FRAME` and
  `TAG_SAMPLE`. If the Partitioning option is **not licensed**, that script fails — tell the
  developer before running it.
- **Write rate.** ~108 tags × 10 Hz ≈ **1,080 rows/second**, ~155 MB/hour before retention.
- **Retention.** Default 2 hours of raw samples (~7.8 M rows / ~310 MB, stays flat). Change with
  `Retention:Hours` in `Crm04.Feeder/appsettings.json`. Old partitions are dropped, not deleted.
- **Tables created:** `TAG_DEF`, `FRAME` (+ `FRAME_SEQ`), `TAG_SAMPLE`, `CURRENT_TAG`,
  `CURRENT_FRAME`, `TREND_SAMPLE`, `ALARM_EVENT`, `MACHINE_EVENT`, `COIL`, `PASS_SCHEDULE`,
  `PASS_SCHEDULE_ENTRY`. The DDL is plain SQL in `dotnet/db/ddl/` and can be reviewed without .NET.
- **Network.** The Feeder and API hosts need to reach the database listener (usually TCP 1521).

### 3.3 Connection string — where it goes

Both **Crm04.Feeder** (writes) and **Crm04.Api** (reads) need it. It is read as
`ConnectionStrings:Crm04`.

> **Never put the password in `appsettings.json`.** It is in the code handed over, and it would end
> up in source control.

On the server, set a machine or service environment variable:

```text
ConnectionStrings__Crm04 = User Id=CRM04;Password=<pw>;Data Source=//<db-host>:1521/<SERVICE_NAME>;
```

For a developer machine, user-secrets instead:

```bash
cd dotnet
dotnet user-secrets --project src/Crm04.Feeder set "ConnectionStrings:Crm04" "User Id=CRM04;Password=<pw>;Data Source=//<db-host>:1521/<SERVICE>;"
dotnet user-secrets --project src/Crm04.Api    set "ConnectionStrings:Crm04" "User Id=CRM04;Password=<pw>;Data Source=//<db-host>:1521/<SERVICE>;"
```

### 3.4 Check, then create the schema

```bash
cd dotnet
dotnet run --project src/Crm04.Feeder -- --check-db     # banner, schema, privileges, Partitioning, free space
dotnet run --project src/Crm04.Feeder -- --apply-ddl    # creates tables + indexes, seeds TAG_DEF (122 tags)
```

`--check-db` exits non-zero and names anything missing. Fix that before `--apply-ddl`.
`--drop-all --yes` destroys the schema — development only.

---

## 4. KEPServerEX (Kepware owner)

### 4.1 OPC UA endpoint

In **OPC UA Configuration Manager → Server Endpoints**:

- Endpoint: `opc.tcp://<kepware-host>:49320` (Kepware's default port).
- Security policy: **Basic256Sha256 — Sign and Encrypt**. Disable `None` for production.
- Firewall: allow TCP 49320 from the Feeder host only.

### 4.2 User — read-only

- In Project Properties → OPC UA: **disable anonymous login**.
- In **User Manager**, create a dedicated user (e.g. `crm04_twin`) with **read-only** access.
- The twin never writes. Do not grant write permission, and configure no write nodes (§14.4).

### 4.3 Trust the Feeder's certificate

The Feeder creates its own client certificate the first time it connects (in its `pki/own` folder).
The first connection attempt will be **rejected** until Kepware trusts it:

1. Start the Feeder once. It fails with a certificate error — expected.
2. In OPC UA Configuration Manager → **Trusted Clients**, find `CRM04 Feeder` and choose **Trust**.
3. Restart the Feeder.

### 4.4 Tag names → OPC UA NodeId (important)

The mapping file lists each tag by its MillPilot path, e.g.
`Applications.Mill.RollGap.RgcData.Ctrl.TrfAct`. In Kepware the OPC UA NodeId is
`ns=2;s=<Channel>.<Device>.<tag path>`.

**Recommended:** configure a channel and device, e.g. channel `CRM04`, device `MillPilot`, with tag
groups mirroring the MillPilot path. Then every NodeId is simply:

```text
ns=2;s=CRM04.MillPilot.Applications.Mill.RollGap.RgcData.Ctrl.TrfAct
      └──── NodeIdPrefix ────┘└──────────── PlantAddress from the CSV ────────────┘
```

and the code only needs a prefix (`NodeIdPrefix` in §6).

**Verify before coding:** browse the server with **UaExpert** (free) or Kepware's Quick Client, pick
two or three tags, and copy the exact NodeId — including the `ns=` index, which is not guaranteed
to be 2.

Recommended sampling (a request to automation, not what the PLC offers today):

| Group | Interval |
|---|---|
| Roll force, roll gap, thickness, X-ray gauges | 100 ms |
| Speed, tensions, drive torque / current | 200 ms |
| Reel diameters, lengths, roll speeds | 500 ms |
| Status / ready / on-off words | 1000 ms |

---

## 5. Tag mapping — `dotnet/config/tag_mapping.csv` (automation)

This file maps each plant address to a twin tag. It is plain CSV, editable without .NET.

| Column | Meaning |
|---|---|
| `PlantAddress` | MillPilot path, exactly as in Kepware (after the prefix) |
| `TwinTag` | Twin tag name. **Empty = not ingested** → shows NO TAG. Never fill with a guess. |
| `Scale`, `Offset` | `twin = plant × Scale + Offset` |
| `Kind` | `NUMBER` / `BOOLEAN` / `STRING` |
| `Confidence` | `OK`, **`REVIEW` (must confirm)**, `NEW` (no twin tag yet) |

Current state: 89 rows — 38 `OK`, **28 `REVIEW`**, 23 `NEW`.

**Confirm these before go-live** — each would produce wrong values that look perfectly normal:

1. **DTR / ETR identity.** The file assumes `Tr1` = ETR (entry), `Tr2` = DTR (delivery). If that is
   inverted, entry and exit tensions swap reels. See the note at the bottom of the CSV.
2. **Torque in %.** `DTR/ETR/POR/DRIVE.TORQUE` arrive as % of rating. `Scale` must become
   `rated torque (kNm) / 100` once the rating base is confirmed.
3. **Tension in kg** is converted to kN with `Scale = 0.00980665`. Confirm the unit is kg-force.
4. **Work roll bending +/−** are pressure polarities, not upper/lower rolls.
5. **Gauge Side1 / Side2** swap between the DTR and ETR blocks — confirm which physical side is which.
6. **E-stop polarity** and **`RelThreading` as the mill interlock.**

The Feeder refuses to start if the CSV names a tag the twin catalogue does not declare, or lists the
same address twice for the same tag. It logs a warning with the count of `REVIEW` rows on every start.

---

## 6. The code change — `OpcUaFrameSource.ConnectAsync` (developer)

**This is the only code to write.** Everything else — mapping, unit conversion, the NO TAG rules,
staleness, writing to Oracle — already works.

File: `dotnet/src/Crm04.Feeder/Sources/OpcUaFrameSource.cs`

Today `ConnectAsync` only logs *"not implemented"*, so the Feeder writes nothing and the dashboard
shows **NO FEED**. Implement it **inside this class** (not in a subclass): it needs `_byAddress`,
which is private.

### 6.1 Add the OPC UA client package

`dotnet/Directory.Packages.props` pins all versions centrally:

```xml
<PackageVersion Include="OPCFoundation.NetStandard.Opc.Ua.Client" Version="<latest 1.5.x>" />
```

`dotnet/src/Crm04.Feeder/Crm04.Feeder.csproj` (no version — it comes from the file above):

```xml
<PackageReference Include="OPCFoundation.NetStandard.Opc.Ua.Client" />
```

### 6.2 Add Kepware settings

`OpcUaSourceOptions` (top of `OpcUaFrameSource.cs`) — add:

```csharp
public string EndpointUrl { get; set; } = "opc.tcp://localhost:49320";
public string NodeIdPrefix { get; set; } = "ns=2;s=CRM04.MillPilot.";
public string? Username { get; set; }
public string? Password { get; set; }          // set via env var OpcUa__Password, never in the file
public int PublishingIntervalMs { get; set; } = 100;
```

`dotnet/src/Crm04.Feeder/appsettings.json` → `OpcUa` section:

```json
"OpcUa": {
  "MappingFile": null,
  "SourceId": "opcua:crm04",
  "StaleAfterMs": 2000,
  "EndpointUrl": "opc.tcp://<kepware-host>:49320",
  "NodeIdPrefix": "ns=2;s=CRM04.MillPilot.",
  "Username": "crm04_twin",
  "PublishingIntervalMs": 100
}
```

Password on the server: environment variable `OpcUa__Password`.

### 6.3 Implement `ConnectAsync`

A starting template. OPC Foundation's API changes between versions — check signatures against the
package version you install.

```csharp
// usings at the top of the file:
// using Opc.Ua;  using Opc.Ua.Client;  using Opc.Ua.Configuration;

private ISession? _session;

protected override async Task ConnectAsync(CancellationToken ct)   // or edit the existing method body
{
    var config = new ApplicationConfiguration
    {
        ApplicationName = "CRM04 Feeder",
        ApplicationUri = $"urn:{System.Net.Dns.GetHostName()}:CRM04Feeder",
        ApplicationType = ApplicationType.Client,
        SecurityConfiguration = new SecurityConfiguration
        {
            ApplicationCertificate = new CertificateIdentifier
                { StoreType = "Directory", StorePath = "pki/own", SubjectName = "CN=CRM04 Feeder" },
            TrustedPeerCertificates   = new CertificateTrustList { StoreType = "Directory", StorePath = "pki/trusted" },
            TrustedIssuerCertificates = new CertificateTrustList { StoreType = "Directory", StorePath = "pki/issuer" },
            RejectedCertificateStore  = new CertificateTrustList { StoreType = "Directory", StorePath = "pki/rejected" },
            AutoAcceptUntrustedCertificates = false,   // trust Kepware's cert explicitly (copy it into pki/trusted)
        },
        TransportQuotas = new TransportQuotas { OperationTimeout = 15000 },
        ClientConfiguration = new ClientConfiguration { DefaultSessionTimeout = 60000 },
    };
    await config.Validate(ApplicationType.Client);

    var app = new ApplicationInstance { ApplicationName = "CRM04 Feeder", ApplicationType = ApplicationType.Client, ApplicationConfiguration = config };
    await app.CheckApplicationInstanceCertificate(false, 2048);   // creates pki/own on first run

    var endpoint = CoreClientUtils.SelectEndpoint(config, _options.EndpointUrl, useSecurity: true);
    var configured = new ConfiguredEndpoint(null, endpoint, EndpointConfiguration.Create(config));
    var identity = string.IsNullOrEmpty(_options.Username)
        ? new UserIdentity()
        : new UserIdentity(_options.Username, _options.Password ?? "");

    _session = await Session.Create(config, configured, false, "CRM04 Feeder", 60000, identity, null);

    var subscription = new Subscription(_session.DefaultSubscription)
    {
        PublishingInterval = _options.PublishingIntervalMs,
    };

    foreach (var address in _byAddress.Keys)
    {
        var item = new MonitoredItem(subscription.DefaultItem)
        {
            StartNodeId = new NodeId(_options.NodeIdPrefix + address),
            SamplingInterval = _options.PublishingIntervalMs,
            QueueSize = 1,
            DiscardOldest = true,
        };

        var captured = address;
        item.Notification += (mi, _) =>
        {
            foreach (var dv in mi.DequeueValues())
            {
                // Bad quality = the tag exists but reads nothing -> pass null (TagValue.Null).
                // Never substitute zero or the last good value.
                Ingest(captured, StatusCode.IsGood(dv.StatusCode) ? Normalise(dv.Value) : null);
            }
        };

        subscription.AddItem(item);
    }

    _session.AddSubscription(subscription);
    subscription.Create();

    _session.KeepAlive += (s, e) =>
    {
        if (ServiceResult.IsBad(e.Status)) MarkDisconnected($"keep-alive failed: {e.Status}");
        else if (!IsConnected) MarkConnected();
    };

    MarkConnected();
}

/// Kepware returns Word/DWord/Byte/... as ushort/uint/byte. Ingest() only understands
/// bool, double, float, int, long, short, decimal and string — anything else becomes NO DATA.
/// Widen every other number to double here.
private static object? Normalise(object? v) => v switch
{
    null or bool or string or double or float or int or long or short or decimal => v,
    IConvertible c => System.Convert.ToDouble(c, System.Globalization.CultureInfo.InvariantCulture),
    _ => v?.ToString(),
};
```

Also:

- **Reconnect.** Use `SessionReconnectHandler` from the same package so a Kepware or network restart
  recovers without restarting the Feeder. Call `MarkDisconnected` when the link drops and
  `MarkConnected` when it returns.
- **Dispose** the session in `DisposeAsync`.
- **A tag that fails to subscribe** (wrong NodeId) — log its address. It will simply show NO TAG;
  that is correct, but automation needs the list.
- **Do not** add sleeps or timestamps. The Feeder's 10 Hz timer owns the clock; `NextFrameAsync`
  already returns nothing when data stops, which is what makes the UI show STALE.

---

## 7. API and Web configuration (IT)

### 7.1 `dotnet/src/Crm04.Api/appsettings.json`

Already correct for production: `"Source": { "Kind": "Oracle" }`. Only add the Web app's real URL to
CORS:

```json
"Cors": { "Origins": [ "http://<web-host>:5240" ] }
```

Connection string: the same `ConnectionStrings__Crm04` environment variable as the Feeder (§3.3).

### 7.2 `dotnet/src/Crm04.Web/appsettings.json`

```json
"Api": {
  "HubUrl":  "http://<api-host>:5200/hubs/telemetry",
  "BaseUrl": "http://<api-host>:5200/"
}
```

> **`BaseUrl` must be reachable from the operators' PCs, not just from the Web server.** The 3D twin
> opens a WebSocket from the **browser** straight to `ws://<api-host>:5200/ws/twin`. If `BaseUrl` is
> `localhost`, the dashboard works but the 3D page cannot connect.

---

## 8. Running in production (IT)

### 8.1 Environment — mandatory

Set on **every** service:

```text
ASPNETCORE_ENVIRONMENT = Production      (Api, Web)
DOTNET_ENVIRONMENT     = Production      (Feeder)
```

This matters for safety. In `Development`, the API and Feeder deliberately switch to a **simulator
replay**. In `Production` that is refused outright, so simulated data can never reach the plant
screen. A missing or misspelled `Source:Kind` also refuses to start.

### 8.2 Build and install

Requires the **.NET 8** runtime (ASP.NET Core Hosting Bundle on Windows).

```bash
cd dotnet
dotnet publish src/Crm04.Feeder -c Release -o C:\CRM04\Feeder
dotnet publish src/Crm04.Api    -c Release -o C:\CRM04\Api
dotnet publish src/Crm04.Web    -c Release -o C:\CRM04\Web
```

Run each as a Windows service (`sc create`, NSSM, or IIS for Api/Web). Copy
`dotnet/config/tag_mapping.csv` next to the Feeder, or set `OpcUa:MappingFile` to its full path.

### 8.3 Start order and ports

| Order | Service | Listens | Needs to reach |
|---|---|---|---|
| 1 | Crm04.Feeder | — | Kepware 49320, Oracle 1521 |
| 2 | Crm04.Api | 5200 (`ASPNETCORE_URLS=http://0.0.0.0:5200`) | Oracle 1521 |
| 3 | Crm04.Web | 5240 (`ASPNETCORE_URLS=http://0.0.0.0:5240`) | Api 5200 |
| — | Operator browsers | — | Web 5240 **and** Api 5200 |

---

## 9. Verify end to end

1. **Feeder log** shows, in order:
   `Tag mapping loaded … N address(es) feeding M tag(s), K still marked REVIEW` →
   `Plant feed connected` → `… frames written. Write p50 … ms`.
2. **Oracle:** `SELECT COUNT(*), MAX(TS_UTC), MAX(OP_MODE) FROM FRAME;` — count grows ~10/s and
   `OP_MODE` is **`LIVE`**.
3. **API:** `http://<api-host>:5200/api/diagnostics/feed` → `Running: true`, `Stale: false`,
   publish rate ≈ 10 Hz.
4. **Dashboard:** header chip **MODEL / DATA · HEALTHY**; values badged **LIVE / CALC / REF / EST /
   NO TAG**, and **never SIM**.
5. **Automated check** from a PC with Chrome/Edge:
   ```bash
   SMOKE_URL=http://<web-host>:5240/ SMOKE_EXPECT=live npm run check:smoke
   ```
   Fails if any value is badged SIM.
6. **Pull the Kepware cable (or stop the channel):** within ~3 s the UI goes **STALE**, the 3D twin
   freezes and a `COMMUNICATION_LOST` alarm is raised. Reconnect → it recovers.

---

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every page shows **NO FEED** | Feeder not writing: `ConnectAsync` not implemented, Kepware unreachable, or certificate not trusted. Check the Feeder log. |
| Feeder: `Source:Kind … refused in the 'Production' environment` | `Source:Kind` is `Replay`. Must be `OpcUa`. |
| API: `TAG_DEF is empty` | `--apply-ddl` not run against this database. |
| Feeder: `MISSING PRIVILEGES` | DBA grants from §3.1. |
| DDL fails on `INTERVAL` | Partitioning not licensed — tell the developer. |
| Feeder: `BadCertificateUntrusted` / `BadSecurityChecksFailed` | Trust the Feeder in Kepware (§4.3), and put Kepware's server cert in `pki/trusted`. |
| Many readouts **NO TAG** | Wrong `NodeIdPrefix` or `ns=` index (§4.4), or rows with an empty `TwinTag`. |
| A value is plausible but wrong | A `REVIEW` row in the CSV (§5) — reel identity, torque base, units. |
| Tag mapping error at start | CSV names a tag not in the catalogue, or a duplicate address/tag row. |
| Dashboard works, **3D page empty** | `Api:BaseUrl` is `localhost` or port 5200 blocked from operator PCs (§7.2). |
| Web: `Telemetry API unreachable` | `Api:HubUrl` wrong or API down. |
