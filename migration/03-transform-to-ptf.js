/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * OneStory to APM PTF Transformer
 *
 * This script transforms the scraped OneStory data into APM's PTF format.
 *
 * PTF Format Structure:
 * - ZIP file containing:
 *   - SILTranscriber (export timestamp)
 *   - Version (schema version)
 *   - data/*.json (database tables in JSON API format)
 *   - media/*.mp3 (audio files)
 *
 * Usage: node 03-transform-to-ptf.js
 */

const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const { DateTime } = require('luxon');
const { getLangTag, getRtl } = require('mui-language-picker');
const SAMPLE_ARTIFACT_CATEGORIES = require('./APM_PTF_Sample/data/C_artifactcategorys.json');
const SAMPLE_ARTIFACT_TYPES = require('./APM_PTF_Sample/data/C_artifacttypes.json');
const SAMPLE_PASSAGE_TYPES = require('./APM_PTF_Sample/data/B_passagetypes.json');
const SAMPLE_ORG_WORKFLOW_STEPS = require('./APM_PTF_Sample/data/C_orgworkflowsteps.json');
const SAMPLE_WORKFLOW_STEPS = require('./APM_PTF_Sample/data/B_workflowsteps.json');
const CODE3_2 = './CODE3-2.txt';

const METADATA_FILE = './migration-data/audio-metadata.json';
const LANGUAGES_FILE = './migration-data/languages.json';
const OUTPUT_DIR = './migration-data/ptf-files';

// APM Schema Version
const SCHEMA_VERSION = 10;

