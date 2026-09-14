-- =====================================================================
-- CRM04 DIGITAL TWIN — SCHEMA
--
-- Target: Oracle with the Partitioning option licensed (confirmed).
-- Run as the CRM04 application schema (mill4), not as SYS.
--
-- THE LOAD THIS IS SHAPED FOR
--   108 tags x 10 Hz = 1,080 rows/s = 64,800/min = ~93M rows/day, ~155 MB/hour.
--
-- A plain heap TAG_SAMPLE(TS, TAG_NAME, VALUE) would scatter one frame's 108 rows across 108
-- blocks, turn a one-hour single-signal trend into a 36,000-row scan, and fill the tablespace
-- in two days. All three are fixed by SHAPE, not by hardware:
--
--   TAG_SAMPLE is an INDEX-ORGANIZED TABLE keyed (FRAME_ID, TAG_ID), so one frame's rows are
--   physically contiguous and "read frame N" is a single range scan with zero table lookups.
--
--   TREND_SAMPLE holds pre-bucketed aggregates, so the trend page NEVER touches TAG_SAMPLE.
--
--   CURRENT_TAG holds one row per tag, so a newly connected client gets a full snapshot from
--   122 rows instead of hunting for the latest frame.
--
-- The last two are derived caches maintained by the writer, not a second source of truth —
-- the same relationship telemetryStore has to machineStore in the TypeScript app.
-- =====================================================================


-- ---------------------------------------------------------------------
-- TAG_DEF — the tag catalogue.
--
-- Seeded from db/seed/tag_definitions.sql, which is GENERATED from
-- src/data/tagDefinitions.ts by scripts/exportTagCatalog.ts. The same generator writes the C#
-- catalogue in the same run, so the database and the application cannot disagree about which
-- tags exist or what ordinal each one occupies.
-- ---------------------------------------------------------------------
CREATE TABLE TAG_DEF (
  TAG_ID            NUMBER(5)     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  TAG_NAME          VARCHAR2(64)  NOT NULL,
  DESCRIPTION       VARCHAR2(256) NOT NULL,
  UNIT              VARCHAR2(16),
  SIM_PROVENANCE    VARCHAR2(12)  NOT NULL
    CONSTRAINT CK_TAGDEF_SIMPROV
    CHECK (SIM_PROVENANCE IN ('MEASURED','REFERENCE','CALCULATED','SIMULATED','ESTIMATED','UNAVAILABLE')),
  LIVE_AVAILABILITY VARCHAR2(12)  NOT NULL
    CONSTRAINT CK_TAGDEF_LIVEAVAIL
    CHECK (LIVE_AVAILABILITY IN ('MEASURED','REFERENCE','CALCULATED','ESTIMATED','UNAVAILABLE')),
  LIVE_NOTE         VARCHAR2(1000),
  DECIMALS          NUMBER(2),
  -- TagLimits flattened. NULL means "this bound is not configured", which is a different
  -- statement from zero — the alarm engine tests each bound for presence before comparing.
  LIM_LOW           BINARY_DOUBLE,
  LIM_HIGH          BINARY_DOUBLE,
  LIM_WARN_LOW      BINARY_DOUBLE,
  LIM_WARN_HIGH     BINARY_DOUBLE,
  LIM_ALARM_LOW     BINARY_DOUBLE,
  LIM_ALARM_HIGH    BINARY_DOUBLE,
  LIM_TRIP_HIGH     BINARY_DOUBLE,
  -- The wire position used by the compact frame DTO. The SignalR payload is an array indexed by
  -- this rather than a map keyed by name, which is what takes a 10 Hz frame from ~9 KB to ~1.4 KB.
  -- A reordered catalogue would silently shift every value into a neighbouring tag's slot, so the
  -- API asserts these against its own catalogue at startup rather than trusting them.
  ORDINAL           NUMBER(5)     NOT NULL,
  CONSTRAINT UQ_TAGDEF_NAME    UNIQUE (TAG_NAME),
  CONSTRAINT UQ_TAGDEF_ORDINAL UNIQUE (ORDINAL)
);


