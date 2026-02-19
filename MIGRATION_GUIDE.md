# OneStory to Audio Project Manager - Complete Migration Guide

## Executive Summary

This guide provides everything you need to migrate Bible story audio content from the OneStory website (https://www.onestory-media.org/) into your Audio Project Manager (APM) application.

**What's Included:**
- ✅ Automated web scraping scripts
- ✅ Audio download utilities
- ✅ Data transformation to APM's PTF format
- ✅ Comprehensive documentation
- ✅ Setup verification tools

**Time Required:** 1-2 hours total
**Technical Level:** Moderate (requires basic command line usage)

---

## Table of Contents

1. [What This Does](#what-this-does)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Steps](#detailed-steps)
5. [Troubleshooting](#troubleshooting)
6. [Customization](#customization)
7. [Important Notes](#important-notes)

---

## What This Does

The migration toolkit automates the process of:

1. **Extracting** language and audio information from the OneStory website
2. **Downloading** all available audio story files
3. **Converting** the data into APM's PTF (Project Transfer Format)
4. **Preparing** files for import into Audio Project Manager

### What Gets Migrated

For each language on the OneStory website:
- **Project Structure**: One APM project per language
- **Audio Files**: All available story audio files
- **Metadata**: Titles, file information, organization details
- **Organization**: Structured into Plans, Sections, and Passages

---

## Prerequisites

### Required Software

1. **Node.js 18+** - [Download here](https://nodejs.org/)
   - Verify: `node --version`

2. **npm** - Included with Node.js
   - Verify: `npm --version`

3. **Audio Project Manager** - Already installed (your apm-vite application)

### System Requirements

- **OS**: Windows, macOS, or Linux
- **RAM**: 2 GB minimum
- **Disk Space**: 5+ GB free space (for audio downloads)
- **Network**: Stable internet connection

### Permissions Required

- **Internet Access**: To reach https://www.onestory-media.org/
- **Write Permissions**: To create migration-data/ folder
- **Audio Access**: Legal right to download and use the content

---

## Quick Start

### Step 1: Navigate to Migration Folder

```bash
cd migration
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- `puppeteer` - For web scraping
- `adm-zip` - For creating PTF files
- `luxon` - For date/time handling

### Step 3: Verify Setup

```bash
npm run verify
```

This checks:
- ✅ Node.js version
- ✅ npm availability
- ✅ Puppeteer can launch browser
- ✅ Write permissions
- ✅ Internet connectivity
- ✅ Disk space

### Step 4: Run Migration

```bash
npm run migrate
```

Or run with verification:

```bash
npm start
```

This will:
1. Scrape the OneStory website (5-10 min)
2. Download all audio files (30-120 min)
3. Transform to PTF format (2-5 min)

### Step 5: Import into APM

1. Open **Audio Project Manager**
2. Go to **File > Import Project**
3. Navigate to `migration/migration-data/ptf-files/`
4. Select a `.ptf` file
5. Click **Open** and wait for import
6. Repeat for each language

---

## Detailed Steps

### Phase 1: Web Scraping

**Script**: `01-scrape-onestory.js`

```bash
npm run scrape
```

**What it does:**
- Visits https://www.onestory-media.org/
- Extracts list of all languages
- Explores sample language pages to discover audio file locations
- Saves results to `migration-data/`

**Output Files:**
- `languages.json` - Complete language list
- `audio-discovery.json` - Sample audio file analysis
- `scrape-summary.json` - Summary report

**Duration**: 5-10 minutes

### Phase 2: Audio Download

**Script**: `02-download-audio.js`

```bash
npm run download
```

**What it does:**
- Visits each language page
- Discovers all audio file URLs
- Downloads files organized by language
- Saves metadata for each file

**Output:**
- `migration-data/audio/` - Downloaded audio files (organized by language)
- `migration-data/audio-metadata.json` - Complete file inventory

**Duration**: 30-120 minutes (depends on number of files and bandwidth)

### Phase 3: PTF Transformation

**Script**: `03-transform-to-ptf.js`

```bash
npm run transform
```

**What it does:**
- Reads audio metadata
- Creates APM-compatible project structure
- Packages everything into PTF (ZIP) files
- One PTF per language

**Output:**
- `migration-data/ptf-files/*.ptf` - Ready-to-import files

**PTF Contents:**
- Project definition (JSON API format)
- Organization/user/group records
- Plan and section structure
- Passage records (one per story)
- Media file metadata
- Actual audio files

**Duration**: 2-5 minutes

### Phase 4: Manual Import

**Process:**

1. Launch Audio Project Manager
2. File Menu > Import Project
3. Select PTF file
4. Wait for import to complete
5. Verify in APM

**Per Language**: 1-3 minutes

---

## Directory Structure

After migration, you'll have:

```
migration/
├── 00-verify-setup.js           # Setup verification
├── 01-scrape-onestory.js        # Web scraper
├── 02-download-audio.js         # Audio downloader
├── 03-transform-to-ptf.js       # PTF converter
├── package.json                 # Dependencies
├── README.md                    # Detailed documentation
├── QUICK_START.md               # Quick reference
├── MIGRATION_WORKFLOW.md        # Visual workflow
│
└── migration-data/              # Generated data (created during migration)
    ├── languages.json           # Scraped language list
    ├── audio-discovery.json     # Audio discovery results
    ├── scrape-summary.json      # Scrape summary
    ├── audio-metadata.json      # Downloaded file metadata
    │
    ├── audio/                   # Downloaded audio files
    │   ├── Language_1/
    │   │   ├── 1_story.mp3
    │   │   └── 2_story.mp3
    │   └── Language_2/
    │       └── ...
    │
    └── ptf-files/               # Ready to import
        ├── Language_1.ptf
        ├── Language_2.ptf
        └── ...
```

---

## Troubleshooting

### Common Issues

#### "Module not found" Error

**Problem**: Dependencies not installed

**Solution**:
```bash
cd migration
npm install
```

#### No Audio Files Discovered

**Problem**: Website structure may have changed

**Solution**:
1. Check `migration-data/audio-discovery.json`
2. Verify website is accessible
3. May need to update scraper selectors

#### PTF Import Fails in APM

**Problem**: Corrupted or invalid PTF file

**Solution**:
1. Verify PTF is valid ZIP: `unzip -l file.ptf`
2. Check it contains:
   - `SILTranscriber` file
   - `Version` file
   - `data/` folder with JSON files
   - `media/` folder with audio files
3. Re-run transformation if needed

#### Download Takes Too Long

**Problem**: Large number of files or slow connection

**Solution**:
- Process languages in batches
- Edit `02-download-audio.js` to filter languages
- Resume by re-running (skips existing files)

#### Disk Space Full

**Problem**: Insufficient storage

**Solution**:
1. Free up space
2. Process in batches
3. Delete intermediate files after successful import

---

## Customization

### Process Only Specific Languages

Edit `02-download-audio.js` around line 35:

```javascript
// Original: process all languages
for (let i = 0; i < languages.length; i++) {

// Modified: process first 5 only
for (let i = 0; i < Math.min(5, languages.length); i++) {

// Modified: filter by name
const targetLanguages = languages.filter(l =>
  l.name.includes('Spanish') || l.name.includes('French')
);
for (let i = 0; i < targetLanguages.length; i++) {
  const lang = targetLanguages[i];
```

### Modify Project Names

Edit `03-transform-to-ptf.js` around line 120:

```javascript
// Original
const project = createJsonApiResource('project', {
  name: lang.name,

// Modified
const project = createJsonApiResource('project', {
  name: `OneStory - ${lang.name}`,
  description: `OneStory Bible stories in ${lang.name} - Imported ${new Date().toLocaleDateString()}`,
```

### Change Output Directory

Edit any script, modify:

```javascript
const OUTPUT_DIR = './migration-data';  // Change this path
```

---

## Important Notes

### ⚠️ Copyright & Legal

- Audio files from OneStory are copyrighted
- Ensure you have permission to download and use
- Respect OneStory's terms of service
- Use only for authorized purposes

### ⚠️ Website Etiquette

- Scripts include delays between requests (respectful scraping)
- Don't modify delays to be more aggressive
- OneStory may update their website - scripts may need adjustment

### ⚠️ Data Integrity

- Keep `migration-data/` folder until import is verified
- Don't modify PTF files manually (they're ZIP archives)
- Back up your APM data before importing

---

## Next Steps After Import

Once data is imported into APM:

1. **Verify Import**
   - Check all expected projects are present
   - Verify audio file counts
   - Test audio playback

2. **Add Metadata**
   - Scripture references (if applicable)
   - Story descriptions
   - Copyright information
   - Contributor credits

3. **Organize Content**
   - Group related stories into sections
   - Order sequences logically
   - Add section headings

4. **Add Transcriptions**
   - Transcribe audio to text
   - Time-align transcriptions
   - Add verse/segment markers

5. **Review & Publish**
   - Quality assurance
   - Peer review
   - Export or publish as needed

---

## Getting Help

### For Script Issues

1. Check error messages in console
2. Review `migration-data/` for partial results
3. Run `npm run verify` to check setup
4. Review script source code (well-commented)

### For APM Issues

1. Check APM documentation
2. Review APM logs
3. Verify PTF file integrity
4. Check schema version compatibility

### For Website Changes

If OneStory updates their website:
1. Run scraper to see what's discovered
2. Update CSS selectors in `01-scrape-onestory.js`
3. Update URL patterns in `02-download-audio.js`
4. Test with one language before full migration

---

## Summary

You now have:

✅ **Scripts** to automate the entire migration
✅ **Documentation** explaining each step
✅ **Verification** tools to ensure everything works
✅ **Customization** options for your specific needs

**Ready to start?**

```bash
cd migration
npm install
npm start
```

---

*For detailed information, see:*
- `migration/README.md` - Complete technical documentation
- `migration/QUICK_START.md` - Quick reference guide
- `migration/MIGRATION_WORKFLOW.md` - Visual workflow diagrams

