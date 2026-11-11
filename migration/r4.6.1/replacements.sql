-- audio replacements
INSERT INTO public.artifacttypes
(typename, datecreated, dateupdated, lastmodifiedby, archived, lastmodifiedorigin)
VALUES('replacement', current_timestamp at time zone 'utc', current_timestamp at time zone 'utc', (select min(id) from users where email = 'sara_hentzel@sil.org'), false, 'setup'::text);

alter table passages add unversionedrenderingurl text;
alter table mediafiles add rendersourcemediaid int REFERENCES mediafiles(id) ON DELETE CASCADE;
alter table mediafiles add note text;

--drop table mediareplacements;

CREATE TABLE public.mediareplacements (
	id serial4 PRIMARY KEY,
	passageid int4 NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
	replacementmediafileid int4 NOT NULL REFERENCES mediafiles(id) ON DELETE CASCADE,
	selectionstart float8  NULL,
	selectionend float8  NULL,
	outputmediafileid int4 NULL REFERENCES mediafiles(id) ON DELETE set NULL,
	datecreated timestamp NULL,
	dateupdated timestamp NULL,
	lastmodifiedby int4 NULL REFERENCES users(id) ON DELETE set NULL,
	lastmodifiedorigin text NULL,
	offlineid text null,
	archived boolean default false NOT NULL,

);

grant all on mediareplacements to transcriber;