-- ---------------------------------------------------------------------
-- FRAME — one row per published instant. The only table the API's poller reads to
-- decide whether anything new has happened.
--
-- Interval-partitioned on FRAME_ID at 36,000 frames per partition, which is one hour at 10 Hz.
-- Partitioning on the sequence rather than on time so that TAG_SAMPLE — an index-organized
-- table whose partition key MUST be a subset of its primary key — can use the same boundaries.
-- Retention then drops matching partitions from both tables with one cutoff.
-- ---------------------------------------------------------------------
CREATE SEQUENCE FRAME_SEQ START WITH 1 INCREMENT BY 1 CACHE 1000 NOORDER NOCYCLE;

CREATE TABLE FRAME (
  FRAME_ID   NUMBER(19)   NOT NULL,
  -- Epoch milliseconds. The canonical timestamp, matching the TypeScript `number` exactly, so a
  -- value round-trips TS -> JSONL -> Oracle -> C# without a conversion that could drift.
  EPOCH_MS   NUMBER(13)   NOT NULL,
  -- Human/analyst convenience only. Nothing in the application reads it.
  TS_UTC     TIMESTAMP(3) NOT NULL,
  SOURCE_ID  VARCHAR2(64) NOT NULL,
  OP_MODE    VARCHAR2(12) NOT NULL
    CONSTRAINT CK_FRAME_MODE CHECK (OP_MODE IN ('SIMULATION','SIM_46TAG','LIVE')),
  -- Written, then asserted on read. Makes a truncated frame DETECTABLE rather than silently
  -- misread as "many tags are absent from this feed", which would look like a §7.4 degradation.
  TAG_COUNT  NUMBER(4)    NOT NULL,
  CONSTRAINT PK_FRAME PRIMARY KEY (FRAME_ID)
)
PARTITION BY RANGE (FRAME_ID)
INTERVAL (36000)
( PARTITION P_FRAME_INIT VALUES LESS THAN (1) );


-- ---------------------------------------------------------------------
-- TAG_SAMPLE — the EAV history. The hot table.
--
-- ORGANIZATION INDEX: the primary key IS the table. One frame's 108 rows are physically
-- contiguous, so reading a frame is one index range scan with no table access at all.
--
-- No overflow segment is declared: the widest possible row is about 90 bytes against a
-- PCTTHRESHOLD of 50% of an 8K block, so nothing can approach the limit.
--
-- NOTE THE ABSENT FOREIGN KEY TO FRAME. Retention drops partitions rather than deleting rows,
-- and an enforced FK would block dropping a parent partition. Both tables are partitioned on
-- FRAME_ID with identical boundaries and the writer inserts into both in one transaction, so
-- the relationship is maintained by construction. The FK to TAG_DEF stays — that table is 122
-- static, fully-cached rows, and the check costs nothing.
-- ---------------------------------------------------------------------
CREATE TABLE TAG_SAMPLE (
  FRAME_ID   NUMBER(19)   NOT NULL,
  TAG_ID     NUMBER(5)    NOT NULL,
  -- HOW THE NULL SEMANTICS SURVIVE THE DATABASE, and the single easiest thing here to get wrong:
  --   'N'  numeric value, in NUM_VALUE
  --   'B'  boolean, 0 or 1 in NUM_VALUE
  --   'S'  string / enum, in STR_VALUE
  --   'X'  the tag IS on this feed and currently reads NOTHING — both value columns NULL
  --   no row at all  =  the feed has no such tag
  -- The last two are different statements about the mill: "instrument down" versus "not
  -- instrumented". Collapsing them would break §7.4 silently.
  VAL_KIND   CHAR(1)      NOT NULL
    CONSTRAINT CK_SAMPLE_KIND CHECK (VAL_KIND IN ('N','S','B','X')),
  -- BINARY_DOUBLE, not NUMBER: it is IEEE-754, so the value is bit-identical to the C# double
  -- and the JavaScript number it came from. NUMBER would be decimal and would round.
  NUM_VALUE  BINARY_DOUBLE,
  STR_VALUE  VARCHAR2(64),
  CONSTRAINT PK_TAG_SAMPLE PRIMARY KEY (FRAME_ID, TAG_ID),
  CONSTRAINT FK_SAMPLE_TAG FOREIGN KEY (TAG_ID) REFERENCES TAG_DEF (TAG_ID)
)
ORGANIZATION INDEX
PARTITION BY RANGE (FRAME_ID)
INTERVAL (36000)
( PARTITION P_SAMPLE_INIT VALUES LESS THAN (1) );


