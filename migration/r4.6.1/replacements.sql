-- audio replacements
INSERT INTO public.artifacttypes
(typename, datecreated, dateupdated, lastmodifiedby, archived, lastmodifiedorigin)
VALUES('replacement', current_timestamp at time zone 'utc', current_timestamp at time zone 'utc', (select min(id) from users where email = 'sara_hentzel@sil.org'), false, 'setup'::text);

alter table passages add unversionedrenderingurl text;
alter table mediafiles add rendersourcemediaid int REFERENCES mediafiles(id) ON DELETE CASCADE;
alter table mediafiles add note text;

drop table mediareplacements;

CREATE TABLE mediareplacements (
    id SERIAL PRIMARY KEY,
    planid int not null REFERENCES plans(id) ON DELETE cascade,
    replacementmediafileid INTEGER NOT NULL
        REFERENCES mediafiles(id) ON DELETE cascade,
    selectionstart float8 not null,
    selectionend float8 not null,
    outputmediafileid INTEGER REFERENCES "mediafiles"(id) ON DELETE set NULL,
    datecreated timestamp NULL,
	dateupdated timestamp null,
	lastmodifiedby int references users(id) on delete set null,
	lastmodifiedorigin text,
	archived boolean
);
grant all on mediareplacements to transcriber;

