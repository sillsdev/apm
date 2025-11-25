# OneStory to Audio Project Manager Migration

This directory contains scripts to migrate data from the OneStory website (https://www.onestory-media.org/) into the Audio Project Manager (APM).

## Overview

The migration process consists of four main phases:

1. **Scraping**: Extract language list and discover audio file locations
2. **Downloading**: Download all audio files with metadata
3. **Transformation**: Convert to APM's PTF format
4. **Burrito Metadata**: Generate Scripture Burrito-compliant `metadata.json` files for each language

## Prerequisites

- Node.js 18+ installed
- Audio Project Manager installed
- Internet connection to access OneStory website

## Installation

Navigate to the migration directory and install dependencies:

```bash
cd migration
npm install
```

## Usage

### Option 1: Run All Steps Together

```bash
npm run migrate
```

This will run all four phases sequentially.

### Option 2: Run Steps Individually

#### Step 1: Scrape the Website

```bash
npm run scrape
```

This will:
- Extract the list of languages from the OneStory website
- Investigate a sample of language pages to discover audio file locations
- Save results to `./migration-data/languages.json` and `./migration-data/audio-discovery.json`

**Output**:
- `migration-data/languages.json` - List of all languages
- `migration-data/audio-discovery.json` - Sample audio discovery results
- `migration-data/scrape-summary.json` - Summary report

#### Step 2: Download Audio Files

```bash
npm run download
```

This will:
- Process each language from the scraped data
- Download all audio files for each language
- Organize files by language in `./migration-data/audio/`
- Save metadata in `./migration-data/audio-metadata.json`

**Output**:
- `migration-data/audio/` - Downloaded audio files organized by language
- `migration-data/audio-metadata.json` - Metadata for all downloaded files

#### Step 3: Transform to PTF Format

```bash
npm run transform
```

This will:
- Read the audio metadata
- Create PTF (Project Transfer Format) files for each language
- Each PTF file contains:
  - Project structure (organization, project, plan, sections, passages)
  - Audio files
  - Metadata in JSON API format

**Output**:
- `migration-data/ptf-files/` - PTF files ready for import into APM

#### Step 4: Generate Scripture Burrito Metadata

```bash
npm run burrito
```

This will:
- Read the audio metadata and local language folders
- Create a Scripture Burrito compliant `metadata.json` in each `migration-data/audio/<Language>/` directory
- Include audio file checksums and ingredient listings for each folder

**Output**:
- `migration-data/audio/<Language>/metadata.json` - Scripture Burrito metadata for each language's audio set

## Importing into Audio Project Manager

Once the PTF files are created (and optional Scripture Burrito metadata generated):

1. Open **Audio Project Manager**
2. Go to **File > Import Project**
3. Select a `.ptf` file from `migration-data/ptf-files/`
4. Wait for the import to complete
5. Repeat for each language you want to import

## Troubleshooting

### Audio Files Not Found

The OneStory website structure may have changed or audio files might be behind authentication. Check the `audio-discovery.json` file to see what was discovered.

If needed, you may need to:
- Manually identify where audio files are hosted
- Update `02-download-audio.js` to match the new structure
- Check if the website requires login or API keys

### Large Download Size

If you have limited bandwidth or storage:
- Edit `02-download-audio.js` to process only specific languages
- Modify the language loop to filter by name or index
- Process in batches

### PTF Import Errors

If APM shows errors during import:
- Check that the PTF file is not corrupted (open as ZIP and verify contents)
- Ensure audio files are in a supported format (MP3, WAV, M4A)
- Check APM logs for specific error messages
- Verify the schema version matches your APM version

## Data Structure

### PTF File Structure

Each PTF file is a ZIP archive containing:

```
language-name.ptf (ZIP)
├── SILTranscriber (timestamp)
├── Version (schema version number)
├── data/
│   ├── A_users.json
│   ├── B_organizations.json
│   ├── C_groups.json
│   ├── D_projects.json
│   ├── E_plans.json
│   ├── F_sections.json
│   ├── G_passages.json
│   └── H_mediafiles.json
└── media/
    ├── audio-file-1.mp3
    ├── audio-file-2.mp3
    └── ...
```

### JSON API Format

All data files use the JSON API specification format:

```json
{
  "data": [
    {
      "type": "project",
      "id": "local-123456",
      "attributes": {
        "name": "Language Name",
        "language": "languagecode",
        ...
      },
      "relationships": {
        "organization": {
          "data": { "type": "organization", "id": "org-id" }
        }
      }
    }
  ]
}
```

## Customization

You can customize the migration scripts:

### Change Audio Quality/Format

Edit `02-download-audio.js` to add audio conversion using ffmpeg.

### Modify Project Structure

Edit `03-transform-to-ptf.js` to change:
- Project names and descriptions
- Section/passage organization
- Metadata fields
- Book/reference structure

### Add Additional Metadata

If OneStory provides additional metadata (copyright, contributors, etc.), modify the scrapers to extract it and add it to the PTF structure.

## Support

For issues with:
- **These migration scripts**: Review the code and modify as needed
- **Audio Project Manager**: Refer to APM documentation or support channels
- **OneStory website access**: Contact OneStory Partnership

## Notes

- Be respectful of the OneStory website - the scripts include delays between requests
- Audio files are copyrighted by their respective owners
- This migration is intended for authorized use only
- Verify you have permission to download and use the audio content