// Generate unique IDs
function generateUUID() {
  // Public Domain/MIT
  let d = new Date().getTime(); //Timestamp
  let d2 = (performance && performance.now && performance.now() * 1000) || 0; //Time in microseconds since page-load or 0 if unsupported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = Math.random() * 16; //random number between 0 and 16
    if (d > 0) {
      //Use timestamp until depleted
      r = ((d + r) % 16) | 0;
      d = Math.floor(d / 16);
    } else {
      //Use microseconds since page-load if supported
      r = ((d2 + r) % 16) | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const uuid = generateUUID();
let idCounter = 1;
function generateId() {
  return `${uuid}-${idCounter++}`;
}

function createJsonApiRecord(type, attributes, relationships = {}) {
  return {
    type,
    id: generateId(),
    attributes,
    relationships:
      Object.keys(relationships).length > 0 ? relationships : undefined,
  };
}

function relationshipIdentifier(type, value) {
  if (value && typeof value === 'object' && value.id) {
    const relationshipType =
      value.type && !Array.isArray(value.type) ? value.type : type;
    return {
      type: type ?? relationshipType,
      id: value.id,
    };
  }

  return {
    type,
    id: value ?? null,
  };
}

function createRelationship(type, value = null) {
  if (Array.isArray(value)) {
    return {
      data: value
        .filter((item) => item !== null && item !== undefined)
        .map((item) => relationshipIdentifier(type, item)),
    };
  }

  if (value === undefined || value === null) {
    return { data: null };
  }

  if (value && typeof value === 'object' && value.data) {
    return value;
  }

  return {
    data: relationshipIdentifier(type, value),
  };
}

function toUtcIso(value, fallback) {
  if (!value) {
    return fallback;
  }

  let candidate = DateTime.fromISO(value, { setZone: true });
  if (!candidate.isValid) {
    candidate = DateTime.fromJSDate(new Date(value));
  }

  return candidate.isValid ? candidate.toUTC().toISO() : fallback;
}

async function transformToPTF() {
  console.log('Starting transformation to PTF format...');

  // Read metadata
  const metadataRaw = await fs.readFile(METADATA_FILE, 'utf-8');
  const audioMetadata = JSON.parse(metadataRaw);

  const languagesRaw = await fs.readFile(LANGUAGES_FILE, 'utf-8');
  const languages = JSON.parse(languagesRaw);

  const code3_2Raw = await fs.readFile(CODE3_2, 'utf-8');
  const code3_2Parsed = code3_2Raw
    .split(/[\r\n]+/)
    .map((line) => line.split('\t'));
  const code3_2 = new Map(code3_2Parsed);

  console.log(
    `Processing ${languages.length} languages with ${audioMetadata.length} audio files...`
  );

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Group audio by language
  const audioByLanguage = {};
  audioMetadata.forEach((audio) => {
    if (!audioByLanguage[audio.language]) {
      audioByLanguage[audio.language] = [];
    }
    audioByLanguage[audio.language].push(audio);
  });

  // Create a PTF file for each language
  let ptfCount = 0;

  for (const lang of languages) {
    const langAudio = audioByLanguage[lang.name] || [];
    const code = lang.url.split('/').pop() ?? 'en';
    const bcp47 = code3_2.get(code) ?? code;
    const langTag = getLangTag(bcp47);
    const langName = lang.name.split(' ')[0] ?? 'English';
    const fontFamily = langTag?.defaultFont ?? 'charissil';
    const rtl = getRtl(bcp47);

    if (langAudio.length === 0) {
      console.log(`Skipping ${lang.name} (no audio files)`);
      continue;
    }

    console.log(
      `language bcp47: ${bcp47}, language name: ${langName}, font family: ${fontFamily}, rtl: ${rtl}`
    );

    console.log(
      `\nCreating PTF for ${lang.name} (${langAudio.length} files)...`
    );

    const zip = new AdmZip();
    const now = DateTime.utc().toISO();

    // Add version markers and offline flag
    zip.addFile('SILTranscriber', Buffer.from(now));
    zip.addFile('Version', Buffer.from(SCHEMA_VERSION.toString()));
    zip.addFile('Offline', Buffer.alloc(0));

    // -- A_users -------------------------------------------------------------
    const user = createJsonApiRecord(
      'users',
      {
        name: `${langName} ${code} Import`,
        'given-name': langName,
        'family-name': 'Import',
        email: '',
        phone: '',
        locale: 'en',
        timezone: 'UTC',
        'is-locked': false,
        uilanguagebcp47: '',
        'digest-preference': 0,
        'news-preference': false,
        'date-created': now,
        dateUpdated: now,
      },
      {
        lastModifiedByUser: createRelationship('user', null),
        organizationMemberships: createRelationship(
          'organizationmembership',
          []
        ),
        groupMemberships: createRelationship('groupmembership', []),
      }
    );

    // -- B_integrations ------------------------------------------------------
    const integrations = [
      'paratext',
      'paratextbacktranslation',
      'paratextwholebacktranslation',
    ].map((name) =>
      createJsonApiRecord('integrations', {
        name,
      })
    );

    // -- B_organizations -----------------------------------------------------
    const organization = createJsonApiRecord(
      'organizations',
      {
        name: 'OneStory Partnership',
        slug: 'onestory',
        'default-params': `{"langProps":{"bcp47":"${bcp47}","languageName":"${langName}","font":"${fontFamily}","rtl":"${rtl}","spellCheck":false}}`,
        'date-created': now,
        dateUpdated: now,
      },
      {
        lastModifiedByUser: createRelationship('user', user),
        owner: createRelationship('user', user),
        groups: createRelationship('group', []),
      }
    );

    // -- B_passagetypes ------------------------------------------------------
    const passageTypes = SAMPLE_PASSAGE_TYPES.data.map((passageType) =>
      createJsonApiRecord('passagetypes', { ...passageType.attributes })
    );

    // -- B_plantypes ---------------------------------------------------
    const planTypes = ['Scripture', 'Other'].map((name) =>
      createJsonApiRecord(
        'plantypes',
        {
          name,
          'date-created': now,
          dateUpdated: now,
        },
        {
          plans: createRelationship('plan', []),
        }
      )
    );
    const otherPlanType = planTypes.find(
      (planType) => planType.attributes.name === 'Other'
    );

    const projectTypes = ['Generic', 'Scripture'].map((name) =>
      createJsonApiRecord(
        'projecttypes',
        {
          name,
          'date-created': now,
          dateUpdated: now,
        },
        { projects: createRelationship('project', []) }
      )
    );
    const genericProjectType = projectTypes.find(
      (projectType) => projectType.attributes.name === 'Generic'
    );

    // -- B_roles -------------------------------------------------------------
    const roles = ['Admin', 'Member'].map((roleName) =>
      createJsonApiRecord('roles', {
        'role-name': roleName,
        'date-created': now,
        dateUpdated: now,
      })
    );
    const adminRole =
      roles.find(
        (roleResource) => roleResource.attributes['role-name'] === 'Admin'
      ) ?? roles[0];

    // -- C_artifactcategorys -------------------------------------------------
    const artifactCategories = SAMPLE_ARTIFACT_CATEGORIES.data.map(
      (artifactCategory) =>
        createJsonApiRecord('artifactcategories', {
          ...artifactCategory.attributes,
        })
    );

    // -- B_activitystates ----------------------------------------------------
    const activityStates = [
      'NoWork',
      'Transcribe',
      'Review',
      'Approval',
      'Done',
    ].map((state, idx) =>
      createJsonApiRecord('activitystates', {
        state,
        sequencenum: idx + 1,
        'date-created': now,
        dateUpdated: now,
      })
    );

    // -- C_artifacttypes -----------------------------------------------------
    const artifactTypes = SAMPLE_ARTIFACT_TYPES.data.map((artifactType) =>
      createJsonApiRecord('artifacttypes', {
        ...artifactType.attributes,
      })
    );

    const findArtifactTypeByTypename = (typename) => {
      let targetArtifactType = artifactTypes.find(
        (type) => type.attributes.typename === typename
      );

      if (!targetArtifactType) {
        targetArtifactType = createJsonApiRecord('artifacttypes', {
          typename,
        });
        artifactTypes.push(targetArtifactType);
      }

      return targetArtifactType.id;
    };
    const backtranslationArtifactType =
      findArtifactTypeByTypename('backtranslation');
    const wholebacktranslationArtifactType = findArtifactTypeByTypename(
      'wholebacktranslation'
    );
    const retellArtifactType = findArtifactTypeByTypename('retell');
    const getTypeByName = (name) => {
      switch (name) {
        case 'PBTTranscribe':
        case 'PBTParatextSync':
          return backtranslationArtifactType;
        case 'WBTTranscribe':
        case 'WBTParatextSync':
          return wholebacktranslationArtifactType;
        case 'RetellTranscribe':
          return retellArtifactType;
      }
      return null;
    };

    // -- B_workflowsteps -----------------------------------------------------
    const workflowSteps = SAMPLE_WORKFLOW_STEPS.data.map((step) => {
      const attributes = { ...step.attributes };
      if (attributes.tool) {
        try {
          const toolConfig = JSON.parse(attributes.tool);
          if (
            toolConfig?.settings &&
            Object.prototype.hasOwnProperty.call(
              toolConfig.settings,
              'artifactTypeId'
            )
          ) {
            toolConfig.settings.artifactTypeId = getTypeByName(attributes.name);
          }
          attributes.tool = JSON.stringify(toolConfig);
        } catch (err) {
          console.warn(
            `  Unable to parse workflow tool config: ${err.message}`
          );
        }
      }

      return createJsonApiRecord('workflowsteps', attributes);
    });

    // -- C_groups ------------------------------------------------------------
    const group = createJsonApiRecord(
      'groups',
      {
        name: `All users of >${user.attributes.name} Personal<`,
        abbreviation: 'all-users',
        allUsers: true,
        'date-created': now,
        dateUpdated: now,
      },
      {
        lastModifiedByUser: createRelationship('user', user),
        owner: createRelationship('organization', organization),
        groupMemberships: createRelationship('groupmembership', []),
        projects: createRelationship('project', []),
      }
    );
    organization.relationships.groups.data.push(
      relationshipIdentifier('group', group)
    );

    // -- C_organizationmemberships ------------------------------------------
    const organizationMembership = createJsonApiRecord(
      'organizationmemberships',
      {
        'date-created': now,
        dateUpdated: now,
      },
      {
        user: createRelationship('user', user),
        organization: createRelationship('organization', organization),
        role: createRelationship('role', adminRole),
      }
    );
    user.relationships.organizationMemberships.data.push(
      relationshipIdentifier('organizationmembership', organizationMembership)
    );

    // -- C_orgworkflowsteps --------------------------------------------------
    const orgWorkflowSteps = SAMPLE_ORG_WORKFLOW_STEPS.data.map((step) => {
      const attributes = {
        ...step.attributes,
        'date-created': now,
        dateUpdated: now,
      };
      if (attributes.tool) {
        try {
          const toolConfig = JSON.parse(attributes.tool);
          if (toolConfig?.settings?.artifactTypeId) {
            toolConfig.settings.artifactTypeId = getTypeByName(attributes.name);
          }
          attributes.tool = JSON.stringify(toolConfig);
        } catch (err) {
          console.warn(
            `  Unable to parse org workflow tool config: ${err.message}`
          );
        }
      }

      return createJsonApiRecord('orgworkflowsteps', attributes, {
        lastModifiedByUser: createRelationship('user', user),
        organization: createRelationship('organization', organization),
      });
    });

    // -- D_groupmemberships --------------------------------------------------
    const groupMembership = createJsonApiRecord(
      'groupmemberships',
      {
        'date-created': now,
        dateUpdated: now,
      },
      {
        user: createRelationship('user', user),
        group: createRelationship('group', group),
      }
    );
    group.relationships.groupMemberships.data.push(
      relationshipIdentifier('groupmembership', groupMembership)
    );
    user.relationships.groupMemberships.data.push(
      relationshipIdentifier('groupmembership', groupMembership)
    );

    // -- D_projects ----------------------------------------------------------
    const project = createJsonApiRecord(
      'projects',
      {
        name: lang.name,
        description: `OneStory Bible stories in ${lang.name}`,
        language: bcp47,
        languageName: langName,
        isPublic: false,
        rtl: rtl,
        spellCheck: false,
        defaultFont: fontFamily,
        defaultFontSize: 'large',
        defaultParams: `{"book":"010","story":true,"sectionMap":[]}`,
        allowClaim: false,
        'date-created': now,
        dateUpdated: now,
      },
      {
        projecttype: createRelationship('projecttype', genericProjectType),
        owner: createRelationship('user', user),
        organization: createRelationship('organization', organization),
        group: createRelationship('group', group),
        plans: createRelationship('plan', []),
      }
    );
    group.relationships.projects.data.push(
      relationshipIdentifier('project', project)
    );
    genericProjectType.relationships.projects.data.push(
      relationshipIdentifier('project', project)
    );

    // -- E_plans ------------------------------------------------------------
    const plan = createJsonApiRecord(
      'plans',
      {
        name: `${lang.name} Stories`,
        slug: `${lang.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-stories`,
        flat: true,
        sectionCount: 1,
        'date-created': now,
        dateUpdated: now,
      },
      {
        project: createRelationship('project', project),
        plantype: createRelationship('plantype', otherPlanType),
        owner: createRelationship('user', user),
        sections: createRelationship('section', []),
        mediafiles: createRelationship('mediafile', []),
      }
    );
    project.relationships.plans.data.push(relationshipIdentifier('plan', plan));
    planTypes.forEach((planType) => {
      if (planType.attributes.name === 'Other') {
        planType.relationships.plans.data.push(
          relationshipIdentifier('plan', plan)
        );
      }
    });

    // -- F_sections ---------------------------------------------------------
    const sections = [];
    // -- G_passages ---------------------------------------------------------
    const passages = [];
    // -- H_mediafiles -------------------------------------------------------
    const mediafiles = [];

    const validAudio = langAudio.filter((audio) => audio.title !== 'Audio');

    for (let i = 0; i < validAudio.length; i++) {
      const audio = validAudio[i];
      if (audio.title === 'Audio') {
        continue;
      }

      const section = createJsonApiRecord(
        'sections',
        {
          sequencenum: i + 1,
          name: audio.title,
          state: '',
          level: 3,
          published: false,
          publishTo: '{}',
          'date-created': now,
          dateUpdated: now,
        },
        {
          plan: createRelationship('plan', plan),
          passages: createRelationship('passage', []),
        }
      );
      plan.relationships.sections.data.push(
        relationshipIdentifier('section', section)
      );
      sections.push(section);

      const passage = createJsonApiRecord(
        'passages',
        {
          sequencenum: 1,
          book: '', // no book for generic project
          reference: `Story ${i + 1}`,
          title: '',
          state: 'noMedia',
          'date-created': now,
          dateUpdated: now,
          'start-chapter': 0,
          'end-chapter': 0,
          'start-verse': 0,
          'end-verse': 0,
        },
        {
          lastModifiedByUser: createRelationship('user', user),
          section: createRelationship('section', section),
          mediafiles: createRelationship('mediafile', []),
        }
      );

      passages.push(passage);
      section.relationships.passages.data.push(
        relationshipIdentifier('passage', passage)
      );

      const audioFilename = path.basename(audio.filepath);
      const downloadedAt = toUtcIso(audio.downloadedAt, now);

      const mediafile = createJsonApiRecord(
        'mediafiles',
        {
          'version-number': 1,
          audioUrl: audioFilename,
          'eaf-url': '',
          'audio-url': `media/${audioFilename}`,
          s3file: '',
          duration: null, // Will be calculated on import
          'content-type': 'audio/mpeg',
          'audio-quality': '',
          'text-quality': '',
          transcription: '',
          'original-file': audioFilename,
          filesize: audio.filesize,
          position: 0,
          segments: '{}',
          languagebcp47: '',
          link: false,
          'ready-to-share': false,
          'publish-to': '{}',
          'performed-by': '',
          'source-segments': '{}',
          'source-media-offline-id': '',
          transcriptionstate: '',
          topic: '',
          'last-modified-by': -1,
          'resource-passage-id': -1,
          'offline-id': '',
          'date-created': downloadedAt,
          'date-updated': downloadedAt,
        },
        {
          lastModifiedByUser: createRelationship('user', user),
          plan: createRelationship('plan', plan),
          passage: createRelationship('passage', passage),
          recordedbyUser: createRelationship('user', user),
        }
      );

      mediafiles.push(mediafile);
      passage.relationships.mediafiles.data.push(
        relationshipIdentifier('mediafile', mediafile)
      );
      plan.relationships.mediafiles.data.push(
        relationshipIdentifier('mediafile', mediafile)
      );

      try {
        const audioData = await fs.readFile(audio.filepath);
        zip.addFile(`media/${audioFilename}`, audioData);
      } catch (err) {
        console.error(`  Error adding ${audioFilename}: ${err.message}`);
      }
    }

    // Write all JSON files to zip
    const dataFiles = {
      A_users: { data: [user] },
      B_integrations: { data: integrations },
      B_organizations: { data: [organization] },
      B_passagetypes: { data: passageTypes },
      B_plantypes: { data: planTypes },
      B_projecttypes: { data: projectTypes },
      B_activitystates: { data: activityStates },
      B_roles: { data: roles },
      B_workflowsteps: { data: workflowSteps },
      C_artifactcategorys: { data: artifactCategories },
      C_artifacttypes: { data: artifactTypes },
      C_groups: { data: [group] },
      C_organizationmemberships: { data: [organizationMembership] },
      C_orgworkflowsteps: { data: orgWorkflowSteps },
      D_groupmemberships: { data: [groupMembership] },
      D_projects: { data: [project] },
      E_plans: { data: [plan] },
      F_sections: { data: sections },
      G_passages: { data: passages },
      H_mediafiles: { data: mediafiles },
    };

    for (const [filename, content] of Object.entries(dataFiles)) {
      zip.addFile(
        `data/${filename}.json`,
        Buffer.from(JSON.stringify(content, null, 2))
      );
    }

    // Write PTF file
    const ptfFilename = `${lang.name.replace(/[^a-z0-9]/gi, '_')}.ptf`;
    const ptfPath = path.join(OUTPUT_DIR, ptfFilename);

    await fs.writeFile(ptfPath, zip.toBuffer());

    console.log(`  Created: ${ptfFilename}`);
    ptfCount++;
  }

  console.log('\n=== TRANSFORMATION COMPLETE ===');
  console.log(`Created ${ptfCount} PTF files in ${OUTPUT_DIR}/`);
  console.log('\nNext step: Import the PTF files into Audio Project Manager');
  console.log('  1. Open Audio Project Manager');
  console.log('  2. Go to File > Import Project');
  console.log('  3. Select a .ptf file from the output directory');
  console.log('  4. Repeat for each language you want to import');
}

transformToPTF().catch(console.error);
