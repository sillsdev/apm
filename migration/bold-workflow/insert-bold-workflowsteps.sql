-- BOLD workflow (Basic Oral Language Documentation) — process id: bold
-- Run this script once per environment (dev, qa, prod) against the Transcriber API database.
-- Idempotent: skips rows when a bold step with the same sequencenum already exists.
--
-- Prerequisites: at least one row in users (lastmodifiedby), and artifacttypes rows for
-- typename backtranslation, carefulspeech, and vernacular (standard seed data).
--
-- Variable: :user_email - email address of the user to associate with created/modified records

-- Careful speech step uses the carefulSpeech tool and carefulspeech artifact (clause / clause-moves segments).
INSERT INTO artifacttypes (typename, datecreated, dateupdated, lastmodifiedby)
SELECT
  'carefulspeech',
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u WHERE u.email = :'user_email' ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM artifacttypes at WHERE at.typename = 'carefulspeech')
  AND EXISTS (SELECT 1 FROM users LIMIT 1);

-- Prompt — same tool JSON as other Internalization steps (e.g. transcriber / OBT).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'Prompt',
  1,
  '{"tool": "resource"}'::jsonb,
  '{}'::jsonb,
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u WHERE u.email = :'user_email' ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 1)
  AND EXISTS (SELECT 1 FROM users LIMIT 1);

-- Record — same tool JSON as other Record steps (e.g. transcriber / OBT).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'Record',
  2,
  '{"tool": "record"}'::jsonb,
  '{}'::jsonb,
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u WHERE u.email = :'user_email' ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 2)
  AND EXISTS (SELECT 1 FROM users LIMIT 1);

-- Careful speech — dedicated tool with carefulspeech artifact.
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'CarefulSpeech',
  3,
  (
    '{"tool": "carefulSpeech", "settings": "{\"artifactTypeId\": \"'
    || (SELECT CAST(id AS TEXT) FROM artifacttypes WHERE typename = 'carefulspeech' ORDER BY id LIMIT 1)
    || '\"}"}'
  )::jsonb,
  '{}'::jsonb,
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u WHERE u.email = :'user_email' ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 3)
  AND EXISTS (SELECT 1 FROM users LIMIT 1)
  AND EXISTS (SELECT 1 FROM artifacttypes WHERE typename = 'carefulspeech');

-- LWC translation — same settings pattern as Phrase Back Translation (vernacular phrase BT artifact + BT regions).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'LwcTranslation',
  4,
  (
    '{"tool": "phraseBackTranslate", "settings": "{\"artifactTypeId\": \"'
    || (SELECT CAST(id AS TEXT) FROM artifacttypes WHERE typename = 'backtranslation' ORDER BY id LIMIT 1)
    || '\", \"namedRegion\": \"BT\"}"}'
  )::jsonb,
  '{}'::jsonb,
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u WHERE u.email = :'user_email' ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 4)
  AND EXISTS (SELECT 1 FROM users LIMIT 1)
  AND EXISTS (SELECT 1 FROM artifacttypes WHERE typename = 'backtranslation');

-- Careful transcription — transcribe the careful speech artifact (same pattern as PBT transcribe).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'CarefulTranscription',
  5,
  (
    '{"tool": "transcribe", "settings": "{\"artifactTypeId\": \"'
    || (SELECT CAST(id AS TEXT) FROM artifacttypes WHERE typename = 'carefulspeech' ORDER BY id LIMIT 1)
    || '\"}"}'
  )::jsonb,
  '{}'::jsonb,
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u WHERE u.email = :'user_email' ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 5)
  AND EXISTS (SELECT 1 FROM users LIMIT 1)
  AND EXISTS (SELECT 1 FROM artifacttypes WHERE typename = 'carefulspeech');

-- LWC transcription — same as back-translation transcription (phrase BT artifact).
INSERT INTO workflowsteps (process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT
  'bold',
  'LwcTranscription',
  6,
  (
    '{"tool": "transcribe", "settings": "{\"artifactTypeId\": \"'
    || (SELECT CAST(id AS TEXT) FROM artifacttypes WHERE typename = 'backtranslation' ORDER BY id LIMIT 1)
    || '\"}"}'
  )::jsonb,
  '{}'::jsonb,
  (now() AT TIME ZONE 'utc'),
  (now() AT TIME ZONE 'utc'),
  (SELECT u.id FROM users u WHERE u.email = :'user_email' ORDER BY u.id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 6)
  AND EXISTS (SELECT 1 FROM users LIMIT 1)
  AND EXISTS (SELECT 1 FROM artifacttypes WHERE typename = 'backtranslation');
