-- BOLD workflow (Basic Oral Language Documentation) — process id: bold
-- Run this script once per environment (dev, qa, prod) against the Transcriber API database.
-- Idempotent: skips rows when a bold step with the same sequencenum already exists.

INSERT INTO workflowsteps (id, process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT gen_random_uuid(), 'bold', 'Record', 1, '{"tool": "record"}', '{}', (now() AT TIME ZONE 'utc'), (now() AT TIME ZONE 'utc'), 0
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 1);

INSERT INTO workflowsteps (id, process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT gen_random_uuid(), 'bold', 'Careful speech', 2, '{"tool": "phraseBackTranslate"}', '{}', (now() AT TIME ZONE 'utc'), (now() AT TIME ZONE 'utc'), 0
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 2);

INSERT INTO workflowsteps (id, process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT gen_random_uuid(), 'bold', 'Lwc translation', 3, '{"tool": "phraseBackTranslate"}', '{}', (now() AT TIME ZONE 'utc'), (now() AT TIME ZONE 'utc'), 0
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 3);

INSERT INTO workflowsteps (id, process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT gen_random_uuid(), 'bold', 'Careful transcription', 4, '{"tool": "transcribe"}', '{}', (now() AT TIME ZONE 'utc'), (now() AT TIME ZONE 'utc'), 0
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 4);

INSERT INTO workflowsteps (id, process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT gen_random_uuid(), 'bold', 'Lwc transcription', 5, '{"tool": "transcribe"}', '{}', (now() AT TIME ZONE 'utc'), (now() AT TIME ZONE 'utc'), 0
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 5);

INSERT INTO workflowsteps (id, process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT gen_random_uuid(), 'bold', 'Free translation', 6, '{"tool": "wholeBackTranslate"}', '{}', (now() AT TIME ZONE 'utc'), (now() AT TIME ZONE 'utc'), 0
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 6);

INSERT INTO workflowsteps (id, process, name, sequencenum, tool, permissions, datecreated, dateupdated, lastmodifiedby)
SELECT gen_random_uuid(), 'bold', 'Free transcription', 7, '{"tool": "transcribe"}', '{}', (now() AT TIME ZONE 'utc'), (now() AT TIME ZONE 'utc'), 0
WHERE NOT EXISTS (SELECT 1 FROM workflowsteps WHERE process = 'bold' AND sequencenum = 7);
