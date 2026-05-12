-- BOLD workflow (Basic Oral Language Documentation) — process id: bold
-- Run this script once per environment (dev, qa, prod) against the Transcriber API database.
-- Idempotent: skips rows when a bold step with the same sequencenum already exists.
--
-- Prerequisites: at least one row in users (lastmodifiedby), and artifacttypes rows for
-- typename backtranslation, wholebacktranslation, and vernacular (standard seed data).

-- Careful speech recordings use a dedicated artifact type (phrase-style segments use NamedRegions.CarefulSpeech).
INSERT INTO artifacttypes (typename, datecreated, dateupdated, lastmodifiedby)
SELECT
  'carefulspeech',
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM artifacttypes at WHERE at.typename = 'carefulspeech')
  AND EXISTS (SELECT 1 FROM users LIMIT 1);

-- Record — same tool JSON as other Record steps (e.g. transcriber / OBT).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'Record',
  1,
  '{"tool": "record"}',
  '{}',
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 1)
  AND EXISTS (SELECT 1 FROM users LIMIT 1);

-- Careful speech — phrase back translate with carefulspeech artifact and its own named segment bucket.
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'Careful speech',
  2,
  '{"tool": "phraseBackTranslate", "settings": {"artifactTypeId": "'
    || (SELECT CAST(id AS TEXT) FROM artifacttypes WHERE typename = 'carefulspeech' ORDER BY id LIMIT 1)
    || '", "namedRegion": "CarefulSpeech"}}',
  '{}',
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 2)
  AND EXISTS (SELECT 1 FROM users LIMIT 1)
  AND EXISTS (SELECT 1 FROM artifacttypes WHERE typename = 'carefulspeech');

-- Lwc translation — same settings pattern as Phrase Back Translation (vernacular phrase BT artifact + BT regions).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'Lwc translation',
  3,
  '{"tool": "phraseBackTranslate", "settings": {"artifactTypeId": "'
    || (SELECT CAST(id AS TEXT) FROM artifacttypes WHERE typename = 'backtranslation' ORDER BY id LIMIT 1)
    || '", "namedRegion": "BT"}}',
  '{}',
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 3)
  AND EXISTS (SELECT 1 FROM users LIMIT 1)
  AND EXISTS (SELECT 1 FROM artifacttypes WHERE typename = 'backtranslation');

-- Careful transcription — transcribe the careful speech artifact (same pattern as PBT transcribe).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'Careful transcription',
  4,
  '{"tool": "transcribe", "settings": {"artifactTypeId": "'
    || (SELECT CAST(id AS TEXT) FROM artifacttypes WHERE typename = 'carefulspeech' ORDER BY id LIMIT 1)
    || '"}}',
  '{}',
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 4)
  AND EXISTS (SELECT 1 FROM users LIMIT 1)
  AND EXISTS (SELECT 1 FROM artifacttypes WHERE typename = 'carefulspeech');

-- Lwc transcription — same as back-translation transcription (phrase BT artifact).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'Lwc transcription',
  5,
  '{"tool": "transcribe", "settings": {"artifactTypeId": "'
    || (SELECT CAST(id AS TEXT) FROM artifacttypes WHERE typename = 'backtranslation' ORDER BY id LIMIT 1)
    || '"}}',
  '{}',
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 5)
  AND EXISTS (SELECT 1 FROM users LIMIT 1)
  AND EXISTS (SELECT 1 FROM artifacttypes WHERE typename = 'backtranslation');

-- Free translation — whole back translate (same tool JSON as other WBT steps).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'Free translation',
  6,
  '{"tool": "wholeBackTranslate"}',
  '{}',
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 6)
  AND EXISTS (SELECT 1 FROM users LIMIT 1);

-- Free transcription — same as whole-back-translation transcription step (WBT artifact).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'Free transcription',
  7,
  '{"tool": "transcribe", "settings": {"artifactTypeId": "'
    || (SELECT CAST(id AS TEXT) FROM artifacttypes WHERE typename = 'wholebacktranslation' ORDER BY id LIMIT 1)
    || '"}}',
  '{}',
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 7)
  AND EXISTS (SELECT 1 FROM users LIMIT 1)
  AND EXISTS (SELECT 1 FROM artifacttypes WHERE typename = 'wholebacktranslation');
