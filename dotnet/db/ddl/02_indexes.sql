-- =====================================================================
-- CRM04 DIGITAL TWIN — INDEXES
--
-- Deliberately few. TAG_SAMPLE, CURRENT_TAG, TREND_SAMPLE and PASS_SCHEDULE_ENTRY are
-- index-organized: their primary key IS the table, so a secondary index on them would be a
-- second full-size structure to maintain at 1,080 rows/second. Every access path those tables
-- need is already the PK.
--
-- NO LOCAL INDEXES, deliberately. This database does not have the Partitioning option, so FRAME
-- and TAG_SAMPLE are ordinary segments and `LOCAL` would raise ORA-14016 — the underlying table
-- of a local partitioned index must itself be partitioned. Retention is a chunked DELETE, so
-- these indexes are maintained row by row like any other.
-- =====================================================================


-- The poller reads FRAME by FRAME_ID > watermark, which the primary key already serves.
-- This one covers the other question anyone asks of FRAME: "what was happening at time T?" —
-- retention's cutoff lookup, and any analyst query.
CREATE INDEX IX_FRAME_EPOCH ON FRAME (EPOCH_MS);


-- The alarm panel asks two questions, and each gets an index.
--   "what is active right now"  -> CLEARED_MS IS NULL, newest first
CREATE INDEX IX_ALARM_ACTIVE ON ALARM_EVENT (CLEARED_MS, SEVERITY, RAISED_MS DESC);
--   "what happened recently"    -> history, newest first
CREATE INDEX IX_ALARM_TIME   ON ALARM_EVENT (RAISED_MS DESC);
-- Latching looks up the open event for a rule key on every raise/clear decision.
CREATE INDEX IX_ALARM_KEY    ON ALARM_EVENT (ALARM_KEY, CLEARED_MS);


-- The event timeline is always read newest-first.
CREATE INDEX IX_EVENT_TIME ON MACHINE_EVENT (EPOCH_MS DESC);


-- Finding the schedule for the coil currently on the line.
CREATE INDEX IX_SCHED_COIL ON PASS_SCHEDULE (COIL_ID, CREATED_MS DESC);
