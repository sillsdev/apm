alter table copyprojects 
ALTER COLUMN oldid TYPE text;
alter table copyprojects 
ALTER COLUMN newprojid TYPE text;

alter table activitystates add column offlineid text;
alter table artifactcategorys add column offlineid text;
alter table artifacttypes add column offlineid text;
alter table biblebrainbibles  add column offlineid text;
alter table biblebrainfilesets add column offlineid text;
alter table biblebrainsections add column offlineid text;
alter table bibles add column offlineid text;
alter table copyprojects add column offlineid text;
alter table currentversions add column offlineid text;
alter table graphics add column offlineid text;
alter table groupmemberships add column offlineid text;
alter table groups add column offlineid text;
alter table integrations add column offlineid text;
alter table invitations add column offlineid text;
alter table organizationbibles  add column offlineid text;
alter table organizationmemberships  add column offlineid text;
alter table organizations  add column offlineid text;
alter table organizationschemes  add column offlineid text;
alter table organizationschemesteps   add column offlineid text;
alter table orgworkflowsteps  add column offlineid text;
alter table paratextsyncpassages   add column offlineid text;
alter table paratextsyncs   add column offlineid text;
alter table passages   add column offlineid text;
alter table passagestatechanges   add column offlineid text;
alter table passagetypes   add column offlineid text;
alter table plans  add column offlineid text;
alter table plantypes  add column offlineid text;
alter table projectintegrations   add column offlineid text;
alter table projects  add column offlineid text;
alter table projecttypes  add column offlineid text;
alter table roles  add column offlineid text;
alter table sectionpassages  add column offlineid text;
alter table sectionresources  add column offlineid text;
alter table sectionresourceusers  add column offlineid text;
alter table sections  add column offlineid text;
alter table sharedresourcereferences  add column offlineid text;
alter table sharedresources   add column offlineid text;
alter table users  add column offlineid text;
alter table userversions  add column offlineid text;
alter table workflowsteps  add column offlineid text;

alter table passages add column offlinesharedresourceid text;
alter table sections add column offlinetitlemediafileid  text;
alter table artifactcategorys  add column offlinetitlemediafileid  text;
alter table mediafiles add column offlinesourcemediaid text;
alter table mediafiles add column offlinepassageid text;
alter table mediafiles add column offlineresourcepassageid text;
alter table sharedresources add column offlinetitlemediafileid text;



-- public.notes source

CREATE OR REPLACE VIEW public.notes
AS WITH maxv AS (
         SELECT max(mm.versionnumber) AS versionnumber,
            mm.passageid
           FROM mediafiles mm
             JOIN plans ON mm.planid = plans.id
             JOIN projects ON plans.projectid = projects.id
          WHERE NOT mm.archived
          GROUP BY mm.passageid
        ), latest AS (
         SELECT lm.passageid,
            lm.id,
            true AS latest
           FROM mediafiles lm
             JOIN maxv ON lm.passageid = maxv.passageid AND lm.versionnumber = maxv.versionnumber AND NOT lm.archived
        )
 SELECT p.id,
    pr.id AS projectid,
    pr.name AS projectname,
    pr.organizationid,
    o.name AS organization,
    pr.language,
    pl.id AS planid,
    pl.name AS planname,
    pt.name AS plantype,
    s.id AS sectionid,
    s.name AS sectionname,
    s.sequencenum AS sectionsequencenum,
    m.id AS mediafileid,
    p.id AS passageid,
    p.sequencenum AS passagesequencenum,
    p.book,
    p.reference,
    concat(s.sequencenum::bigint::character varying, '.', p.sequencenum::bigint::character varying, ' ',
        CASE
            WHEN p.book IS NULL THEN ''::text
            ELSE concat(p.book, ' ')
        END, p.reference) AS passagedesc,
    m.versionnumber,
    m.audiourl,
    m.duration,
    m.contenttype,
    m.transcription,
    m.originalfile,
    m.filesize,
    m.s3file,
    COALESCE(c2.categoryname, c.categoryname) AS categoryname,
    t.typename,
    m.lastmodifiedby,
    m.datecreated,
    m.dateupdated,
    m.lastmodifiedorigin,
    COALESCE(latest.latest, false) AS latest,
    s2.id AS resourceid,
    s2.clusterid,
    s2.title,
    s2.description,
    COALESCE(s2.languagebcp47, m.languagebcp47) AS languagebcp47,
    s2.termsofuse,
    s2.keywords,
    s2.artifactcategoryid,
    s2.note,
    s2.offlineid
   FROM organizations o
     JOIN projects pr ON pr.organizationid = o.id
     JOIN plans pl ON pl.projectid = pr.id
     JOIN plantypes pt ON pl.plantypeid = pt.id
     JOIN sections s ON s.planid = pl.id
     JOIN passages p ON p.sectionid = s.id AND NOT p.archived
     JOIN sharedresources s2 ON p.id = s2.passageid
     LEFT JOIN latest ON latest.passageid = p.id
     LEFT JOIN mediafiles m ON m.id = latest.id
     LEFT JOIN artifactcategorys c ON m.artifactcategoryid = c.id
     LEFT JOIN artifactcategorys c2 ON s2.artifactcategoryid = c2.id
     LEFT JOIN artifacttypes t ON m.artifacttypeid = t.id
  WHERE s2.note = true;

