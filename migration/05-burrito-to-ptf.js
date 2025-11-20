/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Scripture Burrito to APM PTF Transformer
 *
 * This script loads Scripture Burrito zip packages from the
 * `migration-data/burrito` directory, extracts their audio content,
 * and produces PTF files compatible with Audio Project Manager.
 *
 * Usage: node 05-burrito-to-ptf.js
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

const BURRITO_DIR = './migration-data/burrito';
const OUTPUT_DIR = './migration-data/ptf-files';

// APM Schema Version
const SCHEMA_VERSION = 10;

// UUID and ID helpers ---------------------------------------------------------
function generateUUID() {
  let d = new Date().getTime();
  let d2 = (performance && performance.now && performance.now() * 1000) || 0;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
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

// Helpers ---------------------------------------------------------------------
function getLocalizedString(obj, preferredLocale) {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }
  if (preferredLocale && obj[preferredLocale]) {
    return obj[preferredLocale];
  }
  if (obj.en) {
    return obj.en;
  }
  const locales = Object.keys(obj);
  if (locales.length > 0) {
    return obj[locales[0]];
  }
  return undefined;
}

function sanitizeFilename(value, fallback) {
  const base = (value ?? fallback ?? 'output')
    .toString()
    .trim()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '');
  return base.length > 0 ? base : 'output';
}

function buildBookName(bookCode, localizedNames, preferredLocale) {
  if (!bookCode) {
    return undefined;
  }
  const key = `book-${bookCode.toLowerCase()}`;
  const record = localizedNames?.[key];
  if (!record) {
    return undefined;
  }
  return (
    getLocalizedString(record.short, preferredLocale) ??
    getLocalizedString(record.long, preferredLocale)
  );
}

function buildAudioReference(ingredient, localizedNames, preferredLocale) {
  const scope = ingredient?.scope ?? {};
  const [bookCode, chapters] = Object.entries(scope)[0] ?? [null, []];
  const chapterList = Array.isArray(chapters) ? chapters : [];
  const bookName = buildBookName(bookCode, localizedNames, preferredLocale);
  const referenceParts = [];
  const titleParts = [];

  if (bookCode) {
    referenceParts.push(bookCode);
  }
  if (chapterList.length > 0) {
    referenceParts.push(chapterList.join(', '));
  }

  if (bookName) {
    titleParts.push(bookName);
  } else if (bookCode) {
    titleParts.push(bookCode);
  }
  if (chapterList.length > 0) {
    titleParts.push(chapterList.join(', '));
  }

  return {
    bookCode,
    chapters: chapterList,
    reference: referenceParts.join(' ').trim() || ingredient?._reference || '',
    title: titleParts.join(' ').trim() || ingredient?._title || '',
  };
}

function orderAudioEntries(entries) {
  return entries.sort((a, b) => {
    if (a.reference.bookCode !== b.reference.bookCode) {
      return (a.reference.bookCode ?? '').localeCompare(
        b.reference.bookCode ?? ''
      );
    }
    const aChapter = a.reference.chapters[0] ?? '';
    const bChapter = b.reference.chapters[0] ?? '';
    if (aChapter !== bChapter) {
      return aChapter.localeCompare(bChapter, undefined, {
        numeric: true,
      });
    }
    return a.filename.localeCompare(b.filename);
  });
}