-- ---------------------------------------------------------------------
-- CURRENT_TAG / CURRENT_FRAME — the latest value of every tag.
--
-- A derived cache, MERGEd by the writer on every frame. It exists so a newly connected client
-- gets a complete snapshot from one 122-row scan instead of finding the newest FRAME_ID and
-- then reading its samples. Small, hot, and always fully in the buffer cache.
-- ---------------------------------------------------------------------
CREATE TABLE CURRENT_TAG (
  TAG_ID     NUMBER(5)  NOT NULL,
  FRAME_ID   NUMBER(19) NOT NULL,
  EPOCH_MS   NUMBER(13) NOT NULL,
  VAL_KIND   CHAR(1)    NOT NULL
    CONSTRAINT CK_CURTAG_KIND CHECK (VAL_KIND IN ('N','S','B','X')),
  NUM_VALUE  BINARY_DOUBLE,
  STR_VALUE  VARCHAR2(64),
  CONSTRAINT PK_CURRENT_TAG PRIMARY KEY (TAG_ID)
) ORGANIZATION INDEX;

-- One row, enforced by the check constraint, so "what is the latest frame" is an atomic read
-- rather than a MAX() over a partitioned table.
CREATE TABLE CURRENT_FRAME (
  ONLY_ROW   NUMBER(1)    NOT NULL
    CONSTRAINT CK_CURFRAME_SINGLETON CHECK (ONLY_ROW = 1),
  FRAME_ID   NUMBER(19)   NOT NULL,
  EPOCH_MS   NUMBER(13)   NOT NULL,
  OP_MODE    VARCHAR2(12) NOT NULL,
  SOURCE_ID  VARCHAR2(64) NOT NULL,
  TAG_COUNT  NUMBER(4)    NOT NULL,
  CONSTRAINT PK_CURRENT_FRAME PRIMARY KEY (ONLY_ROW)
);


-- ---------------------------------------------------------------------
-- TREND_SAMPLE — pre-aggregated history for the trend charts.
--
-- Mirrors telemetryStore.ts: 240 points per window. Bucket sizes chosen so 240 points cover the
-- windows the UI offers —
--    1 s buckets -> 240 points =  4 min   (serves the 1m window)
--    5 s buckets -> 240 points = 20 min   (serves 5m and 15m)
--   15 s buckets -> 240 points =  1 hour  (serves 30m and 1h)
--
-- The PK on an index-organized table makes one chart series exactly one contiguous range scan
-- of at most 240 rows. THIS is the answer to "how do reads stay fast": the trend page never
-- touches the 10 Hz table at all.
-- ---------------------------------------------------------------------
CREATE TABLE TREND_SAMPLE (
  TAG_ID     NUMBER(5)  NOT NULL,
  BUCKET_SEC NUMBER(3)  NOT NULL
    CONSTRAINT CK_TREND_BUCKET CHECK (BUCKET_SEC IN (1,5,15)),
  -- floor(EPOCH_MS / (BUCKET_SEC * 1000)) * BUCKET_SEC * 1000
  BUCKET_MS  NUMBER(13) NOT NULL,
  AVG_V      BINARY_DOUBLE NOT NULL,
  MIN_V      BINARY_DOUBLE NOT NULL,
  MAX_V      BINARY_DOUBLE NOT NULL,
  -- Sample count in the bucket. A chart can then show that a point covering 3 samples is less
  -- trustworthy than one covering 150.
  N          NUMBER(6)  NOT NULL,
  CONSTRAINT PK_TREND PRIMARY KEY (TAG_ID, BUCKET_SEC, BUCKET_MS),
  CONSTRAINT FK_TREND_TAG FOREIGN KEY (TAG_ID) REFERENCES TAG_DEF (TAG_ID)
) ORGANIZATION INDEX;