-- public.resources source

CREATE OR REPLACE VIEW public.resources
AS WITH maxv AS (
         SELECT max(mm.versionnumber) AS versionnumber,
            mm.passageid
           FROM mediafiles mm
             JOIN plans ON mm.planid = plans.id
             JOIN projects ON plans.projectid = projects.id
          WHERE projects.ispublic = true AND mm.readytoshare
          GROUP BY mm.passageid
        ), latest AS (
         SELECT lm.id,
            true AS latest
           FROM mediafiles lm
             JOIN maxv ON lm.passageid = maxv.passageid AND lm.versionnumber = maxv.versionnumber
        )
 SELECT p.id,
    pr.id AS projectid,
    pr.name AS projectname,
    pr.organizationid,
    o.name AS organization,
    pr.language,
    pl.id AS planid,
    pl.name AS planname,
    pt.name AS plantype,
    s.id AS sectionid,
    s.name AS sectionname,
    s.sequencenum AS sectionsequencenum,
    m.id AS mediafileid,
    p.id AS passageid,
    p.sequencenum AS passagesequencenum,
    p.book,
    p.reference,
    concat(s.sequencenum::bigint::character varying, '.', p.sequencenum::bigint::character varying, ' ',
        CASE
            WHEN p.book IS NULL THEN ''::text
            ELSE concat(p.book, ' ')
        END, p.reference) AS passagedesc,
    m.versionnumber,
    m.audiourl,
    m.duration,
    m.contenttype,
    m.transcription,
    m.originalfile,
    m.filesize,
    m.s3file,
    COALESCE(c2.categoryname, c.categoryname) AS categoryname,
    t.typename,
    m.lastmodifiedby,
    m.datecreated,
    m.dateupdated,
    m.lastmodifiedorigin,
    COALESCE(latest.latest, false) AS latest,
    s2.id AS resourceid,
    s2.clusterid,
    s2.title,
    s2.description,
    COALESCE(s2.languagebcp47, m.languagebcp47) AS languagebcp47,
    s2.termsofuse,
    s2.keywords,
    s2.artifactcategoryid,
    s2.offlineid
   FROM organizations o
     JOIN projects pr ON pr.organizationid = o.id
     JOIN plans pl ON pl.projectid = pr.id
     JOIN plantypes pt ON pl.plantypeid = pt.id
     JOIN sections s ON s.planid = pl.id
     JOIN passages p ON p.sectionid = s.id
     JOIN mediafiles m ON p.id = m.passageid
     JOIN latest ON m.id = latest.id
     LEFT JOIN sharedresources s2 ON p.id = s2.passageid
     LEFT JOIN artifactcategorys c ON m.artifactcategoryid = c.id
     LEFT JOIN artifactcategorys c2 ON s2.artifactcategoryid = c2.id
     LEFT JOIN artifacttypes t ON m.artifacttypeid = t.id
  WHERE pr.ispublic AND m.readytoshare AND NOT m.archived AND (m.publishto ->> 'Internalization'::text) = 'true'::text;
