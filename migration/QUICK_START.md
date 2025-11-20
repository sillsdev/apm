# Quick Start Guide: OneStory to APM Migration

## Overview

This migration extracts Bible story audio files from the OneStory website and imports them into the Audio Project Manager (APM) application.

## Quick Start (5 minutes setup)

### 1. Install Dependencies

```bash
cd migration
npm install
```

### 2. Run the Migration

```bash
npm run migrate
```

This single command will:
- ✅ Scrape the OneStory website for language list
- ✅ Download all available audio files
- ✅ Convert to PTF format for APM import
- ✅ Generate Scripture Burrito `metadata.json` files for each language

**⏱️ Estimated time**: 30-60 minutes depending on number of audio files

### 3. Import into APM

1. Open **Audio Project Manager**
2. Click **File > Import Project**
3. Navigate to `migration-data/ptf-files/`
4. Select a `.ptf` file
5. Click **Open**
6. Wait for import to complete
7. Repeat for additional languages

## What Gets Migrated?

For each language on the OneStory website:

- ✅ **Project**: One project per language
- ✅ **Audio Files**: All available audio story files
- ✅ **Metadata**: Titles, file info, organization details
- ✅ **Structure**: Organized into Plans, Sections, and Passages

## Expected Output

```
migration-data/
├── languages.json          # List of all languages
├── audio-discovery.json    # Audio file discovery results
├── scrape-summary.json     # Summary report
├── audio-metadata.json     # Downloaded file metadata
├── audio/                  # Downloaded audio files
│   ├── Language_1/
│   │   ├── 1_story_title.mp3
│   │   └── 2_story_title.mp3
│   └── Language_2/
│       └── ...
├── audio/                  # Downloaded audio files
│   ├── Language_1/
│   │   ├── 1_story_title.mp3
│   │   ├── 2_story_title.mp3
│   │   └── metadata.json   # Scripture Burrito metadata
│   └── Language_2/
│       ├── ...
│       └── metadata.json
└── ptf-files/              # Ready to import
    ├── Language_1.ptf
    └── Language_2.ptf
```

## Troubleshooting

### No Audio Files Found?

The website structure may have changed. Run individual steps to diagnose:

```bash
# Step 1: Check what was found
npm run scrape
cat migration-data/scrape-summary.json

# Step 2: Review audio discovery
cat migration-data/audio-discovery.json

# If no audio found, you may need to:
# - Check if OneStory requires login
# - Verify the website structure hasn't changed
# - Update the scraper script
```

### "Module not found" Error?

Make sure you installed dependencies:

```bash
cd migration
npm install
```

### Import Fails in APM?

Check the PTF file:

```bash
# PTF files are ZIP archives - you can inspect them
unzip -l migration-data/ptf-files/Language_Name.ptf
```

Should contain:
- `SILTranscriber` file
- `Version` file
- `data/` folder with JSON files
- `media/` folder with audio files

## Next Steps After Import

Once imported into APM:

1. **Review Projects**: Check that all audio files are present
2. **Add Metadata**: Add descriptions, scripture references, etc.
3. **Organize**: Create additional sections/passages as needed
4. **Transcribe**: Add transcriptions to audio files
5. **Publish**: Share or export completed projects

## Customization

### Process Only Specific Languages

Edit `02-download-audio.js` line ~35:

```javascript
// Before:
for (let i = 0; i < languages.length; i++) {

// After (process only first 5):
for (let i = 0; i < Math.min(5, languages.length); i++) {

// Or filter by name:
const targetLanguages = languages.filter(l =>
  l.name.includes('Spanish') || l.name.includes('French')
);
for (let i = 0; i < targetLanguages.length; i++) {
  const lang = targetLanguages[i];
```

### Change Audio Format

Add audio conversion in `02-download-audio.js` (requires ffmpeg):

```javascript
const { execSync } = require('child_process');

// After downloading, convert to different format
execSync(`ffmpeg -i ${filepath} -acodec libmp3lame -ab 128k ${outputPath}`);
```

## Important Notes

⚠️ **Copyright**: Audio files from OneStory are copyrighted. Ensure you have permission to download and use them.

⚠️ **Website Terms**: Respect the OneStory website's terms of service and rate limits.

⚠️ **Bandwidth**: Downloading all languages may use significant bandwidth and storage.

## Support

- **Script Issues**: Review the code in the migration scripts
- **APM Issues**: Consult APM documentation
- **OneStory Access**: Contact OneStory Partnership

---

**Ready to migrate?** Run `npm run migrate` and grab a coffee! ☕