-- ---------------------------------------------------------------------
-- ALARM_EVENT — the latching layer's history.
--
-- The alarm ENGINE is pure and stateless: it reports which conditions are true right now. This
-- table is where raise/clear/acknowledge become durable, which is an improvement on the
-- TypeScript app's in-memory bounded log — alarm history now survives an API restart.
-- ---------------------------------------------------------------------
CREATE TABLE ALARM_EVENT (
  ALARM_EVENT_ID NUMBER(19) GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ALARM_KEY      VARCHAR2(48)  NOT NULL,
  RAISED_MS      NUMBER(13)    NOT NULL,
  CLEARED_MS     NUMBER(13),
  ACKED_MS       NUMBER(13),
  ACKED_BY       VARCHAR2(64),
  SEVERITY       VARCHAR2(8)   NOT NULL
    CONSTRAINT CK_ALARM_SEVERITY CHECK (SEVERITY IN ('INFO','WARNING','ALARM','TRIP')),
  PARAMETER      VARCHAR2(64)  NOT NULL,
  TAG_NAME       VARCHAR2(64)  NOT NULL,
  ACTUAL_VALUE   BINARY_DOUBLE NOT NULL,
  LIMIT_VALUE    BINARY_DOUBLE NOT NULL,
  UNIT           VARCHAR2(16),
  MESSAGE        VARCHAR2(400) NOT NULL,
  TWIN_SECTION   VARCHAR2(16),
  COIL_ID        VARCHAR2(32)
);


-- ---------------------------------------------------------------------
-- MACHINE_EVENT — the §11.4 event timeline.
-- ---------------------------------------------------------------------
CREATE TABLE MACHINE_EVENT (
  EVENT_ID   NUMBER(19) GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  EPOCH_MS   NUMBER(13)    NOT NULL,
  CATEGORY   VARCHAR2(10)  NOT NULL
    CONSTRAINT CK_EVENT_CATEGORY
    CHECK (CATEGORY IN ('STATE','PASS','SETPOINT','ALARM','COMMS','OPERATOR')),
  MESSAGE    VARCHAR2(400) NOT NULL,
  COIL_ID    VARCHAR2(32),
  PASS_NO    NUMBER(3)
);


-- ---------------------------------------------------------------------
-- COIL / PASS_SCHEDULE — the material and its plan.
-- ---------------------------------------------------------------------
CREATE TABLE COIL (
  COIL_ID       VARCHAR2(32) PRIMARY KEY,
  GRADE         VARCHAR2(64),
  WIDTH_MM      BINARY_DOUBLE NOT NULL,
  ENTRY_THK_MM  BINARY_DOUBLE NOT NULL,
  FINAL_THK_MM  BINARY_DOUBLE NOT NULL,
  MASS_T        BINARY_DOUBLE,
  INNER_DIA_MM  BINARY_DOUBLE,
  OUTER_DIA_MM  BINARY_DOUBLE,
  CHARGED_MS    NUMBER(13),
  DISCHARGED_MS NUMBER(13)
);

CREATE TABLE PASS_SCHEDULE (
  SCHEDULE_ID NUMBER(19) GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  COIL_ID     VARCHAR2(32) NOT NULL
    CONSTRAINT FK_SCHED_COIL REFERENCES COIL (COIL_ID),
  SOURCE      VARCHAR2(64) NOT NULL,
  CREATED_MS  NUMBER(13)   NOT NULL
);

CREATE TABLE PASS_SCHEDULE_ENTRY (
  SCHEDULE_ID        NUMBER(19)  NOT NULL
    CONSTRAINT FK_PASSENTRY_SCHED REFERENCES PASS_SCHEDULE (SCHEDULE_ID) ON DELETE CASCADE,
  PASS_NO            NUMBER(3)   NOT NULL,
  DIRECTION          VARCHAR2(8) NOT NULL
    CONSTRAINT CK_PASSENTRY_DIR CHECK (DIRECTION IN ('FORWARD','REVERSE')),
  INPUT_THK_MM       BINARY_DOUBLE NOT NULL,
  OUTPUT_THK_MM      BINARY_DOUBLE NOT NULL,
  REDUCTION_PCT      BINARY_DOUBLE NOT NULL,
  SPEED_REF_MPM      BINARY_DOUBLE NOT NULL,
  ENTRY_SPEC_TENSION BINARY_DOUBLE NOT NULL,
  EXIT_SPEC_TENSION  BINARY_DOUBLE NOT NULL,
  PREDICTED_FORCE_T  BINARY_DOUBLE NOT NULL,
  CONSTRAINT PK_PASS_ENTRY PRIMARY KEY (SCHEDULE_ID, PASS_NO)
) ORGANIZATION INDEX;