// Main transformation ---------------------------------------------------------
async function transformBurritoToPTF() {
  console.log('Starting Scripture Burrito to PTF transformation...');

  const now = DateTime.utc().toISO();

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const dirEntries = await fs.readdir(BURRITO_DIR, { withFileTypes: true });

  const zipFiles = dirEntries
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.zip')
    )
    .map((entry) => entry.name);

  if (zipFiles.length === 0) {
    console.warn('No Scripture Burrito zip archives found.');
    return;
  }

  let ptfCount = 0;

  for (const zipFile of zipFiles) {
    const zipPath = path.join(BURRITO_DIR, zipFile);
    console.log(`\nProcessing ${zipFile}...`);

    let burritoZip;
    try {
      burritoZip = new AdmZip(zipPath);
    } catch (err) {
      console.error(`  Unable to open ${zipFile}: ${err.message}`);
      continue;
    }

    const entries = burritoZip.getEntries();
    const metadataEntry = entries.find(
      (entry) =>
        !entry.isDirectory &&
        entry.entryName.toLowerCase().endsWith('metadata.json')
    );

    if (!metadataEntry) {
      console.warn(`  Skipping ${zipFile} (metadata.json not found)`);
      continue;
    }

    let metadata;
    try {
      metadata = JSON.parse(metadataEntry.getData().toString('utf-8'));
    } catch (err) {
      console.error(
        `  Failed to parse metadata.json in ${zipFile}: ${err.message}`
      );
      continue;
    }

    const languageInfo = metadata.languages?.[0] ?? {};
    const defaultLocale = metadata.meta?.defaultLocale ?? 'en';
    const languageTag = languageInfo.tag ?? 'und';
    const langName =
      getLocalizedString(languageInfo.name, defaultLocale) ??
      languageTag ??
      'Unknown Language';
    const langTag = getLangTag(languageTag);
    const fontFamily = langTag?.defaultFont ?? 'charissil';
    const rtl = getRtl(languageTag);

    const projectName =
      getLocalizedString(metadata.identification?.name, defaultLocale) ??
      `${langName} Audio`;
    const projectDescription =
      getLocalizedString(metadata.identification?.description, defaultLocale) ??
      `Audio content generated from Scripture Burrito ${zipFile}`;
    const planName = `${projectName} Audio`;
    const abbreviation = sanitizeFilename(
      getLocalizedString(metadata.identification?.abbreviation, defaultLocale),
      projectName
    );

    const audioIngredients = Object.entries(metadata.ingredients ?? {}).filter(
      ([, ingredient]) => ingredient?.mimeType?.startsWith('audio/')
    );

    if (audioIngredients.length === 0) {
      console.warn(`  Skipping ${zipFile} (no audio ingredients found)`);
      continue;
    }

    const localizedNames = metadata.localizedNames ?? {};
    const audioEntries = [];

    for (const [key, ingredient] of audioIngredients) {
      const zipEntry = entries.find((entry) => entry.entryName.endsWith(key));
      if (!zipEntry) {
        console.warn(
          `  Audio file ${key} referenced in metadata was not found in zip`
        );
        continue;
      }

      const reference = buildAudioReference(
        ingredient,
        localizedNames,
        defaultLocale
      );

      audioEntries.push({
        key,
        ingredient,
        zipEntry,
        filename: path.basename(key),
        reference,
      });
    }

    if (audioEntries.length === 0) {
      console.warn(`  Skipping ${zipFile} (no usable audio entries found)`);
      continue;
    }

    orderAudioEntries(audioEntries);

    const exportTimestamp = toUtcIso(metadata.meta?.dateCreated, now);

    const ptfZip = new AdmZip();
    const createdAt = DateTime.utc().toISO();

    ptfZip.addFile('SILTranscriber', Buffer.from(createdAt));
    ptfZip.addFile('Version', Buffer.from(SCHEMA_VERSION.toString()));
    ptfZip.addFile('Offline', Buffer.alloc(0));

    const user = createJsonApiRecord(
      'users',
      {
        name: 'Scripture Burrito Import',
        'given-name': 'Scripture Burrito',
        'family-name': 'Import',
        email: '',
        phone: '',
        locale: 'en',
        timezone: 'UTC',
        'is-locked': false,
        uilanguagebcp47: '',
        'digest-preference': 0,
        'news-preference': false,
        dateCreated: createdAt,
        dateUpdated: createdAt,
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

    const integrations = [
      'paratext',
      'paratextbacktranslation',
      'paratextwholebacktranslation',
    ].map((name) =>
      createJsonApiRecord('integrations', {
        name,
      })
    );

    const organization = createJsonApiRecord(
      'organizations',
      {
        name: 'Scripture Burrito Imports',
        slug: sanitizeFilename(projectName, 'burrito'),
        'default-params': `{"langProps":{"bcp47":"${languageTag}","languageName":"${langName}","font":"${fontFamily}","rtl":"${rtl}","spellCheck":false}}`,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        lastModifiedByUser: createRelationship('user', user),
        owner: createRelationship('user', user),
        groups: createRelationship('group', []),
      }
    );

    const passageTypes = SAMPLE_PASSAGE_TYPES.data.map((passageType) =>
      createJsonApiRecord('passagetypes', { ...passageType.attributes })
    );

    const planTypes = ['Scripture', 'Other'].map((name) =>
      createJsonApiRecord(
        'plantypes',
        {
          name,
          dateCreated: createdAt,
          dateUpdated: createdAt,
        },
        {
          plans: createRelationship('plan', []),
        }
      )
    );
    const scripturePlanTYpe = planTypes.find(
      (planType) => planType.attributes.name === 'Scripture'
    );

    const projectTypes = ['Generic', 'Scripture'].map((name) =>
      createJsonApiRecord(
        'projecttypes',
        {
          name,
          dateCreated: createdAt,
          dateUpdated: createdAt,
        },
        { projects: createRelationship('project', []) }
      )
    );
    const scriptureProjectType = projectTypes.find(
      (projectType) => projectType.attributes.name === 'Scripture'
    );

    const roles = ['Admin', 'Member'].map((roleName) =>
      createJsonApiRecord('roles', {
        'role-name': roleName,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      })
    );
    const adminRole =
      roles.find(
        (roleResource) => roleResource.attributes['role-name'] === 'Admin'
      ) ?? roles[0];

    const artifactCategories = SAMPLE_ARTIFACT_CATEGORIES.data.map(
      (artifactCategory) =>
        createJsonApiRecord('artifactcategories', {
          ...artifactCategory.attributes,
        })
    );

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
        dateCreated: createdAt,
        dateUpdated: createdAt,
      })
    );

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

    const group = createJsonApiRecord(
      'groups',
      {
        name: `All users of >${user.attributes.name} Personal<`,
        abbreviation: 'all-users',
        allUsers: true,
        dateCreated: createdAt,
        dateUpdated: createdAt,
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

    const organizationMembership = createJsonApiRecord(
      'organizationmemberships',
      {
        dateCreated: createdAt,
        dateUpdated: createdAt,
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

    const orgWorkflowSteps = SAMPLE_ORG_WORKFLOW_STEPS.data.map((step) => {
      const attributes = {
        ...step.attributes,
        dateCreated: createdAt,
        dateUpdated: createdAt,
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

    const groupMembership = createJsonApiRecord(
      'groupmemberships',
      {
        dateCreated: createdAt,
        dateUpdated: createdAt,
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

    const project = createJsonApiRecord(
      'projects',
      {
        name: projectName,
        description: projectDescription,
        language: languageTag,
        languageName: langName,
        isPublic: false,
        rtl,
        spellCheck: false,
        defaultFont: fontFamily,
        defaultFontSize: 'large',
        defaultParams: `{"book":"","story":true,"sectionMap":[]}`,
        allowClaim: false,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        projecttype: createRelationship('projecttype', scriptureProjectType),
        owner: createRelationship('user', user),
        organization: createRelationship('organization', organization),
        group: createRelationship('group', group),
        plans: createRelationship('plan', []),
      }
    );
    group.relationships.projects.data.push(
      relationshipIdentifier('project', project)
    );
    scriptureProjectType.relationships.projects.data.push(
      relationshipIdentifier('project', project)
    );

    const plan = createJsonApiRecord(
      'plans',
      {
        name: planName,
        slug: sanitizeFilename(planName, 'audio-plan'),
        flat: false,
        sectionCount: 1,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        project: createRelationship('project', project),
        plantype: createRelationship('plantype', scripturePlanTYpe),
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

    const section = createJsonApiRecord(
      'sections',
      {
        sequencenum: 1,
        name: 'Audio Content',
        state: '',
        level: 3,
        published: false,
        publishTo: '{}',
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        plan: createRelationship('plan', plan),
        passages: createRelationship('passage', []),
      }
    );
    plan.relationships.sections.data.push(
      relationshipIdentifier('section', section)
    );

    const passages = [];
    const mediafiles = [];

    audioEntries.forEach((audioEntry, index) => {
      const audioBuffer = audioEntry.zipEntry.getData();
      const audioFilename = audioEntry.filename;
      const downloadTimestamp = toUtcIso(exportTimestamp, createdAt);
      const referenceTitle = audioEntry.reference.title || `Audio ${index + 1}`;
      const referenceLabel =
        audioEntry.reference.reference || `Audio ${index + 1}`;

      const passage = createJsonApiRecord(
        'passages',
        {
          sequencenum: index + 1,
          book: audioEntry.reference.bookCode ?? '',
          reference: referenceLabel,
          title: referenceTitle,
          state: 'noMedia',
          dateCreated: createdAt,
          dateUpdated: createdAt,
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

      const mediafile = createJsonApiRecord(
        'mediafiles',
        {
          versionNumber: 1,
          audioUrl: audioFilename,
          'eaf-url': '',
          'audio-url': `media/${audioFilename}`,
          s3file: '',
          duration: null,
          'content-type': audioEntry.ingredient.mimeType ?? 'audio/mpeg',
          'audio-quality': '',
          'text-quality': '',
          transcription: '',
          originalFile: audioFilename,
          filesize: audioEntry.ingredient.size ?? audioBuffer.length,
          position: 0,
          segments: '{}',
          languagebcp47: languageTag,
          link: false,
          'ready-to-share': false,
          'publish-to': '{}',
          'performed-by': '',
          'source-segments': '{}',
          'source-media-offline-id': '',
          transcriptionstate: '',
          topic: referenceTitle,
          'last-modified-by': -1,
          'resource-passage-id': -1,
          'offline-id': '',
          dateCreated: downloadTimestamp,
          dateUpdated: downloadTimestamp,
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

      ptfZip.addFile(`media/${audioFilename}`, audioBuffer);
    });

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
      F_sections: { data: [section] },
      G_passages: { data: passages },
      H_mediafiles: { data: mediafiles },
    };

    for (const [filename, content] of Object.entries(dataFiles)) {
      ptfZip.addFile(
        `data/${filename}.json`,
        Buffer.from(JSON.stringify(content, null, 2))
      );
    }

    const ptfBaseName = sanitizeFilename(
      `${abbreviation || langName}-burrito`,
      path.basename(zipFile, path.extname(zipFile))
    );
    const ptfFilename = `${ptfBaseName}.ptf`;
    const ptfPath = path.join(OUTPUT_DIR, ptfFilename);

    await fs.writeFile(ptfPath, ptfZip.toBuffer());
    console.log(`  Created: ${ptfFilename}`);
    ptfCount++;
  }

  console.log('\n=== TRANSFORMATION COMPLETE ===');
  console.log(`Created ${ptfCount} PTF file(s) in ${OUTPUT_DIR}/`);
  console.log('\nNext step: Import the PTF files into Audio Project Manager');
  console.log('  1. Open Audio Project Manager');
  console.log('  2. Go to File > Import Project');
  console.log('  3. Select a .ptf file from the output directory');
  console.log('  4. Repeat for each PTF you want to import');
}

transformBurritoToPTF().catch((err) => {
  console.error('Failed to transform Scripture Burrito to PTF:', err);
  process.exitCode = 1;
});
