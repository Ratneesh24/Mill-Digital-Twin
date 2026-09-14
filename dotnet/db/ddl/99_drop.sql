-- =====================================================================
-- CRM04 DIGITAL TWIN — TEARDOWN
--
-- Drops everything this schema owns. Destructive, obviously: run it only against a development
-- database you are willing to lose.
--
-- Order matters where foreign keys exist; CASCADE CONSTRAINTS covers the rest. Each drop is
-- wrapped so a missing object is not an error — the script has to work on a partially-created
-- schema, which is exactly the state you are in when a DDL run failed halfway.
-- =====================================================================

BEGIN
  FOR t IN (
    SELECT table_name FROM user_tables
     WHERE table_name IN (
       'TAG_SAMPLE', 'FRAME', 'CURRENT_TAG', 'CURRENT_FRAME', 'TREND_SAMPLE',
       'ALARM_EVENT', 'MACHINE_EVENT', 'PASS_SCHEDULE_ENTRY', 'PASS_SCHEDULE',
       'COIL', 'TAG_DEF')
  ) LOOP
    EXECUTE IMMEDIATE 'DROP TABLE ' || t.table_name || ' CASCADE CONSTRAINTS PURGE';
  END LOOP;

  FOR s IN (SELECT sequence_name FROM user_sequences WHERE sequence_name IN ('FRAME_SEQ')) LOOP
    EXECUTE IMMEDIATE 'DROP SEQUENCE ' || s.sequence_name;
  END LOOP;
END;
/
