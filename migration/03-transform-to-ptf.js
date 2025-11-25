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

const METADATA_FILE = './migration-data/audio-metadata.json';
const LANGUAGES_FILE = './migration-data/languages.json';
const OUTPUT_DIR = './migration-data/ptf-files';

// APM Schema Version
const SCHEMA_VERSION = 4;

// Generate unique IDs
let idCounter = 1;
function generateId() {
  return `local-${Date.now()}-${idCounter++}`;
}

function createJsonApiResource(type, attributes, relationships = {}) {
  return {
    type,
    id: generateId(),
    attributes,
    relationships: Object.keys(relationships).length > 0 ? relationships : undefined
  };
}

function createRelationship(type, id) {
  return {
    data: {
      type,
      id
    }
  };
}

async function transformToPTF() {
  console.log('Starting transformation to PTF format...');

  // Read metadata
  const metadataRaw = await fs.readFile(METADATA_FILE, 'utf-8');
  const audioMetadata = JSON.parse(metadataRaw);

  const languagesRaw = await fs.readFile(LANGUAGES_FILE, 'utf-8');
  const languages = JSON.parse(languagesRaw);

  console.log(`Processing ${languages.length} languages with ${audioMetadata.length} audio files...`);

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Group audio by language
  const audioByLanguage = {};
  audioMetadata.forEach(audio => {
    if (!audioByLanguage[audio.language]) {
      audioByLanguage[audio.language] = [];
    }
    audioByLanguage[audio.language].push(audio);
  });

  // Create a PTF file for each language
  let ptfCount = 0;

  for (const lang of languages) {
    const langAudio = audioByLanguage[lang.name] || [];

    if (langAudio.length === 0) {
      console.log(`Skipping ${lang.name} (no audio files)`);
      continue;
    }

    console.log(`\nCreating PTF for ${lang.name} (${langAudio.length} files)...`);

    const zip = new AdmZip();
    const now = DateTime.now().toISO();

    // Add version markers
    zip.addFile('SILTranscriber', Buffer.from(now));
    zip.addFile('Version', Buffer.from(SCHEMA_VERSION.toString()));

    // Create organization
    const organization = createJsonApiResource('organization', {
      name: 'OneStory Partnership',
      slug: 'onestory',
      websiteUrl: 'https://www.onestory-media.org/',
      description: 'Bible stories developed for oral learners',
      dateCreated: now,
      dateUpdated: now
    });

    // Create user (default user for import)
    const user = createJsonApiResource('user', {
      name: 'OneStory Import',
      givenName: 'OneStory',
      familyName: 'Import',
      email: 'import@onestory.org',
      locale: 'en',
      timezone: 'UTC',
      dateCreated: now,
      dateUpdated: now
    });

    // Create group
    const group = createJsonApiResource('group', {
      name: `${lang.name} Team`,
      abbreviation: lang.name.substring(0, 10).toUpperCase(),
      dateCreated: now,
      dateUpdated: now
    });

    // Create group membership
    const groupMembership = createJsonApiResource('groupmembership', {
      dateCreated: now,
      dateUpdated: now
    }, {
      user: createRelationship('user', user.id),
      group: createRelationship('group', group.id)
    });

    // Create project type
    const projectType = createJsonApiResource('projecttype', {
      name: 'Scripture',
      dateCreated: now,
      dateUpdated: now
    });

    // Create project
    const project = createJsonApiResource('project', {
      name: lang.name,
      slug: lang.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: `OneStory Bible stories in ${lang.name}`,
      language: lang.name.toLowerCase().replace(/[^a-z]+/g, ''),
      languageName: lang.name,
      isPublic: false,
      rtl: false,
      spellCheck: false,
      allowClaim: false,
      dateCreated: now,
      dateUpdated: now
    }, {
      projecttype: createRelationship('projecttype', projectType.id),
      owner: createRelationship('user', user.id),
      organization: createRelationship('organization', organization.id),
      group: createRelationship('group', group.id)
    });

    // Create plan type
    const planType = createJsonApiResource('plantype', {
      name: 'Story Set',
      dateCreated: now,
      dateUpdated: now
    });

    // Create plan
    const plan = createJsonApiResource('plan', {
      name: `${lang.name} Stories`,
      slug: `${lang.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-stories`,
      flat: false,
      sectionCount: 1,
      dateCreated: now,
      dateUpdated: now
    }, {
      project: createRelationship('project', project.id),
      plantype: createRelationship('plantype', planType.id),
      owner: createRelationship('user', user.id)
    });

    // Create section
    const section = createJsonApiResource('section', {
      sequencenum: 1,
      name: 'Bible Stories',
      dateCreated: now,
      dateUpdated: now,
      published: false
    }, {
      plan: createRelationship('plan', plan.id)
    });

    // Create passages and media files
    const passages = [];
    const mediafiles = [];
    const artifactType = createJsonApiResource('artifacttype', {
      name: 'Vernacular',
      dateCreated: now,
      dateUpdated: now
    });

    for (let i = 0; i < langAudio.length; i++) {
      const audio = langAudio[i];

      // Create passage
      const passage = createJsonApiResource('passage', {
        sequencenum: i + 1,
        book: 'GEN', // Default to Genesis
        reference: `Story ${i + 1}`,
        title: audio.title,
        dateCreated: now,
        dateUpdated: now
      }, {
        section: createRelationship('section', section.id)
      });

      passages.push(passage);

      // Create media file
      const audioFilename = path.basename(audio.filepath);
      const mediafile = createJsonApiResource('mediafile', {
        versionNumber: 1,
        audioUrl: audioFilename,
        duration: null, // Will be calculated on import
        contentType: 'audio/mpeg',
        originalFile: audioFilename,
        filesize: audio.filesize,
        dateCreated: audio.downloadedAt,
        dateUpdated: audio.downloadedAt,
        transcription: audio.title
      }, {
        passage: createRelationship('passage', passage.id),
        plan: createRelationship('plan', plan.id),
        artifactType: createRelationship('artifacttype', artifactType.id)
      });

      mediafiles.push(mediafile);

      // Add audio file to zip
      try {
        const audioData = await fs.readFile(audio.filepath);
        zip.addFile(`media/${audioFilename}`, audioData);
      } catch (err) {
        console.error(`  Error adding ${audioFilename}: ${err.message}`);
      }
    }

    // Create role (required by APM)
    const role = createJsonApiResource('role', {
      roleName: 'admin',
      dateCreated: now,
      dateUpdated: now
    });

    // Create activity states (required by APM)
    const activityStates = [
      'NoWork',
      'Transcribe',
      'Review',
      'Approval',
      'Done'
    ].map((state, idx) => createJsonApiResource('activitystate', {
      state,
      sequencenum: idx + 1,
      dateCreated: now,
      dateUpdated: now
    }));

    // Write all JSON files to zip
    const dataFiles = {
      'A_users': { data: [user] },
      'B_organizations': { data: [organization] },
      'B_activitystates': { data: activityStates },
      'B_roles': { data: [role] },
      'C_groups': { data: [group] },
      'C_artifacttypes': { data: [artifactType] },
      'D_groupmemberships': { data: [groupMembership] },
      'D_projects': { data: [project] },
      'D_projecttypes': { data: [projectType] },
      'E_plantypes': { data: [planType] },
      'E_plans': { data: [plan] },
      'F_sections': { data: [section] },
      'G_passages': { data: passages },
      'H_mediafiles': { data: mediafiles }
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

